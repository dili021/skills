#!/usr/bin/env node
// Local verifiers: each one reads records (receipts, git, the handoff note) and says whether a
// claim about the work holds. No git host is involved.
//
//   node scripts/gate.mjs <verifier> [--base <branch>]
//
// Verifiers: check-green, receipts-fresh, prove-all, verdict-fresh, branch-on-base-tip,
// handoff-complete, and merge-ready, which runs all of them. Exit 0 when every verifier run
// passes, 1 when one fails, 2 when one could not run. Without --base, the base branch comes from
// the "Base branch" line of docs/agents/handoff.md.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPatterns } from './floor-patterns.mjs';
import { branchKey, changedFiles, listReceipts, primaryRoot, readReceipt, treeId, worktreeTop } from './receipt.mjs';

const ok = (name, note) => ({ name, status: 'ok', reasons: note ? [note] : [] });
const fail = (name, ...reasons) => ({ name, status: 'fail', reasons });
const error = (name, reason) => ({ name, status: 'error', reasons: [reason] });

// Why a receipt no longer covers the current content, or null when it does. `matters` picks the
// changed files that count: for a proof or a verdict that is product code, so changes to tests,
// docs or checker config alone keep it; for check it is everything but Markdown.
export const isProse = (f) => /\.md$/i.test(f);
export function staleness(receipt, tree, matters) {
  const files = changedFiles(receipt.tree, tree);
  if (files === null) return 'its tree is gone from git, run it again';
  const relevant = files.filter(matters);
  if (relevant.length === 0) return null;
  const shown = relevant.slice(0, 5).join(', ') + (relevant.length > 5 ? `, and ${relevant.length - 5} more` : '');
  return `changed since it ran: ${shown}`;
}

export function baseFromHandoff() {
  const p = join(primaryRoot(), 'docs', 'agents', 'handoff.md');
  if (!existsSync(p)) return null;
  const m = readFileSync(p, 'utf8').match(/\*\*Base branch:\*\*\s*`?([^\s`<]+)`?/);
  return m ? m[1] : null;
}

const VERIFIERS = {
  'check-green': ({ tree, patterns }) => {
    const r = readReceipt('check', 'check');
    if (!r) return fail('check-green', 'no check receipt on this branch; run `check`');
    if (r.exit !== 0) return fail('check-green', `the last check exited ${r.exit}`);
    const why = staleness(r, tree, (f) => !isProse(f));
    return why ? fail('check-green', `the last green check is stale: ${why}`) : ok('check-green');
  },

  'receipts-fresh': ({ tree, patterns }) => {
    // A receipt for a case that no longer exists in verify/prove/ was renamed or deleted: skip it.
    const prove = join(worktreeTop(), 'verify', 'prove');
    // A case is a file named <case> or <case>.<any extensions> (status-reload.spec.ts), or a directory.
    const entries = existsSync(prove) ? readdirSync(prove) : null;
    const exists = (name) => entries.some((e) => e === name || e.startsWith(name + '.'));
    const proofs = listReceipts().filter((r) => r.kind === 'prove' && (r.name === 'all' || !entries || exists(r.name)));
    if (proofs.length === 0) return ok('receipts-fresh', 'no proof receipts on this branch');
    const reasons = [];
    for (const r of proofs) {
      if (r.exit !== 0) reasons.push(`prove ${r.name} exited ${r.exit}`);
      const why = staleness(r, tree, patterns.isProduct);
      if (why) reasons.push(`prove ${r.name}: ${why}`);
    }
    return reasons.length ? fail('receipts-fresh', ...reasons) : ok('receipts-fresh');
  },

  'prove-all': ({ tree, patterns }) => {
    if (!existsSync(join(worktreeTop(), 'verify', 'cli'))) return ok('prove-all', 'no verify CLI in this repo');
    const r = readReceipt('prove', 'all');
    if (!r) return fail('prove-all', 'no receipt for the full proof run; run `node scripts/receipt.mjs run prove all -- verify/cli prove`');
    if (r.exit !== 0) return fail('prove-all', `the full proof run exited ${r.exit}`);
    const why = staleness(r, tree, patterns.isProduct);
    return why ? fail('prove-all', why) : ok('prove-all');
  },

  'verdict-fresh': ({ tree, patterns }) => {
    const r = readReceipt('verdict', 'verdict');
    if (!r) return fail('verdict-fresh', 'no verdict receipt on this branch');
    if (r.overall === 'FAIL') return fail('verdict-fresh', 'the last verdict is FAIL');
    const why = staleness(r, tree, patterns.isProduct);
    return why ? fail('verdict-fresh', why) : ok('verdict-fresh', r.overall);
  },

  'branch-on-base-tip': ({ base }) => {
    if (!base) return error('branch-on-base-tip', 'no base branch: pass --base or fill "Base branch" in docs/agents/handoff.md');
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', base, 'HEAD'], { stdio: 'ignore' });
      return ok('branch-on-base-tip');
    } catch (e) {
      return e.status === 1
        ? fail('branch-on-base-tip', `${base} has commits this branch does not; merge ${base} in and run check again`)
        : error('branch-on-base-tip', `git could not compare with ${base}`);
    }
  },

  'handoff-complete': () => {
    const branch = branchKey();
    const note = join(primaryRoot(), '.afk', branch, 'HANDOFF.md');
    if (!existsSync(note)) return fail('handoff-complete', `no handoff note at .afk/${branch}/HANDOFF.md`);
    const attention = attentionSection(readFileSync(note, 'utf8'));
    if (attention === null) return fail('handoff-complete', 'the handoff note has no Attention section');
    const reasons = [];
    const flat = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    for (const o of readReceipt('verdict', 'verdict')?.overrides ?? []) {
      if (!flat(attention).includes(flat(o.criterion))) {
        reasons.push(`Attention does not name the ${o.as} override of "${o.criterion}"`);
      }
    }
    for (const r of listReceipts()) {
      for (const p of r.evidence ?? []) if (!existsSync(p)) reasons.push(`evidence of ${r.kind} ${r.name} is missing: ${p}`);
    }
    return reasons.length ? fail('handoff-complete', ...reasons) : ok('handoff-complete');
  },
};

// The text under the first heading that names Attention, up to the next heading of the same or a
// higher level. Null when there is no such heading.
export function attentionSection(markdown) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => /^#{1,6}\s+.*attention/i.test(l));
  if (start === -1) return null;
  const level = lines[start].match(/^#+/)[0].length;
  const end = lines.findIndex((l, i) => i > start && /^#{1,6}\s/.test(l) && l.match(/^#+/)[0].length <= level);
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n');
}

const ORDER = ['check-green', 'receipts-fresh', 'prove-all', 'verdict-fresh', 'branch-on-base-tip', 'handoff-complete'];

// Runs the named verifier, or all of them for merge-ready, and returns one result per verifier.
export function runGates(name, base = baseFromHandoff()) {
  const names = name === 'merge-ready' ? ORDER : [name];
  let ctx;
  try { ctx = { tree: treeId(), patterns: loadPatterns(), base }; }
  catch (e) { return names.map((n) => error(n, e.stderr?.toString().trim() || e.message)); }
  return names.map((n) => {
    try { return VERIFIERS[n](ctx); }
    catch (e) { return error(n, e.stderr?.toString().trim() || e.message); }
  });
}

export function exitCode(results) {
  if (results.some((r) => r.status === 'fail')) return 1;
  if (results.some((r) => r.status === 'error')) return 2;
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const name = args[0];
  if (!name || (name !== 'merge-ready' && !VERIFIERS[name])) {
    console.error(`usage: gate.mjs <${[...ORDER, 'merge-ready'].join('|')}> [--base <branch>]`);
    process.exit(2);
  }
  const i = args.indexOf('--base');
  const results = runGates(name, i > -1 ? args[i + 1] : baseFromHandoff());
  for (const r of results) {
    const label = { ok: 'ok   ', fail: 'FAIL ', error: 'ERROR' }[r.status];
    console.log(`${label} ${r.name}${r.reasons.length ? ': ' + r.reasons.join('; ') : ''}`);
  }
  process.exit(exitCode(results));
}
