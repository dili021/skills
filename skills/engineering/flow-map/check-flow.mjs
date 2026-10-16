#!/usr/bin/env node
// Validate the flow data inside a flow-map page: node check-flow.mjs <page.html>
// Exits 1 on any error. Warnings do not fail the check but are worth reading.
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("usage: node check-flow.mjs <page.html>"); process.exit(2); }
const html = readFileSync(file, "utf8");
const m = html.match(/<script type="application\/json" id="flow">([\s\S]*?)<\/script>/);
if (!m) { console.error("No <script type=\"application/json\" id=\"flow\"> block."); process.exit(1); }
let D;
try { D = JSON.parse(m[1]); } catch (e) { console.error("Flow JSON does not parse: " + e.message); process.exit(1); }

const errors = [], warnings = [];
const err = s => errors.push(s), warn = s => warnings.push(s);
const KINDS = ["data", "ctrl", "human"];
const lanes = D.lanes || [], stations = D.stations || {}, steps = D.steps || {};
const flags = D.flags || {}, situations = D.situations || [], decisions = D.decisions || [];

if (!D.title) err("title is missing");
if (!lanes.length) err("no lanes");
if (lanes.length > 5) warn(`${lanes.length} lanes; colours repeat after 5`);
const laneIds = new Set(lanes.map(l => l.id));
if (laneIds.size !== lanes.length) err("lane ids are not unique");

// Stations: lane, geometry, overlap, text length (mirrors the template's layout).
const VW = 1260, SW = 148, SH = 60;
let top = 20; const laneGeo = {};
for (const l of lanes) { const h = l.height || 190; laneGeo[l.id] = { top, h }; top += h + 25; }
const maxCol = Math.max(1, ...Object.values(stations).map(s => s.col || 0));
const pos = {};
for (const [id, s] of Object.entries(stations)) {
  if (!laneIds.has(s.lane)) { err(`station ${id}: unknown lane ${s.lane}`); continue; }
  if (typeof s.col !== "number") err(`station ${id}: col must be a number`);
  const g = laneGeo[s.lane];
  const p = { x: 90 + (s.col || 0) * (VW - 180) / maxCol, y: g.top + g.h / 2 + (s.dy || 0) };
  pos[id] = p;
  if (p.y - SH / 2 < g.top + 40 && p.x - SW / 2 < 280) warn(`station ${id}: may cover the lane label`);
  if (p.y - SH / 2 < g.top || p.y + SH / 2 > g.top + g.h) err(`station ${id}: sticks out of its lane (dy ${s.dy || 0})`);
  if ((s.name || "").length > 18) warn(`station ${id}: name "${s.name}" is over 18 characters and will be squeezed`);
  if ((s.sub || "").length > 20) warn(`station ${id}: sub "${s.sub}" is over 20 characters and will be squeezed`);
  if (!s.code || !s.code.length) warn(`station ${id}: no code reference`);
}
const ids = Object.keys(pos);
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
  const a = pos[ids[i]], b = pos[ids[j]];
  if (Math.abs(a.x - b.x) < SW + 6 && Math.abs(a.y - b.y) < SH + 6) err(`stations ${ids[i]} and ${ids[j]} overlap`);
}

// Steps.
const setVars = new Set(Object.values(steps).flatMap(s => Object.keys(s.set || {})));
const condVars = c => c === undefined ? [] : Array.isArray(c) ? c.flatMap(condVars) : [c.replace(/^!/, "")];
const nextTargets = n => !n ? [] : typeof n === "string" ? [n] : [n.then, n.else];
const outOf = s => [...(s.choices || []).map(c => c.next), ...nextTargets(s.next), ...(s.variants || []).flatMap(v => nextTargets(v.next))];
const start = D.start || Object.keys(steps)[0];
if (!steps[start]) err(`start step ${start} does not exist`);
for (const [id, s] of Object.entries(steps)) {
  if (!stations[s.from]) err(`step ${id}: unknown from station ${s.from}`);
  if (!stations[s.to]) err(`step ${id}: unknown to station ${s.to}`);
  if (!KINDS.includes(s.kind)) err(`step ${id}: kind must be one of ${KINDS.join(", ")}`);
  if (!s.title) err(`step ${id}: no title`);
  if (!s.text && !(s.variants || []).some(v => v.text)) warn(`step ${id}: no text`);
  if (!s.end && !s.next && !s.choices) err(`step ${id}: no next, no choices, not an end`);
  if (s.end && (s.next || s.choices)) err(`step ${id}: an end step has next or choices`);
  if (s.choices && s.next) err(`step ${id}: has both next and choices`);
  if (s.next && typeof s.next === "object" && (!s.next.then || !s.next.else)) err(`step ${id}: conditional next needs then and else`);
  for (const t of outOf(s)) if (!steps[t]) err(`step ${id}: next ${t} does not exist`);
  for (const f of s.flags || []) { const code = typeof f === "string" ? f : f.code; if (!flags[code]) err(`step ${id}: flag ${code} is not in flags`); }
  for (const f of s.unflag || []) if (!flags[f]) err(`step ${id}: unflag ${f} is not in flags`);
  const used = [...condVars(s.next && s.next.if), ...(s.variants || []).flatMap(v => condVars(v.if)), ...(s.flags || []).flatMap(f => condVars(f.if))];
  for (const v of used) if (!setVars.has(v)) err(`step ${id}: condition uses ${v}, which no step sets`);
  if (s.from !== s.to && s.edge && s.edge.length > 26) warn(`step ${id}: edge label "${s.edge}" is long`);
}

// Reachability from start, and every reachable step can reach an end.
const reach = new Set(), q = [start];
while (q.length) { const id = q.pop(); if (reach.has(id) || !steps[id]) continue; reach.add(id); outOf(steps[id]).forEach(t => q.push(t)); }
for (const id of Object.keys(steps)) if (!reach.has(id)) err(`step ${id}: unreachable from ${start}`);
const toEnd = new Set(Object.keys(steps).filter(id => steps[id].end));
if (!toEnd.size) err("no end step");
let grew = true;
while (grew) { grew = false; for (const [id, s] of Object.entries(steps)) if (!toEnd.has(id) && outOf(s).some(t => toEnd.has(t))) { toEnd.add(id); grew = true; } }
for (const id of reach) if (!toEnd.has(id)) err(`step ${id}: no path to an end`);

// Situations and decisions.
for (const s of situations) { if (!steps[s.step]) err(`situation "${s.title}": step ${s.step} does not exist`); if (!s.text) warn(`situation "${s.title}": no text`); }
const branchCount = Object.values(steps).filter(s => (s.choices || []).length > 1).length;
if (branchCount && !situations.length) warn("forks exist but no situations");
const decIds = new Set();
for (const d of decisions) {
  if (decIds.has(d.id)) err(`decision ${d.id}: id is not unique`); decIds.add(d.id);
  for (const k of ["title", "decision", "why", "src"]) if (!d[k]) err(`decision ${d.id}: ${k} is missing`);
  for (const k of ["plus", "cost", "risk"]) if (!Array.isArray(d[k])) err(`decision ${d.id}: ${k} must be a list`);
  if (!d.steps || !d.steps.length) err(`decision ${d.id}: no steps`);
  for (const s of d.steps || []) if (!steps[s]) err(`decision ${d.id}: step ${s} does not exist`);
  if (d.part && d.part !== "system" && !laneIds.has(d.part)) err(`decision ${d.id}: part ${d.part} is neither a lane id nor "system"`);
}
// Cross-references: every [[kind:id]] resolves, and a decision is never named in quotes without a link.
const texts = [["intro", D.intro]];
for (const [id, s] of Object.entries(steps)) {
  texts.push([`step ${id}`, s.text]);
  (s.variants || []).forEach((v, i) => texts.push([`step ${id} variant ${i}`, v.text]));
}
for (const [id, s] of Object.entries(stations)) texts.push([`station ${id}`, s.desc]);
for (const [code, f] of Object.entries(flags)) texts.push([`flag ${code}`, f.text]);
situations.forEach(s => texts.push([`situation "${s.title}"`, s.text]));
for (const d of decisions) {
  for (const k of ["decision", "why"]) texts.push([`decision ${d.id} ${k}`, d[k], d.id]);
  for (const k of ["plus", "cost", "risk"]) (d[k] || []).forEach(x => texts.push([`decision ${d.id} ${k}`, x, d.id]));
  for (const x of Array.isArray(d.src) ? d.src : [d.src]) {
    if (x && typeof x === "object" && (!x.label || !x.href)) err(`decision ${d.id}: a src link needs label and href`);
  }
}
const resolves = (kind, id) => kind === "dec" ? decIds.has(id) : kind === "step" ? !!steps[id] : !!stations[id];
const QUOTES = [["„", "\""], ["„", "“"], ["\"", "\""], ["“", "”"], ["«", "»"]];
for (const [where, t, own] of texts) {
  if (!t) continue;
  for (const m of t.matchAll(/\[\[(\w+):([\w-]+)(?:\|[^\]]+)?\]\]/g)) {
    if (!["dec", "step", "station"].includes(m[1])) err(`${where}: unknown reference kind ${m[1]}`);
    else if (!resolves(m[1], m[2])) err(`${where}: reference ${m[0]} points at nothing`);
  }
  const plain = t.replace(/\[\[[^\]]+\]\]/g, "").toLowerCase();
  for (const d of decisions) {
    if (d.id === own || !d.title) continue;
    const title = d.title.toLowerCase();
    if (QUOTES.some(([a, b]) => plain.includes(a + title + b))) err(`${where}: names decision "${d.title}" in quotes; write [[dec:${d.id}]] so it is a link`);
    else if (plain.includes(title)) warn(`${where}: mentions decision "${d.title}" by its title; if it is a reference, write [[dec:${d.id}]]`);
  }
}

const covered = new Set(decisions.flatMap(d => d.steps || []));
const bare = Object.keys(steps).filter(id => !covered.has(id) && !steps[id].end);

console.log(`${Object.keys(stations).length} stations, ${Object.keys(steps).length} steps, ${branchCount} forks, ${situations.length} situations, ${decisions.length} decisions`);
if (decisions.length) console.log(`steps without a decision (${bare.length}): ${bare.join(", ") || "none"}`);
warnings.forEach(w => console.log("warning: " + w));
errors.forEach(e => console.log("ERROR: " + e));
console.log(errors.length ? `FAIL: ${errors.length} error(s)` : "OK");
process.exit(errors.length ? 1 : 0);
