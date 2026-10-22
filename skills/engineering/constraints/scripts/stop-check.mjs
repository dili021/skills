#!/usr/bin/env node
// Claude Code Stop hook: runs `check` when files other than Markdown changed since the last green
// check, and keeps the agent working while it fails. Installed by `/setup-dili-skills` into
// .claude/settings.local.json as:
//   node "$CLAUDE_PROJECT_DIR/scripts/stop-check.mjs" -- <check command>
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changedFiles, readReceipt, treeId } from './receipt.mjs';

let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { /* no input: run as if fresh */ }
// The agent is already continuing because of this hook. Let it stop rather than loop.
if (input.stop_hook_active) process.exit(0);

const sep = process.argv.indexOf('--');
const command = sep > -1 ? process.argv.slice(sep + 1) : [];
if (command.length === 0) { console.error('stop-check: no check command after --'); process.exit(0); }

// Quiet only when nothing but Markdown changed since a green check, or, with no receipt at all,
// since the last commit. A red receipt always runs check again, even after a commit.
const tree = treeId();
const last = readReceipt('check', 'check');
if (!last || last.exit === 0) {
  const since = last ? last.tree : execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
  const changed = changedFiles(since, tree);
  if (changed !== null && changed.filter((f) => !/\.md$/i.test(f)).length === 0) process.exit(0);
}

const receipt = join(dirname(fileURLToPath(import.meta.url)), 'receipt.mjs');
const r = spawnSync(process.execPath, [receipt, 'run', 'check', 'check', '--', 'sh', '-c', command.join(' ')], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
if (r.status === 0) process.exit(0);
const tail = `${r.stdout}${r.stderr}`.trim().split('\n').slice(-40).join('\n');
console.error(`check failed on your changes (${command.join(' ')}). Fix it before you finish.\n${tail}`);
process.exit(2);
