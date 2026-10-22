// The git hooks that run check before a merge into the base, and the two Claude Code hooks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { makeRepo } from './helpers.mjs';

// A repo whose check passes while src/state.txt says "green". Hooks are active.
function hookedRepo() {
  const r = makeRepo();
  cpSync(join(r.dir, 'scripts', 'githooks'), join(r.dir, '.githooks'), { recursive: true });
  r.write('.githooks/bar.conf', 'BASE=main\nCHECK="grep -q green src/state.txt"\n');
  r.write('src/state.txt', 'green\n');
  r.commit('base');
  r.git('config', 'core.hooksPath', '.githooks');
  r.git('config', 'branch.main.mergeOptions', '--no-ff');
  return r;
}
const merge = (r, branch) => spawnSync('git', ['merge', '-m', 'merge', branch], { cwd: r.dir, encoding: 'utf8' });

test('a branch whose merge result fails check does not merge into the base', () => {
  const r = hookedRepo();
  r.git('checkout', '-q', '-b', 'work');
  r.write('src/state.txt', 'red\n');
  r.commit('break');
  r.git('checkout', '-q', 'main');
  const before = r.git('rev-parse', 'HEAD');
  const out = merge(r, 'work');
  assert.notEqual(out.status, 0);
  assert.match(out.stderr, /check failed on the merge result/);
  assert.equal(r.git('rev-parse', 'HEAD'), before);
});

test('a green branch merges with a merge commit', () => {
  const r = hookedRepo();
  r.git('checkout', '-q', '-b', 'work');
  r.write('src/other.txt', 'x\n');
  r.commit('add');
  r.git('checkout', '-q', 'main');
  assert.equal(merge(r, 'work').status, 0);
  assert.equal(r.git('rev-list', '--parents', '-n', '1', 'HEAD').split(' ').length, 3, 'merge commit, not fast-forward');
});

test('a merge finished after a conflict runs check through pre-commit', () => {
  const r = hookedRepo();
  r.write('src/clash.txt', 'base\n');
  r.commit('clash base');
  r.git('checkout', '-q', '-b', 'work');
  r.write('src/clash.txt', 'work\n');
  r.write('src/state.txt', 'red\n');
  r.commit('work side');
  r.git('checkout', '-q', 'main');
  r.write('src/clash.txt', 'main\n');
  r.commit('main side');
  assert.notEqual(merge(r, 'work').status, 0, 'conflict');
  r.write('src/clash.txt', 'resolved\n');
  r.git('add', '-A');
  const out = spawnSync('git', ['commit', '--no-edit'], { cwd: r.dir, encoding: 'utf8' });
  assert.notEqual(out.status, 0);
  assert.match(out.stderr, /pre-commit: check failed/);
});

test('commits on other branches and ordinary commits on the base skip the hooks', () => {
  const r = hookedRepo();
  r.write('src/state.txt', 'red\n');
  r.commit('red on main is allowed outside a merge');
  r.git('checkout', '-q', '-b', 'work');
  r.write('src/more.txt', 'x\n');
  r.commit('work');
  assert.equal(r.git('log', '-1', '--format=%s'), 'work', 'both commits went through');
});

const preToolUse = (r, command) => r.node('no-verify.mjs', [], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }) });

test('the PreToolUse hook blocks commands that skip the git hooks', () => {
  const r = makeRepo();
  for (const c of [
    'git merge --no-verify work',
    'git commit -n -m x',
    'git commit -anm x',
    'git -c core.hooksPath=/dev/null merge work',
    'git config core.hooksPath /dev/null',
    'git config --unset core.hooksPath',
    'git -c core.hookspath=/dev/null merge work',
    'git -c "core.hooksPath=/dev/null" merge work',
    'git config core.HooksPath x',
    'git config unset core.hooksPath',
  ]) assert.equal(preToolUse(r, c).status, 2, c);
});

test('the PreToolUse hook lets ordinary commands through', () => {
  const r = makeRepo();
  for (const c of [
    'git commit -m "fix: no-verify docs"',
    'git commit -m "add -n flag"',
    'git commit --amend --no-edit',
    'git merge --no-ff work',
    'git config core.hooksPath',
    'git config --get core.hooksPath',
    'npm test',
  ]) assert.equal(preToolUse(r, c).status, 0, c);
  assert.equal(r.node('no-verify.mjs', [], { input: JSON.stringify({ tool_name: 'Edit', tool_input: {} }) }).status, 0);
});

const stop = (r, input = {}) => r.node('stop-check.mjs', ['--', 'grep', '-q', 'green', 'src/state.txt'], { input: JSON.stringify(input) });

test('the Stop hook stays quiet while nothing but Markdown changed', () => {
  const r = makeRepo();
  r.write('src/state.txt', 'red\n');
  r.commit('base');
  assert.equal(stop(r).status, 0, 'clean tree');
  r.write('README.md', 'x\n');
  assert.equal(stop(r).status, 0, 'Markdown only');
  assert.equal(existsSync(join(r.dir, '.verify')), false, 'check did not run');
});

test('the Stop hook runs check on a change and blocks the stop while it fails', () => {
  const r = makeRepo();
  r.write('src/state.txt', 'green\n');
  r.commit('base');
  r.write('src/state.txt', 'red\n');
  const out = stop(r);
  assert.equal(out.status, 2);
  assert.match(out.stderr, /check failed on your changes/);
  assert.equal(stop(r, { stop_hook_active: true }).status, 0, 'no loop');
  r.write('src/state.txt', 'green again\n');
  assert.equal(stop(r).status, 0);
  r.write('docs/n.md', 'x\n');
  assert.equal(stop(r).status, 0, 'the green receipt covers it');
});

test('the Stop hook keeps running check after a red check was committed', () => {
  const r = makeRepo();
  r.write('src/state.txt', 'green\n');
  r.commit('base');
  r.write('src/state.txt', 'red\n');
  assert.equal(stop(r).status, 2);
  r.commit('commit the red state');
  assert.equal(stop(r).status, 2, 'the red receipt is not forgotten by a commit');
});

test('the merge hook runs check without git\'s hook environment, also from a linked worktree', () => {
  const r = makeRepo();
  cpSync(join(r.dir, 'scripts', 'githooks'), join(r.dir, '.githooks'), { recursive: true });
  // The check makes its own scratch repo, as a test suite would; it must not touch this one.
  r.write('check.sh', 'd=$(mktemp -d) && git -C "$d" init -q && [ "$(git -C "$d" rev-parse --git-dir)" = .git ] && grep -q green src/state.txt\n');
  r.write('.githooks/bar.conf', 'BASE=main\nCHECK="node scripts/receipt.mjs run check check -- sh check.sh"\n');
  r.write('src/state.txt', 'green\n');
  r.commit('base');
  r.git('config', 'core.hooksPath', '.githooks');
  const wt = join(r.dir, '..', r.dir.split('/').pop() + '-main');
  r.git('checkout', '-q', '-b', 'work');
  r.write('src/more.txt', 'x\n');
  r.commit('work');
  r.git('worktree', 'add', '-q', wt, 'main');
  const out = spawnSync('git', ['merge', '--no-ff', '-m', 'merge', 'work'], { cwd: wt, encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.ok(existsSync(join(r.dir, '.verify/receipts/main/check--check.json')), 'the receipt landed in the primary checkout');
  assert.equal(r.git('rev-parse', '--abbrev-ref', 'HEAD'), 'work', 'the primary checkout was not touched');
});
