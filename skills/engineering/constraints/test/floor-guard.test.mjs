// Floor guard behaviour that the move of its patterns into floor-patterns.mjs must keep.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRepo } from './helpers.mjs';

function branchWith(files, config) {
  const r = makeRepo({ config });
  r.write('src/app.ts', 'export const a = 1;\n');
  r.write('src/app.test.ts', 'expect(a).toBe(1);\n');
  r.commit('base');
  r.git('checkout', '-q', '-b', 'work');
  for (const [p, t] of Object.entries(files)) r.write(p, t);
  return r;
}

test('clean change passes', () => {
  const r = branchWith({ 'src/app.ts': 'export const a = 2;\n' }, { stacks: ['ts'] });
  const out = r.node('floor-guard.mjs', ['--base', 'main']);
  assert.equal(out.status, 0, out.stderr);
});

test('suppression comment fails', () => {
  const r = branchWith({ 'src/app.ts': '// @ts-ignore\nexport const a = 2;\n' }, { stacks: ['ts'] });
  const out = r.node('floor-guard.mjs', ['--base', 'main']);
  assert.equal(out.status, 1);
  assert.match(out.stderr, /silenced-checker/);
});

// A removed assertion is listed for a person and does not fail: a diff can't tell a weakened test
// from a behaviour that changed on purpose.
test('assertion removed from a test passes and is listed', () => {
  const r = branchWith({ 'src/app.test.ts': '// nothing\n' }, { stacks: ['ts'] });
  const out = r.node('floor-guard.mjs', ['--base', 'main']);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /1 assertion\(s\) removed/);
  assert.match(out.stdout, /\[assertion-removed\] src\/app\.test\.ts: expect\(a\)\.toBe\(1\);/);
});

test('a deleted test file still fails', () => {
  const r = branchWith({}, { stacks: ['ts'] });
  r.git('rm', '-q', 'src/app.test.ts');
  const out = r.node('floor-guard.mjs', ['--base', 'main']);
  assert.equal(out.status, 1);
  assert.match(out.stderr, /\[test-deleted\] src\/app\.test\.ts/);
});

test('extra test pattern covers a proof case directory', () => {
  const r = makeRepo({ config: { stacks: ['ts'], extra: { test: ['^verify/prove/'] } } });
  r.write('verify/prove/status-after-reload.mjs', 'assert(saved);\n');
  r.commit('base');
  r.git('checkout', '-q', '-b', 'work');
  r.write('verify/prove/status-after-reload.mjs', '// gone\n');
  const out = r.node('floor-guard.mjs', ['--base', 'main']);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /\[assertion-removed\] verify\/prove\/status-after-reload\.mjs/);
});

test('bad config exits 2', () => {
  const r = branchWith({}, { stacks: ['cobol'] });
  const out = r.node('floor-guard.mjs', ['--base', 'main']);
  assert.equal(out.status, 2);
});

// An assertion whose line changes only in its expected values is the same check, updated.
const guard = (files) => branchWith(files, { stacks: ['ts'] }).node('floor-guard.mjs', ['--base', 'main']);

test('an assertion with a new expected number passes and is listed as updated', () => {
  const out = guard({ 'src/app.test.ts': 'expect(a).toBe(2);\n' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /1 assertion\(s\) updated/);
});

test('an assertion with a new expected string passes', () => {
  const r = makeRepo({ config: { stacks: ['ts'] } });
  r.write('src/time.test.ts', "expect(label).toBe('Nov 2, 2026, 2:00 AM');\n");
  r.commit('base');
  r.git('checkout', '-q', '-b', 'work');
  r.write('src/time.test.ts', "expect(label).toBe('Nov 2, 2026, 2:00 AM CST');\n");
  const out = r.node('floor-guard.mjs', ['--base', 'main']);
  assert.equal(out.status, 0, out.stderr);
});

test('an assertion flipped from true to false passes as updated', () => {
  const r = makeRepo({ config: { stacks: ['ts'] } });
  r.write('src/line.test.ts', "expect(line.classList.contains('sr-only')).toBe(true);\n");
  r.commit('base');
  r.git('checkout', '-q', '-b', 'work');
  r.write('src/line.test.ts', "expect(line.classList.contains('sr-only')).toBe(false);\n");
  const out = r.node('floor-guard.mjs', ['--base', 'main']);
  assert.equal(out.status, 0, out.stderr);
});

// A changed matcher, `.not` or subject is a different check: listed as removed, never as updated.
const listedAsRemoved = (out) => {
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /1 assertion\(s\) removed/);
  assert.doesNotMatch(out.stdout, /updated/);
};

test('a looser matcher is listed as removed', () => {
  listedAsRemoved(guard({ 'src/app.test.ts': 'expect(a).toBeTruthy();\n' }));
});

test('an added .not is listed as removed', () => {
  listedAsRemoved(guard({ 'src/app.test.ts': 'expect(a).not.toBe(1);\n' }));
});

test('a changed subject is listed as removed', () => {
  listedAsRemoved(guard({ 'src/app.test.ts': 'expect(b).toBe(1);\n' }));
});

test('one updated and one removed assertion: each is listed under its own heading', () => {
  const r = makeRepo({ config: { stacks: ['ts'] } });
  r.write('src/two.test.ts', 'expect(a).toBe(1);\nexpect(b).toBe(2);\n');
  r.commit('base');
  r.git('checkout', '-q', '-b', 'work');
  r.write('src/two.test.ts', 'expect(a).toBe(3);\n');
  const out = r.node('floor-guard.mjs', ['--base', 'main']);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /1 assertion\(s\) updated/);
  assert.match(out.stdout, /1 assertion\(s\) removed/);
  assert.match(out.stdout, /assertion-removed\] src\/two\.test\.ts: expect\(b\)/);
});

test('an updated assertion pairs only within its own file', () => {
  const r = makeRepo({ config: { stacks: ['ts'] } });
  r.write('src/one.test.ts', 'expect(a).toBe(1);\n');
  r.write('src/other.test.ts', '// none\n');
  r.commit('base');
  r.git('checkout', '-q', '-b', 'work');
  r.write('src/one.test.ts', '// gone\n');
  r.write('src/other.test.ts', 'expect(a).toBe(2);\n');
  const out = r.node('floor-guard.mjs', ['--base', 'main']);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /assertion-removed\] src\/one\.test\.ts/);
  assert.doesNotMatch(out.stdout, /updated/);
});
