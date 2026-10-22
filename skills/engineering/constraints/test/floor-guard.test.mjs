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

test('assertion removed from a test fails', () => {
  const r = branchWith({ 'src/app.test.ts': '// nothing\n' }, { stacks: ['ts'] });
  const out = r.node('floor-guard.mjs', ['--base', 'main']);
  assert.equal(out.status, 1);
  assert.match(out.stderr, /assertion-removed/);
});

test('extra test pattern covers a proof case directory', () => {
  const r = makeRepo({ config: { stacks: ['ts'], extra: { test: ['^verify/prove/'] } } });
  r.write('verify/prove/status-after-reload.mjs', 'assert(saved);\n');
  r.commit('base');
  r.git('checkout', '-q', '-b', 'work');
  r.write('verify/prove/status-after-reload.mjs', '// gone\n');
  const out = r.node('floor-guard.mjs', ['--base', 'main']);
  assert.equal(out.status, 1);
  assert.match(out.stderr, /assertion-removed/);
});

test('bad config exits 2', () => {
  const r = branchWith({}, { stacks: ['cobol'] });
  const out = r.node('floor-guard.mjs', ['--base', 'main']);
  assert.equal(out.status, 2);
});
