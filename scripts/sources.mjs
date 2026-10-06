#!/usr/bin/env node
// Track the upstream repos in SOURCES.json. Upstream text lives untouched under sources/,
// my skills live under skills/, and nothing here overwrites a skill of mine.
//
//   node scripts/sources.mjs                 what moved upstream since each pin
//   node scripts/sources.mjs diff <skill>    upstream's change to the source of one skill
//   node scripts/sources.mjs pull [name]     merge upstream changes into my skills, refresh sources/, move the pin
//   node scripts/sources.mjs mirror          rewrite sources/ at the current pins (first run, or repair)
//
// pull runs a three-way merge per file: base is the pinned upstream text, theirs is upstream's
// head, ours is my skill. Lines only upstream touched arrive on their own. Lines both sides
// touched get conflict markers and are listed. Review with git diff, then commit.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(root, "SOURCES.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const cacheRoot = join(root, ".cache", "upstream");
const TEXT = /\.(md|mjs|js|ts|json|ya?ml|sh|html|css|tsv|txt)$/i;

const git = (cwd, args, opts = {}) =>
  execFileSync("git", args, { cwd, encoding: opts.buffer ? "buffer" : "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
const tryGit = (cwd, args, opts) => { try { return git(cwd, args, opts); } catch { return null; } };
const fail = (msg) => { console.error(msg); process.exit(1); };

// Clone or refresh one upstream's cache and return its checkout path and head commit.
function prepare(up) {
  const cache = join(cacheRoot, up.name);
  if (!existsSync(join(cache, ".git"))) {
    mkdirSync(cacheRoot, { recursive: true });
    git(root, ["clone", "--quiet", up.url, cache]);
  }
  git(cache, ["fetch", "--quiet", "origin", up.branch]);
  return { cache, head: git(cache, ["rev-parse", `origin/${up.branch}`]).trim() };
}

const filesAt = (cache, sha, path) =>
  (tryGit(cache, ["ls-tree", "-r", "--name-only", sha, "--", path === "." ? "" : path].filter(Boolean)) ?? "")
    .split("\n").filter(Boolean);
const blobAt = (cache, sha, file) => tryGit(cache, ["show", `${sha}:${file}`], { buffer: true });

// The derived skills of one upstream, as [skill, entry] pairs.
const derivedOf = (up) => Object.entries(config.derived).filter(([, d]) => d.upstream === up.name);

function skillDir(skill) {
  for (const category of readdirSync(join(root, "skills"))) {
    const dir = join(root, "skills", category, skill);
    if (existsSync(join(dir, "SKILL.md"))) return dir;
  }
  return null;
}

// Path of an upstream file relative to the skill it belongs to.
const relTo = (sourcePath, file) => (sourcePath === "." ? file : file.slice(sourcePath.length + 1));

function writeMirror(up, cache, sha) {
  const dest = join(root, "sources", up.name);
  rmSync(dest, { recursive: true, force: true });
  let count = 0;
  for (const path of up.mirror) {
    for (const file of filesAt(cache, sha, path)) {
      const target = join(dest, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, blobAt(cache, sha, file));
      count++;
    }
  }
  return count;
}

// Three-way merge of one text file. Returns "clean", "conflict" or "unchanged".
function mergeText(oursPath, base, theirs) {
  const raw = readFileSync(oursPath, "utf8");
  const crlf = raw.includes("\r\n");
  const lf = (s) => s.replace(/\r\n/g, "\n");
  const work = mkdtempSync(join(tmpdir(), "sources-merge-"));
  const [o, b, t] = ["ours", "base", "theirs"].map((n) => join(work, n));
  writeFileSync(o, lf(raw));
  writeFileSync(b, lf(base.toString("utf8")));
  writeFileSync(t, lf(theirs.toString("utf8")));
  let conflicts = 0;
  try {
    execFileSync("git", ["merge-file", "-L", "mine", "-L", "pinned upstream", "-L", "new upstream", o, b, t], { stdio: "ignore" });
  } catch (e) {
    if (typeof e.status !== "number" || e.status < 0 || e.status > 127) throw e;
    conflicts = e.status;
  }
  const merged = readFileSync(o, "utf8");
  rmSync(work, { recursive: true, force: true });
  if (merged === lf(raw)) return "unchanged";
  writeFileSync(oursPath, crlf ? merged.replace(/\n/g, "\r\n") : merged);
  return conflicts ? "conflict" : "clean";
}

function changedSkills(up, cache, head) {
  const out = [];
  for (const [skill, d] of derivedOf(up)) {
    const stat = tryGit(cache, ["diff", "--shortstat", up.pinned, head, "--", d.path === "." ? "." : d.path]);
    if (stat && stat.trim()) out.push({ skill, d, stat: stat.trim() });
  }
  return out;
}

function status() {
  for (const up of config.upstreams) {
    const { cache, head } = prepare(up);
    console.log(`── ${up.name}`);
    if (up.pinned === head) { console.log(`   up to date at ${head.slice(0, 8)}\n`); continue; }
    console.log(`   moved ${up.pinned.slice(0, 8)} -> ${head.slice(0, 8)}`);
    const changed = changedSkills(up, cache, head);
    for (const { skill, d, stat } of changed) console.log(`   ${skill.padEnd(30)} ${d.mode.padEnd(6)} ${stat}`);
    if (!changed.length) console.log("   no change to anything my skills derive from");
    const mine = new Set(derivedOf(up).map(([, d]) => d.path));
    const fresh = new Set();
    for (const path of up.mirror) {
      const names = tryGit(cache, ["diff", "--name-only", "--diff-filter=A", up.pinned, head, "--", path]) ?? "";
      for (const file of names.split("\n").filter((f) => f.endsWith("/SKILL.md"))) {
        const dir = dirname(file);
        if (!mine.has(dir)) fresh.add(dir);
      }
    }
    for (const dir of fresh) console.log(`   new upstream skill             ${dir}`);
    console.log();
  }
  console.log("Next: sources.mjs diff <skill> | pull [upstream]");
}

function diff(skill) {
  const d = config.derived[skill] ?? fail(`No source recorded for ${skill}. It is mine alone.`);
  const up = config.upstreams.find((u) => u.name === d.upstream);
  const { cache, head } = prepare(up);
  process.stdout.write(git(cache, ["diff", up.pinned, head, "--", d.path === "." ? "." : d.path]));
}

function pull(only) {
  const dirty = git(root, ["status", "--porcelain", "--", "skills", "sources"]).trim();
  if (dirty) fail("skills/ or sources/ has uncommitted changes. Commit or stash first, so the pull is one reviewable diff.");
  for (const up of config.upstreams) {
    if (only && only !== up.name) continue;
    const { cache, head } = prepare(up);
    if (up.pinned === head) { console.log(`── ${up.name}: up to date`); continue; }
    console.log(`── ${up.name}: ${up.pinned.slice(0, 8)} -> ${head.slice(0, 8)}`);
    for (const { skill, d } of changedSkills(up, cache, head)) {
      const dir = skillDir(skill);
      if (!dir) { console.log(`   ${skill}: listed in SOURCES.json but not in skills/`); continue; }
      if (d.mode === "watch") { console.log(`   ${skill}: source changed, rewritten skill, port by hand (sources.mjs diff ${skill})`); continue; }
      const before = new Set(filesAt(cache, up.pinned, d.path));
      const after = new Set(filesAt(cache, head, d.path));
      for (const file of after) {
        const theirs = blobAt(cache, head, file);
        const base = before.has(file) ? blobAt(cache, up.pinned, file) : null;
        if (base && base.equals(theirs)) continue;
        const rel = relTo(d.path, file);
        const mine = join(dir, rel);
        if (!base) {
          if (existsSync(mine)) {
            const same = readFileSync(mine, "utf8").replace(/\r\n/g, "\n") === theirs.toString("utf8").replace(/\r\n/g, "\n");
            if (!same) console.log(`   ${skill}/${rel}: new upstream, I already have a different file by that name, compare by hand`);
            continue;
          }
          if (d.files && !d.files.includes(rel)) { console.log(`   ${skill}/${rel}: new upstream file outside the ones I carry, skipped`); continue; }
          mkdirSync(dirname(mine), { recursive: true });
          writeFileSync(mine, theirs);
          console.log(`   ${skill}/${rel}: new upstream file, added`);
        } else if (!existsSync(mine)) {
          console.log(`   ${skill}/${rel}: changed upstream, I do not carry it`);
        } else if (!TEXT.test(rel)) {
          if (readFileSync(mine).equals(base)) { writeFileSync(mine, theirs); console.log(`   ${skill}/${rel}: binary, replaced`); }
          else console.log(`   ${skill}/${rel}: binary changed on both sides, compare by hand`);
        } else {
          const result = mergeText(mine, base, theirs);
          if (result !== "unchanged") console.log(`   ${skill}/${rel}: ${result === "clean" ? "merged" : "CONFLICT, markers left in the file"}`);
        }
      }
      for (const file of before) {
        const rel = relTo(d.path, file);
        if (!after.has(file) && existsSync(join(dir, rel))) console.log(`   ${skill}/${rel}: removed upstream, mine kept`);
      }
    }
    const count = writeMirror(up, cache, head);
    up.pinned = head;
    up.pinnedDate = new Date().toISOString();
    console.log(`   sources/${up.name} refreshed (${count} files), pin moved`);
  }
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log("\nReview with git diff, resolve any CONFLICT, then commit.");
}

function mirror() {
  for (const up of config.upstreams) {
    const { cache } = prepare(up);
    if (tryGit(cache, ["cat-file", "-e", `${up.pinned}^{commit}`]) === null) fail(`${up.name}: pinned commit ${up.pinned} is not in the cache`);
    console.log(`sources/${up.name}: ${writeMirror(up, cache, up.pinned)} files at ${up.pinned.slice(0, 8)}`);
  }
}

const [command = "status", arg] = process.argv.slice(2);
if (command === "status") status();
else if (command === "diff") diff(arg ?? fail("usage: sources.mjs diff <skill>"));
else if (command === "pull") pull(arg);
else if (command === "mirror") mirror();
else fail("usage: sources.mjs [status | diff <skill> | pull [upstream] | mirror]");
