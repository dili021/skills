#!/usr/bin/env node
// Regenerates the "skills" array in .claude-plugin/plugin.json by scanning skills/*/*/SKILL.md.
// Run after adding, renaming or removing a skill: node scripts/sync-manifest.mjs
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = join(root, "skills");

const found = [];
for (const category of readdirSync(skillsDir).sort()) {
  const categoryDir = join(skillsDir, category);
  if (!statSync(categoryDir).isDirectory()) continue;
  for (const name of readdirSync(categoryDir).sort()) {
    const dir = join(categoryDir, name);
    if (!statSync(dir).isDirectory()) continue;
    if (!existsSync(join(dir, "SKILL.md"))) continue;
    found.push({ name, path: `./skills/${category}/${name}` });
  }
}

const duplicates = found
  .map((s) => s.name)
  .filter((name, i, all) => all.indexOf(name) !== i);
if (duplicates.length) {
  console.error(`Duplicate skill names across categories: ${[...new Set(duplicates)].join(", ")}`);
  console.error("Skill names must be unique — Claude Code addresses them by name, not by path.");
  process.exit(1);
}

const manifestPath = join(root, ".claude-plugin", "plugin.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.skills = found.map((s) => s.path);
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`plugin.json: ${found.length} skills`);
