// activate.mjs turns the flow on and off for one clone without touching tracked files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ACTIVATE = join(here, '..', 'scripts', 'activate.mjs');
const GITHOOKS = join(here, '..', '..', 'constraints', 'scripts', 'githooks');

// A repo with the real .githooks (check passes while state.txt says green), scripts/no-verify.mjs,
// and a settings.local.json that already holds the user's own permission and hook.
function repo({ githooks = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dili-activate-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.test');
  git('config', 'user.name', 'Test');
  if (githooks) {
    cpSync(GITHOOKS, join(dir, '.githooks'), { recursive: true });
    writeFileSync(join(dir, '.githooks', 'bar.conf'), 'BASE=main\nCHECK="grep -q green state.txt"\n');
  }
  mkdirSync(join(dir, 'scripts'));
  writeFileSync(join(dir, 'scripts', 'no-verify.mjs'), '');
  writeFileSync(join(dir, 'state.txt'), 'green\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  mkdirSync(join(dir, '.claude'));
  writeFileSync(join(dir, '.claude', 'settings.local.json'), JSON.stringify({
    permissions: { allow: ['Bash(npm test)'] },
    hooks: { PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'echo mine' }] }] },
  }));
  const run = (...a) => spawnSync(process.execPath, [ACTIVATE, ...a], { cwd: dir, encoding: 'utf8' });
  const settings = () => JSON.parse(readFileSync(join(dir, '.claude', 'settings.local.json'), 'utf8'));
  const config = (k) => spawnSync('git', ['config', '--get', k], { cwd: dir, encoding: 'utf8' }).stdout.trim();
  const hook = (name) => join(dir, '.git', 'hooks', name);
  return { dir, git, run, settings, config, hook };
}

function branchWithState(r, text) {
  r.git('checkout', '-q', '-b', 'work');
  writeFileSync(join(r.dir, 'state.txt'), text);
  r.git('commit', '-q', '-am', 'work');
  r.git('checkout', '-q', 'main');
  return spawnSync('git', ['merge', '-m', 'merge', 'work'], { cwd: r.dir, encoding: 'utf8' });
}

test('on installs wrappers in .git/hooks, sets --no-ff and adds the hooks next to the user\'s own', () => {
  const r = repo();
  const out = r.run('on', 'main', '--stop-hook', 'npm run lint && npm test');
  assert.equal(out.status, 0, out.stderr);
  assert.match(readFileSync(r.hook('pre-merge-commit'), 'utf8'), /dili-skills hook wrapper/);
  assert.match(readFileSync(r.hook('pre-commit'), 'utf8'), /dili-skills hook wrapper/);
  assert.equal(r.config('core.hooksPath'), '');
  assert.equal(r.config('branch.main.mergeOptions'), '--no-ff');
  const s = r.settings();
  assert.deepEqual(s.permissions, { allow: ['Bash(npm test)'] });
  assert.equal(s.hooks.PreToolUse.length, 2);
  assert.equal(s.hooks.Stop[0].hooks[0].command, 'node "$CLAUDE_PROJECT_DIR/scripts/stop-check.mjs" -- \'npm run lint && npm test\'');
});

test('after on, a merge whose result fails check does not happen, and a green one does', () => {
  const r = repo();
  r.run('on', 'main');
  const before = r.git('rev-parse', 'HEAD');
  const red = branchWithState(r, 'red\n');
  assert.notEqual(red.status, 0);
  assert.match(red.stderr, /check failed on the merge result/);
  r.git('merge', '--abort');
  assert.equal(r.git('rev-parse', 'HEAD'), before);
  r.git('branch', '-D', 'work');
  assert.equal(branchWithState(r, 'green, changed\n').status, 0);
});

test('a hook that was already there is kept and runs first', () => {
  const r = repo();
  mkdirSync(join(r.dir, '.git', 'hooks'), { recursive: true });
  writeFileSync(r.hook('pre-merge-commit'), '#!/bin/sh\necho earlier hook ran >&2\n');
  chmodSync(r.hook('pre-merge-commit'), 0o755);
  r.run('on', 'main');
  assert.ok(existsSync(r.hook('pre-merge-commit.local')));
  const out = branchWithState(r, 'green too\n');
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stderr, /earlier hook ran/);
  r.run('off', 'main');
  assert.equal(readFileSync(r.hook('pre-merge-commit'), 'utf8'), '#!/bin/sh\necho earlier hook ran >&2\n');
  assert.equal(existsSync(r.hook('pre-merge-commit.local')), false);
});

test('on twice adds everything once', () => {
  const r = repo();
  r.run('on', 'main');
  r.run('on', 'main');
  assert.equal(r.settings().hooks.PreToolUse.length, 2);
  assert.equal(existsSync(r.hook('pre-merge-commit.local')), false);
});

test('off removes exactly what on added', () => {
  const r = repo();
  r.run('on', 'main', '--stop-hook', 'npm run check');
  assert.equal(r.run('off', 'main').status, 0);
  assert.equal(existsSync(r.hook('pre-merge-commit')), false);
  assert.equal(r.config('branch.main.mergeOptions'), '');
  const s = r.settings();
  assert.deepEqual(s.hooks, { PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'echo mine' }] }] });
  assert.deepEqual(s.permissions, { allow: ['Bash(npm test)'] });
});

test('a hook manager on core.hooksPath is left alone, with a warning', () => {
  const r = repo();
  r.git('config', 'core.hooksPath', '.husky');
  const out = r.run('on', 'main');
  assert.equal(out.status, 0);
  assert.match(out.stdout, /core\.hooksPath is "\.husky"/);
  assert.equal(r.config('core.hooksPath'), '.husky');
  assert.equal(existsSync(r.hook('pre-merge-commit')), false);
});

test('without .githooks no git hook is installed', () => {
  const r = repo({ githooks: false });
  r.run('on', 'main');
  assert.equal(existsSync(r.hook('pre-merge-commit')), false);
  assert.equal(r.settings().hooks.PreToolUse.length, 2);
});
