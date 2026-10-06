#!/usr/bin/env node
// What does the change in this checkout reach? Reads the graphify graph and the diff against a
// base ref, and prints every node that depends on a changed symbol, up to a depth.
//
//   node reach.mjs --base <ref> [--depth N] [--json] [--no-refresh]
//
// The graph is refreshed first, so it describes the code being judged. Exit 0 with the reach,
// exit 2 when there is no usable graph: no graphify, or the refresh failed. A caller that gets
// exit 2 reports "code graph stale, not used" and falls back to grep.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const base = arg('--base', 'origin/main');
const depth = Number(arg('--depth', '3'));
const asJson = process.argv.includes('--json');
const stale = (msg) => { console.error('reach: ' + msg); process.exit(2); };
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });

let top;
try { top = run('git', ['rev-parse', '--show-toplevel']).trim(); } catch { stale('not inside a git work tree'); }
process.chdir(top);

// The freshness gate. A worktree starts without a graph, so build one there. Otherwise update.
// Both are code-only and local.
const graphPath = 'graphify-out/graph.json';
if (!process.argv.includes('--no-refresh')) {
  try {
    if (existsSync(graphPath)) run('graphify', ['update', '.']);
    else run('graphify', ['extract', '.', '--code-only']);
  } catch (e) {
    stale('could not refresh the graph (' + String(e.message).split('\n')[0] + ')');
  }
}
if (!existsSync(graphPath)) stale('no graph at ' + graphPath);
const graph = JSON.parse(readFileSync(graphPath, 'utf8'));

// Changed lines per file, on the new side of the diff. Uncommitted work counts.
let mergeBase;
try { mergeBase = run('git', ['merge-base', base, 'HEAD']).trim(); } catch { stale('no merge base against ' + base); }
const changed = new Map();
const deleted = [];
let file = null;
for (const line of run('git', ['diff', '--unified=0', mergeBase, '--']).split('\n')) {
  if (line.startsWith('+++ ')) {
    file = line.slice(4) === '/dev/null' ? null : line.slice(4).replace(/^b\//, '');
    if (file && !changed.has(file)) changed.set(file, []);
  } else if (line.startsWith('--- ') && line.slice(4) !== '/dev/null') {
    deleted.push(line.slice(4).replace(/^a\//, ''));
  } else if (line.startsWith('@@') && file) {
    const m = /\+(\d+)(?:,(\d+))?/.exec(line);
    const start = Number(m[1]), count = m[2] === undefined ? 1 : Number(m[2]);
    for (let n = start; n < start + Math.max(count, 1); n++) changed.get(file).push(n);
  }
}
const gone = deleted.filter((f) => !changed.has(f));
// git diff cannot see a new file that is not staged yet. Count it as changed from its first line.
for (const f of run('git', ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean)) {
  if (!changed.has(f)) changed.set(f, [1]);
}

// Each changed line belongs to the last symbol that starts at or before it.
const lineOf = (n) => Number(/L(\d+)/.exec(n.source_location ?? '')?.[1] ?? 1);
const norm = (p) => (p ?? '').replace(/\\/g, '/');
const byFile = new Map();
for (const n of graph.nodes) {
  if (!n.source_file) continue;
  const f = norm(n.source_file);
  if (!byFile.has(f)) byFile.set(f, []);
  byFile.get(f).push(n);
}
// A changed method also changes the class that holds it and the file that holds the class, and
// other code often depends on those: a constructor that takes the class, a file that imports it.
const HOLDS = new Set(['contains', 'method']);
const holders = new Map();
for (const e of graph.links ?? graph.edges ?? []) {
  if (!HOLDS.has(e.relation)) continue;
  if (!holders.has(e.target)) holders.set(e.target, []);
  holders.get(e.target).push(e.source);
}
const seeds = new Map();
const unknown = [];
const allNodes = new Map(graph.nodes.map((n) => [n.id, n]));
const seedWithHolders = (n) => {
  const stack = [n.id];
  while (stack.length) {
    const id = stack.pop();
    if (seeds.has(id) || !allNodes.has(id)) continue;
    seeds.set(id, allNodes.get(id));
    stack.push(...(holders.get(id) ?? []));
  }
};
for (const [f, lines] of changed) {
  const nodes = (byFile.get(f) ?? []).sort((a, b) => lineOf(a) - lineOf(b));
  if (!nodes.length) { unknown.push(f); continue; }
  const fileNode = nodes.find((n) => n.label === f.split('/').pop());
  if (fileNode) seeds.set(fileNode.id, fileNode);
  for (const l of lines) {
    let owner = nodes[0];
    for (const n of nodes) if (lineOf(n) <= l) owner = n;
    seedWithHolders(owner);
  }
}

// Walk the edges backwards: whatever calls, imports or references a changed symbol is reached.
const DEPENDS = new Set(['calls', 'indirect_call', 'references', 'imports', 'imports_from', 'dynamic_import', 're_exports', 'inherits', 'extends', 'implements', 'uses', 'mixes_in', 'embeds', 'requires']);
const incoming = new Map();
for (const e of graph.links ?? graph.edges ?? []) {
  if (!DEPENDS.has(e.relation)) continue;
  if (!incoming.has(e.target)) incoming.set(e.target, []);
  incoming.get(e.target).push(e);
}
const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
const reached = new Map();
let frontier = [...seeds.keys()].map((id) => ({ id, hops: 0, inferred: false, via: null }));
const seen = new Set(seeds.keys());
while (frontier.length) {
  const next = [];
  for (const at of frontier) {
    if (at.hops >= depth) continue;
    for (const e of incoming.get(at.id) ?? []) {
      if (seen.has(e.source) || !nodeById.has(e.source)) continue;
      seen.add(e.source);
      const hit = { id: e.source, hops: at.hops + 1, inferred: at.inferred || e.confidence !== 'EXTRACTED', via: at.id, relation: e.relation };
      reached.set(e.source, hit);
      next.push(hit);
    }
  }
  frontier = next;
}

const describe = (id) => { const n = nodeById.get(id); return { id, label: n.label, file: norm(n.source_file), line: lineOf(n) }; };
const result = {
  commit: run('git', ['rev-parse', '--short', 'HEAD']).trim(),
  base: mergeBase.slice(0, 8),
  depth,
  changed: [...seeds.keys()].map(describe),
  reached: [...reached.values()].map((r) => ({ ...describe(r.id), hops: r.hops, inferred: r.inferred, via: nodeById.get(r.via).label, relation: r.relation })),
  notInGraph: unknown,
  deleted: gone,
};
if (asJson) { console.log(JSON.stringify(result, null, 2)); process.exit(0); }

const outside = result.reached.filter((r) => !changed.has(r.file));
console.log(`reach: code graph at ${result.commit}, against ${result.base}, depth ${depth}`);
console.log(`\nChanged symbols (${result.changed.length}):`);
for (const c of result.changed) console.log(`  ${c.label}  ${c.file}:L${c.line}`);
console.log(`\nReached outside the changed files (${outside.length}):`);
const files = [...new Set(outside.map((r) => r.file))].sort();
for (const f of files) {
  console.log(`  ${f}`);
  for (const r of outside.filter((x) => x.file === f)) {
    console.log(`    ${r.label}  L${r.line}  ${r.hops} hop${r.hops > 1 ? 's' : ''}, ${r.relation} ${r.via}${r.inferred ? ', inferred' : ''}`);
  }
}
if (result.notInGraph.length) {
  console.log(`\nChanged, with no symbols in the graph (${result.notInGraph.length}). Templates, styles, config and docs land here. Check these by grep:`);
  for (const f of result.notInGraph) console.log(`  ${f}`);
}
if (result.deleted.length) {
  console.log(`\nDeleted (${result.deleted.length}). The refreshed graph no longer knows them. Grep for their old names:`);
  for (const f of result.deleted) console.log(`  ${f}`);
}
console.log('\nThe graph follows calls, imports and references inside one language. It does not connect a frontend to the backend route it fetches, or a service to the one it calls over HTTP. Grep for the route or the message name across those boundaries.');
