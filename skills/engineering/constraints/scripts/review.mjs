#!/usr/bin/env node
// Builds the review page data for the current branch from the records, so the agent never copies
// their content into a message.
//
//   node scripts/review.mjs [--class <merge-ready|needs you|flawed|blocked>] [--base <branch>]
//
// Reads .afk/<branch>/HANDOFF.md, the verdict report, the receipts, .afk/<branch>/decisions.tsv
// and the files under .afk/<branch>/evidence/, runs the gate, and writes
// .afk/<branch>/review-data.js. Then it rewrites .afk/runs.js from every run found and copies
// review.html to .afk/. Open .afk/review.html#<branch> in a browser; it works from file://.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPatterns } from './floor-patterns.mjs';
import { baseFromHandoff, isProse, runGates, staleness } from './gate.mjs';
import { branchKey, listReceipts, primaryRoot, readReceipt, treeId } from './receipt.mjs';

const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const VIDEO = new Set(['.webm', '.mp4', '.mov']);
const typeOf = (p) => (IMAGE.has(extname(p).toLowerCase()) ? 'image' : VIDEO.has(extname(p).toLowerCase()) ? 'video' : 'file');
const readIf = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const asList = (e) => (Array.isArray(e) ? e : e ? [e] : []);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function tsv(text) {
  if (!text) return null;
  const [header, ...rows] = text.trim().split('\n').map((l) => l.split('\t'));
  return { header, rows };
}

export function buildReview({ runClass = null, base = baseFromHandoff() } = {}) {
  const root = primaryRoot();
  const branch = branchKey();
  const afk = join(root, '.afk');
  const runDir = join(afk, branch);
  // Paths in the page are relative to .afk/, where review.html lives, so they resolve on any OS.
  const rel = (p) => relative(afk, resolve(p)).split(sep).join('/');

  const tree = treeId();
  const patterns = loadPatterns();
  const fresh = (r) => staleness(r, tree, r.kind === 'check' ? (f) => !isProse(f) : patterns.isProduct) === null;

  const verdictReceipt = readReceipt('verdict', 'verdict');
  let verdict = null;
  if (verdictReceipt) {
    let report = {};
    try { report = JSON.parse(readFileSync(verdictReceipt.report, 'utf8')); } catch { /* report moved: show the receipt alone */ }
    const reportDir = dirname(verdictReceipt.report);
    verdict = {
      overall: verdictReceipt.overall,
      overrides: verdictReceipt.overrides ?? [],
      outside: report.outside ?? [],
      criteria: (report.criteria ?? []).map((c) => ({
        criterion: c.criterion, result: c.result, observed: c.observed ?? '',
        evidence: asList(c.evidence).map((p) => rel(resolve(reportDir, p))),
      })),
    };
  }

  const receipts = listReceipts();
  const evidence = new Map();
  const add = (p, from) => { if (!evidence.has(p)) evidence.set(p, { path: rel(p), type: typeOf(p), from, exists: existsSync(p) }); };
  for (const r of receipts) for (const p of r.evidence ?? []) add(p, `${r.kind} ${r.name}`);
  for (const p of walk(join(runDir, 'evidence'))) add(p, 'evidence folder');

  return {
    branch, base, class: runClass, at: new Date().toISOString(),
    gate: runGates('merge-ready', base),
    handoff: readIf(join(runDir, 'HANDOFF.md')),
    verdict,
    receipts: receipts.map((r) => ({ kind: r.kind, name: r.name, exit: r.exit, fresh: fresh(r), at: r.at, command: r.command })),
    evidence: [...evidence.values()],
    decisions: tsv(readIf(join(runDir, 'decisions.tsv'))),
  };
}

// Every run under .afk/ that has page data, newest first.
function listRuns(afk) {
  return walk(afk).filter((p) => p.endsWith(`${sep}review-data.js`)).map((p) => {
    const data = JSON.parse(readFileSync(p, 'utf8').replace(/^window\.REVIEW = /, '').replace(/;\s*$/, ''));
    return { branch: data.branch, class: data.class, at: data.at };
  }).sort((a, b) => b.at.localeCompare(a.at));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : undefined; };
  const data = buildReview({ runClass: opt('--class') ?? null, base: opt('--base') ?? baseFromHandoff() });
  const afk = join(primaryRoot(), '.afk');
  const runDir = join(afk, data.branch);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, 'review-data.js'), `window.REVIEW = ${JSON.stringify(data)};\n`);
  writeFileSync(join(afk, 'runs.js'), `window.RUNS = ${JSON.stringify(listRuns(afk))};\n`);
  copyFileSync(join(dirname(fileURLToPath(import.meta.url)), 'review.html'), join(afk, 'review.html'));
  console.log(`${join(afk, 'review.html')}#${data.branch}`);
}
