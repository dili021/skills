#!/usr/bin/env node
// Receipts: the record that a check, a proof or a verdict ran, on exactly which content.
//
//   node scripts/receipt.mjs run <kind> <name> [--evidence <path>]... -- <command> [args...]
//   node scripts/receipt.mjs verdict <report.json>
//   node scripts/receipt.mjs override "<criterion>" --as <contract-unclear|trade-off|noise> --why "<reason>"
//   node scripts/receipt.mjs tree
//
// A receipt is JSON in .verify/receipts/<branch>/<kind>--<name>.json under the primary checkout,
// also when the script runs in a linked worktree, so receipts outlive the worktree. `tree` is the
// git tree id of the whole work tree, uncommitted and untracked files included: the same content
// gives the same id on any commit. `run` exits with the command's own exit code.
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const git = (args, opts = {}) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();

// The main working tree, so every linked worktree writes to one place. `git worktree list` names it
// first, also for submodules and clones with a separate git dir.
export function primaryRoot() {
  const first = git(['worktree', 'list', '--porcelain']).split('\n')[0];
  return first.replace(/^worktree /, '');
}

export function worktreeTop() {
  return git(['rev-parse', '--show-toplevel']);
}

// The current branch, or detached-<sha> on a detached HEAD.
export function branchKey() {
  try { return git(['symbolic-ref', '--short', '-q', 'HEAD']); }
  catch { return 'detached-' + git(['rev-parse', '--short', 'HEAD']); }
}

// Tree id of the work tree as it is now. A copy of the index keeps git's stat cache, so only
// changed files are hashed. .verify/ and .afk/ hold records about the work, not the work, and
// .claude/settings.local.json changes whenever a person approves a permission.
export function treeId() {
  const top = worktreeTop();
  const tmp = mkdtempSync(join(tmpdir(), 'receipt-index-'));
  const index = join(tmp, 'index');
  try {
    const real = git(['rev-parse', '--path-format=absolute', '--git-path', 'index'], { cwd: top });
    if (existsSync(real)) {
      copyFileSync(real, index);
      // Git rehashes "racily clean" entries, those modified no earlier than the index file itself.
      // The copy keeps the original's mtime so that check still sees a same-size edit made in the
      // same second as the last index write.
      const st = statSync(real);
      utimesSync(index, st.atime, st.mtime);
    }
    const env = { ...process.env, GIT_INDEX_FILE: index };
    // Drop the records after `add`: git refuses an `add` whose pathspec names an ignored path.
    git(['add', '-A'], { cwd: top, env });
    git(['rm', '-r', '-q', '--cached', '--ignore-unmatch', '--', '.verify', '.afk', '.claude/settings.local.json'], { cwd: top, env });
    return git(['write-tree'], { cwd: top, env });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export function receiptsDir(branch = branchKey()) {
  return join(primaryRoot(), '.verify', 'receipts', branch);
}

export function readReceipt(kind, name, branch = branchKey()) {
  const p = join(receiptsDir(branch), `${kind}--${name}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

export function listReceipts(branch = branchKey()) {
  const dir = receiptsDir(branch);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

export function writeReceipt(receipt, branch = branchKey()) {
  const dir = receiptsDir(branch);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${receipt.kind}--${receipt.name}.json`), JSON.stringify(receipt, null, 2) + '\n');
}

// Files that differ between two trees. A rename lists both names, so moving product code into a
// test file still counts as a product change. Null when a tree is gone (git prunes unreachable trees
// after a while), which callers treat as a stale receipt.
export function changedFiles(fromTree, toTree) {
  if (fromTree === toTree) return [];
  try {
    return git(['-c', 'core.quotePath=false', 'diff', '--no-renames', '--name-only', fromTree, toTree])
      .split('\n').filter(Boolean);
  } catch { return null; }
}

const usage = () => {
  console.error('usage: receipt.mjs run <kind> <name> [--evidence <path>]... -- <command> [args...]\n'
    + '       receipt.mjs verdict <report.json>\n'
    + '       receipt.mjs override "<criterion>" --as <contract-unclear|trade-off|noise> --why "<reason>"\n'
    + '       receipt.mjs tree');
  process.exit(2);
};

const OVERALL = ['PASS', 'PASS+NOTES', 'FAIL'];
const OVERRIDE_AS = ['contract-unclear', 'trade-off', 'noise'];
const now = () => new Date().toISOString();
const asList = (e) => (Array.isArray(e) ? e : e ? [e] : []);

function run(args) {
  const sep = args.indexOf('--');
  if (sep < 2 || sep === args.length - 1) usage();
  const [kind, name] = args;
  const evidence = [];
  for (let i = 2; i < sep; i++) {
    if (args[i] === '--evidence' && i + 1 < sep) evidence.push(resolve(args[++i]));
    else usage();
  }
  const command = args.slice(sep + 1);
  const tree = treeId();
  const r = spawnSync(command[0], command.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' });
  // A command that could not start is the harness failing, not the app: exit 2.
  if (r.error) console.error(`receipt: could not run ${command[0]}: ${r.error.message}`);
  const exit = r.error ? 2 : (r.status ?? 1);
  writeReceipt({ kind, name, tree, head: git(['rev-parse', 'HEAD']), command: command.join(' '), exit, evidence, at: now() });
  process.exit(exit);
}

function verdict(args) {
  if (args.length !== 1) usage();
  const reportPath = resolve(args[0]);
  let report;
  try { report = JSON.parse(readFileSync(reportPath, 'utf8')); }
  catch (e) { console.error(`receipt: cannot read ${reportPath}: ${e.message}`); process.exit(2); }
  if (!OVERALL.includes(report.overall)) {
    console.error(`receipt: "overall" must be one of ${OVERALL.join(', ')}`);
    process.exit(2);
  }
  const criteria = report.criteria ?? [];
  // A verdict run again after a fix keeps the overrides recorded against the earlier rounds.
  const previous = readReceipt('verdict', 'verdict');
  writeReceipt({
    kind: 'verdict', name: 'verdict', tree: treeId(), head: git(['rev-parse', 'HEAD']),
    command: 'verdict', exit: report.overall === 'FAIL' ? 1 : 0, overall: report.overall,
    report: reportPath,
    evidence: criteria.flatMap((c) => asList(c.evidence)).map((p) => resolve(dirname(reportPath), p)),
    overrides: previous?.overrides ?? [], at: now(),
  });
}

function override(args) {
  const criterion = args[0];
  const as = args[args.indexOf('--as') + 1];
  const why = args[args.indexOf('--why') + 1];
  if (!criterion || !args.includes('--as') || !args.includes('--why') || !why) usage();
  if (!OVERRIDE_AS.includes(as)) {
    console.error(`receipt: --as must be one of ${OVERRIDE_AS.join(', ')}`);
    process.exit(2);
  }
  const r = readReceipt('verdict', 'verdict');
  if (!r) { console.error('receipt: no verdict receipt on this branch; write it first with `receipt.mjs verdict`'); process.exit(2); }
  r.overrides.push({ criterion, as, why, at: now() });
  writeReceipt(r);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...args] = process.argv.slice(2);
  try {
    if (cmd === 'run') run(args);
    else if (cmd === 'verdict') verdict(args);
    else if (cmd === 'override') override(args);
    else if (cmd === 'tree') console.log(treeId());
    else usage();
  } catch (e) {
    console.error('receipt: ' + (e.stderr?.toString().trim() || e.message));
    process.exit(2);
  }
}
