// review.mjs turns the records of a run into data for review.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeRepo } from './helpers.mjs';

const load = (file, name) => JSON.parse(readFileSync(file, 'utf8').replace(new RegExp(`^window\\.${name} = `), '').replace(/;\s*$/, ''));

test('the page data carries the handoff, the verdict with its evidence, receipts, gate and log', () => {
  const r = makeRepo({ config: { stacks: ['ts'] } });
  r.write('src/app.ts', 'export const a = 1;\n');
  r.commit('base');
  r.git('checkout', '-q', '-b', 'feature/0070-reload');
  const run = join(r.dir, '.afk', 'feature', '0070-reload');
  mkdirSync(join(run, 'evidence'), { recursive: true });
  writeFileSync(join(run, 'evidence', 'after-reload.png'), 'png');
  writeFileSync(join(run, 'evidence', 'walkthrough.webm'), 'webm');
  writeFileSync(join(run, 'report.json'), JSON.stringify({
    overall: 'PASS+NOTES',
    criteria: [{ criterion: 'Status survives reload', result: 'PASS', evidence: ['evidence/after-reload.png'], observed: 'still Confirmed' }],
    outside: ['the list page loads slower'],
  }));
  r.node('receipt.mjs', ['verdict', join(run, 'report.json')]);
  r.node('receipt.mjs', ['run', 'check', 'check', '--', process.execPath, '-e', '0']);
  writeFileSync(join(run, 'HANDOFF.md'), '# Status survives reload\n\n## Attention\n\n- none\n');
  writeFileSync(join(run, 'decisions.tsv'), 'ts\tphase\tdecision\twhy\tevidence\tresult\n2026-10-22T10:00:00Z\tbuild\tkept the status in the database\tit was in memory only\tsrc/app.ts\ttests green\n');

  const out = r.node('review.mjs', ['--class', 'merge-ready', '--base', 'main']);
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout.trim(), /\.afk\/review\.html#feature\/0070-reload$/);
  assert.ok(existsSync(join(r.dir, '.afk', 'review.html')));

  const data = load(join(run, 'review-data.js'), 'REVIEW');
  assert.equal(data.class, 'merge-ready');
  assert.match(data.handoff, /## Attention/);
  assert.deepEqual(data.verdict.criteria[0].evidence, ['feature/0070-reload/evidence/after-reload.png']);
  assert.equal(data.verdict.outside[0], 'the list page loads slower');
  assert.deepEqual(data.evidence.map((e) => e.type).sort(), ['image', 'video']);
  assert.equal(data.gate.find((g) => g.name === 'check-green').status, 'ok');
  assert.equal(data.receipts.find((x) => x.kind === 'check').fresh, true);
  assert.equal(data.decisions.rows[0][2], 'kept the status in the database');

  const runs = load(join(r.dir, '.afk', 'runs.js'), 'RUNS');
  assert.deepEqual(runs.map((x) => x.branch), ['feature/0070-reload']);
});

test('a run without records still produces a page', () => {
  const r = makeRepo();
  r.write('a.txt', 'a\n');
  r.commit('base');
  const out = r.node('review.mjs', ['--base', 'main']);
  assert.equal(out.status, 0, out.stderr);
  const data = load(join(r.dir, '.afk', 'main', 'review-data.js'), 'REVIEW');
  assert.equal(data.handoff, null);
  assert.equal(data.verdict, null);
});
