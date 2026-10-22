// Receipts and the gate: what each verifier accepts and what makes it fail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeRepo } from './helpers.mjs';

// A repo on branch `work` with one product file, one test and a passing check command.
function workRepo() {
  const r = makeRepo({ config: { stacks: ['ts'] } });
  r.write('src/app.ts', 'export const a = 1;\n');
  r.write('src/app.test.ts', 'expect(a).toBe(1);\n');
  r.write('docs/notes.md', 'notes\n');
  r.commit('base');
  r.git('checkout', '-q', '-b', 'work');
  r.check = (code = 0) => r.node('receipt.mjs', ['run', 'check', 'check', '--', process.execPath, '-e', `process.exit(${code})`]);
  r.gate = (name, ...args) => r.node('gate.mjs', [name, '--base', 'main', ...args]);
  r.verdict = (overall, criteria = [{ criterion: 'status survives reload', result: 'PASS', evidence: [] }]) => {
    mkdirSync(join(r.dir, '.verify'), { recursive: true });
    writeFileSync(join(r.dir, '.verify/report.json'), JSON.stringify({ overall, criteria, outside: [] }));
    return r.node('receipt.mjs', ['verdict', join(r.dir, '.verify/report.json')]);
  };
  return r;
}

test('tree id follows content, takes in untracked files and leaves out .verify and .afk', () => {
  const r = workRepo();
  const t1 = r.node('receipt.mjs', ['tree']).stdout.trim();
  r.write('.verify/x.json', '{}');
  r.write('.afk/work/HANDOFF.md', 'note');
  assert.equal(r.node('receipt.mjs', ['tree']).stdout.trim(), t1);
  r.write('src/new.ts', 'export {};\n');
  assert.notEqual(r.node('receipt.mjs', ['tree']).stdout.trim(), t1);
});

test('run passes the exit code through and records it', () => {
  const r = workRepo();
  assert.equal(r.check(3).status, 3);
  const receipt = JSON.parse(readFileSync(join(r.dir, '.verify/receipts/work/check--check.json'), 'utf8'));
  assert.equal(receipt.exit, 3);
  assert.match(receipt.tree, /^[0-9a-f]{40}$/);
});

test('check-green holds until a non-Markdown file changes', () => {
  const r = workRepo();
  assert.equal(r.gate('check-green').status, 1, 'no receipt yet');
  r.check(0);
  assert.equal(r.gate('check-green').status, 0);
  r.write('docs/notes.md', 'more notes\n');
  assert.equal(r.gate('check-green').status, 0, 'Markdown alone keeps it');
  r.write('src/app.test.ts', 'expect(a).toBe(2);\n');
  const out = r.gate('check-green');
  assert.equal(out.status, 1);
  assert.match(out.stdout, /src\/app\.test\.ts/);
});

test('a red check fails check-green', () => {
  const r = workRepo();
  r.check(1);
  assert.match(r.gate('check-green').stdout, /exited 1/);
});

test('verdict-fresh holds through test and doc changes, not product changes', () => {
  const r = workRepo();
  assert.equal(r.verdict('PASS').status, 0);
  assert.equal(r.gate('verdict-fresh').status, 0);
  r.write('src/app.test.ts', 'expect(a).toBe(1); expect(true).toBe(true);\n');
  assert.equal(r.gate('verdict-fresh').status, 0);
  r.write('src/app.ts', 'export const a = 2;\n');
  const out = r.gate('verdict-fresh');
  assert.equal(out.status, 1);
  assert.match(out.stdout, /src\/app\.ts/);
});

test('a FAIL verdict fails verdict-fresh, and a bad report is refused', () => {
  const r = workRepo();
  r.verdict('FAIL');
  assert.equal(r.gate('verdict-fresh').status, 1);
  assert.equal(r.verdict('MAYBE').status, 2);
});

test('an override must be named in the Attention section of the handoff note', () => {
  const r = workRepo();
  r.verdict('PASS');
  assert.equal(r.node('receipt.mjs', ['override', 'Status survives reload', '--as', 'noise', '--why', 'verifier used a stale build']).status, 0);
  assert.equal(r.node('receipt.mjs', ['override', 'x', '--as', 'whatever', '--why', 'y']).status, 2);
  mkdirSync(join(r.dir, '.afk/work'), { recursive: true });
  writeFileSync(join(r.dir, '.afk/work/HANDOFF.md'), '# Summary\n\nDone.\n\n## Attention\n\n- nothing\n\n## Tried\n\nstatus survives reload\n');
  const out = r.gate('handoff-complete');
  assert.equal(out.status, 1);
  assert.match(out.stdout, /noise override/);
  writeFileSync(join(r.dir, '.afk/work/HANDOFF.md'), '# Summary\n\n## Attention\n\n- Status survives  reload: sorted as noise, verifier used a stale build.\n');
  assert.equal(r.gate('handoff-complete').status, 0);
});

test('overrides survive a verdict run again', () => {
  const r = workRepo();
  r.verdict('FAIL');
  r.node('receipt.mjs', ['override', 'status survives reload', '--as', 'contract-unclear', '--why', 'criterion named the wrong screen']);
  r.verdict('PASS');
  const receipt = JSON.parse(readFileSync(join(r.dir, '.verify/receipts/work/verdict--verdict.json'), 'utf8'));
  assert.equal(receipt.overrides.length, 1);
});

test('handoff-complete fails on missing evidence', () => {
  const r = workRepo();
  r.node('receipt.mjs', ['run', 'prove', 'reload', '--evidence', join(r.dir, 'shot.png'), '--', process.execPath, '-e', '0']);
  mkdirSync(join(r.dir, '.afk/work'), { recursive: true });
  writeFileSync(join(r.dir, '.afk/work/HANDOFF.md'), '## Attention\n\nnone\n');
  assert.match(r.gate('handoff-complete').stdout, /evidence of prove reload is missing/);
  writeFileSync(join(r.dir, 'shot.png'), 'png');
  assert.equal(r.gate('handoff-complete').status, 0);
});

test('branch-on-base-tip fails when the base moved on', () => {
  const r = workRepo();
  assert.equal(r.gate('branch-on-base-tip').status, 0);
  r.git('checkout', '-q', 'main');
  r.write('src/other.ts', 'export {};\n');
  r.commit('base moves');
  r.git('checkout', '-q', 'work');
  assert.equal(r.gate('branch-on-base-tip').status, 1);
  assert.equal(r.node('gate.mjs', ['branch-on-base-tip']).status, 2, 'no base anywhere');
});

test('the base comes from docs/agents/handoff.md', () => {
  const r = workRepo();
  r.write('docs/agents/handoff.md', '**Mode:** local branch\n\n**Base branch:** main\n');
  assert.equal(r.node('gate.mjs', ['branch-on-base-tip']).status, 0);
});

test('prove-all is skipped without a verify CLI and required with one', () => {
  const r = workRepo();
  assert.match(r.gate('prove-all').stdout, /no verify CLI/);
  r.write('verify/cli', '#!/bin/sh\nexit 0\n');
  assert.equal(r.gate('prove-all').status, 1);
  r.node('receipt.mjs', ['run', 'prove', 'all', '--', process.execPath, '-e', '0']);
  assert.equal(r.gate('prove-all').status, 0);
});

test('receipts from a linked worktree land in the primary checkout', () => {
  const r = workRepo();
  const wt = join(r.dir, '..', r.dir.split('/').pop() + '-lane');
  r.git('worktree', 'add', '-q', wt, '-b', 'lane/1');
  r.node('receipt.mjs', ['run', 'check', 'check', '--', process.execPath, '-e', '0'], { cwd: wt });
  assert.ok(existsSync(join(r.dir, '.verify/receipts/lane/1/check--check.json')));
  assert.equal(r.node('gate.mjs', ['check-green'], { cwd: wt }).status, 0);
});

test('merge-ready passes only when every verifier passes', () => {
  const r = workRepo();
  assert.equal(r.gate('merge-ready').status, 1);
  r.check(0);
  r.verdict('PASS');
  mkdirSync(join(r.dir, '.afk/work'), { recursive: true });
  writeFileSync(join(r.dir, '.afk/work/HANDOFF.md'), '## Attention\n\nnone\n');
  const out = r.gate('merge-ready');
  assert.equal(out.status, 0, out.stdout);
  assert.equal(out.stdout.trim().split('\n').length, 6);
});

test('receipts-fresh follows every proof case that still exists', () => {
  const r = workRepo();
  r.write('scripts/floor-guard.config.json', JSON.stringify({ stacks: ['ts'], extra: { test: ['^verify/prove/'] } }));
  r.write('verify/prove/status-after-reload.mjs', 'assert(1);\n');
  r.write('verify/prove/old-case.mjs', 'assert(1);\n');
  r.commit('cases');
  const prove = (name, code = 0) => r.node('receipt.mjs', ['run', 'prove', name, '--', process.execPath, '-e', `process.exit(${code})`]);
  prove('status-after-reload');
  prove('old-case');
  assert.equal(r.gate('receipts-fresh').status, 0);
  prove('status-after-reload', 1);
  assert.match(r.gate('receipts-fresh').stdout, /prove status-after-reload exited 1/);
  prove('status-after-reload');
  r.write('src/app.ts', 'export const a = 3;\n');
  assert.match(r.gate('receipts-fresh').stdout, /prove old-case: changed since it ran: src\/app\.ts/);
  prove('status-after-reload');
  r.git('rm', '-q', 'verify/prove/old-case.mjs');
  assert.equal(r.gate('receipts-fresh').status, 0, 'a deleted case no longer counts');
});

test('moving product code into a test file still makes the verdict stale', () => {
  const r = workRepo();
  r.verdict('PASS');
  r.git('mv', 'src/app.ts', 'src/moved.test.ts');
  const out = r.gate('verdict-fresh');
  assert.equal(out.status, 1);
  assert.match(out.stdout, /src\/app\.ts/);
});

test('a command that cannot start records exit 2', () => {
  const r = workRepo();
  assert.equal(r.node('receipt.mjs', ['run', 'check', 'check', '--', 'no-such-command-xyz']).status, 2);
  assert.match(r.gate('check-green').stdout, /exited 2/);
});

test('a proof case with a two-part extension keeps its receipt', () => {
  const r = workRepo();
  r.write('verify/prove/status-reload.spec.ts', 'expect(1);\n');
  r.commit('case');
  r.node('receipt.mjs', ['run', 'prove', 'status-reload', '--', process.execPath, '-e', 'process.exit(1)']);
  assert.match(r.gate('receipts-fresh').stdout, /prove status-reload exited 1/);
});
