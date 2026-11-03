#!/usr/bin/env node
// A person's own pass over a finished run: a proxy in front of the running app adds a panel that
// lists the run's flows, each with its steps, what to see and the verifier's evidence. The
// checklist and the results live in .afk/<branch>/, which git ignores; the app's repo never changes.
//
//   node walkthrough.mjs check   [--run <dir>]                 validate <run>/walkthrough.json
//   node walkthrough.mjs serve   --app <url> [--port 4400] [--run <dir>]
//   node walkthrough.mjs results [--run <dir>]                 summarise <run>/walkthrough-results.json
//
// <run> defaults to .afk/<current branch> in the primary checkout, so it works from a worktree.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PREFIX = '/__walkthrough/';
const RESULTS = ['pass', 'fail', 'skip'];
const TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.webm': 'video/webm', '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8', '.log': 'text/plain; charset=utf-8', '.yml': 'text/plain; charset=utf-8',
  '.json': 'application/json', '.md': 'text/plain; charset=utf-8',
};

/** .afk/<branch> in the primary checkout (the first `git worktree list` entry). */
export function defaultRunDir(cwd = process.cwd()) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const primary = git('worktree', 'list', '--porcelain').split('\n')[0].replace(/^worktree /, '');
  return join(primary, '.afk', git('symbolic-ref', '--short', 'HEAD'));
}

const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null);

const nonEmpty = (s) => typeof s === 'string' && s.length > 0;

/** Every note in a checklist: the global list, then each flow's and each step's. */
export function allNotes(walkthrough) {
  const notes = [...(walkthrough.notes ?? [])];
  for (const f of walkthrough.flows ?? []) {
    notes.push(...(f.notes ?? []));
    for (const s of f.steps ?? []) if (typeof s === 'object' && s) notes.push(...(s.notes ?? []));
  }
  return notes;
}

/** Every problem with a checklist, as one line each; empty when it is valid. */
export function validate(walkthrough, runDir) {
  const problems = [];
  const flows = walkthrough?.flows;
  if (!Array.isArray(flows) || flows.length === 0) return ['"flows" must be a non-empty array'];
  const checkNotes = (notes, at) => {
    if (notes === undefined) return;
    if (!Array.isArray(notes)) { problems.push(`${at}: "notes" must be an array`); return; }
    notes.forEach((n, i) => {
      if (!nonEmpty(n?.id) || !nonEmpty(n?.kind) || !nonEmpty(n?.text)) problems.push(`${at}: note ${n?.id ?? i + 1} needs "id", "kind" and "text"`);
    });
  };
  checkNotes(walkthrough.notes, 'notes');
  const seen = new Set();
  flows.forEach((f, i) => {
    const at = `flow ${f?.id ?? i + 1}`;
    if (!nonEmpty(f?.id)) problems.push(`flow ${i + 1}: "id" must be a non-empty string`);
    else if (seen.has(f.id)) problems.push(`${at}: duplicate id`);
    else seen.add(f.id);
    if (!nonEmpty(f?.title)) problems.push(`${at}: "title" must be a non-empty string`);
    if (!Array.isArray(f?.steps) || f.steps.length === 0) problems.push(`${at}: "steps" must be a non-empty array`);
    else {
      f.steps.forEach((s, j) => {
        if (nonEmpty(s)) return;
        if (!nonEmpty(s?.do)) problems.push(`${at}: step ${j + 1} must be a string or { "do": "...", "notes": [...] }`);
        else checkNotes(s.notes, `${at} step ${j + 1}`);
      });
    }
    if (!Array.isArray(f?.expect) || f.expect.length === 0 || !f.expect.every(nonEmpty)) problems.push(`${at}: "expect" must be a non-empty array of strings`);
    if (f?.route !== undefined && (typeof f.route !== 'string' || !f.route.startsWith('/'))) problems.push(`${at}: "route" must start with /`);
    checkNotes(f?.notes, at);
    for (const p of f?.evidence ?? []) {
      if (typeof p !== 'string' || !existsSync(join(runDir, p))) problems.push(`${at}: evidence not found: ${p}`);
    }
  });
  const noteIds = new Set();
  for (const n of allNotes(walkthrough)) {
    if (!nonEmpty(n?.id)) continue;
    if (noteIds.has(n.id) || seen.has(n.id)) problems.push(`note ${n.id}: duplicate id`);
    noteIds.add(n.id);
  }
  return problems;
}

/**
 * Pass, fail, skip and open counts; the flows failed, skipped or commented; and the notes the
 * person overturned or commented on.
 */
export function summarise(walkthrough, results) {
  const byId = results?.flows ?? {};
  const counts = { pass: 0, fail: 0, skip: 0, open: 0 };
  const notable = [];
  for (const f of walkthrough.flows) {
    const r = byId[f.id];
    const result = RESULTS.includes(r?.result) ? r.result : 'open';
    counts[result]++;
    if (result === 'fail' || result === 'skip' || r?.note) notable.push({ id: f.id, title: f.title, result, note: r?.note ?? '' });
  }
  const answers = results?.notes ?? {};
  const notes = allNotes(walkthrough).map((n) => ({ id: n.id, kind: n.kind, text: n.text, answer: answers[n.id]?.answer ?? 'open', note: answers[n.id]?.note ?? '' }));
  const overturned = notes.filter((n) => n.answer === 'overturn' || n.note);
  return { finished: !!results?.finished, updatedAt: results?.updatedAt ?? null, counts, notable, notes: { total: notes.length, kept: notes.filter((n) => n.answer === 'keep').length, overturned } };
}

/** A file under `root`, or null when the path leaves it or does not exist. */
function inside(root, relPath) {
  const file = resolve(root, decodeURIComponent(relPath));
  if (file !== root && !file.startsWith(root + sep)) return null;
  return existsSync(file) && statSync(file).isFile() ? file : null;
}

function readBody(req, limit = 1_000_000) {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { fail(new Error('body too large')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

/** The panel's own routes: its script, the checklist with saved results, saving, evidence files. */
async function own(req, res, runDir) {
  const path = req.url.slice(PREFIX.length).split('?')[0];
  const send = (status, body, type = 'application/json') => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  if (path === 'overlay.js') return send(200, readFileSync(join(HERE, 'overlay.js')), 'text/javascript; charset=utf-8');
  if (path === 'data') {
    return send(200, { walkthrough: readJson(join(runDir, 'walkthrough.json')), results: readJson(join(runDir, 'walkthrough-results.json')) });
  }
  if (path === 'results' && req.method === 'POST') {
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return send(400, { error: 'not JSON' }); }
    if (typeof body !== 'object' || body === null || typeof body.flows !== 'object') return send(400, { error: '"flows" must be an object' });
    const saved = { finished: !!body.finished, updatedAt: new Date().toISOString(), flows: body.flows, notes: body.notes ?? {} };
    writeFileSync(join(runDir, 'walkthrough-results.json'), JSON.stringify(saved, null, 2) + '\n');
    return send(200, { ok: true, updatedAt: saved.updatedAt });
  }
  if (path.startsWith('evidence/')) {
    const file = inside(runDir, path.slice('evidence/'.length));
    if (!file) return send(404, { error: 'not found' });
    return send(200, readFileSync(file), TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream');
  }
  return send(404, { error: 'not found' });
}

/** Adds the panel's script to an HTML page, before </head> when there is one. */
export function inject(html) {
  const tag = `<script src="${PREFIX}overlay.js" defer></script>`;
  if (html.includes(tag)) return html;
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${tag}</head>`) : html + tag;
}

/**
 * Proxies `app` on `port` and adds the panel to every HTML page. Asks the app for uncompressed
 * bodies so HTML can be edited, keeps the app's own Host header for dev servers that check it,
 * points redirects back at the proxy and passes WebSocket upgrades (live reload) straight through.
 */
export function startProxy({ app, port = 4400, runDir }) {
  const target = new URL(app);
  const server = http.createServer(async (req, res) => {
    if (req.url.startsWith(PREFIX)) {
      try { await own(req, res, runDir); } catch (e) { res.writeHead(500); res.end(String(e.message)); }
      return;
    }
    const headers = { ...req.headers, host: target.host, 'accept-encoding': 'identity' };
    const upstream = http.request({ hostname: target.hostname, port: target.port, method: req.method, path: req.url, headers }, (up) => {
      const out = { ...up.headers };
      if (out.location?.startsWith(target.origin)) out.location = out.location.slice(target.origin.length) || '/';
      if (!String(out['content-type'] ?? '').includes('text/html')) {
        res.writeHead(up.statusCode, out);
        up.pipe(res);
        return;
      }
      const chunks = [];
      up.on('data', (c) => chunks.push(c));
      up.on('end', () => {
        const body = Buffer.from(inject(Buffer.concat(chunks).toString('utf8')), 'utf8');
        delete out['content-security-policy'];
        // The edited page goes out whole, with its new length, whatever framing the app used.
        delete out['transfer-encoding'];
        out['content-length'] = String(body.length);
        res.writeHead(up.statusCode, out);
        res.end(body);
      });
    });
    upstream.on('error', (e) => {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`walkthrough: the app at ${app} did not answer (${e.code ?? e.message}). Is it running?`);
    });
    req.pipe(upstream);
  });
  server.on('upgrade', (req, socket, head) => {
    const up = net.connect(Number(target.port) || 80, target.hostname, () => {
      const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        const [name, value] = [req.rawHeaders[i], req.rawHeaders[i + 1]];
        lines.push(`${name}: ${name.toLowerCase() === 'host' ? target.host : value}`);
      }
      up.write(lines.join('\r\n') + '\r\n\r\n');
      if (head.length) up.write(head);
      up.pipe(socket);
      socket.pipe(up);
    });
    // Either side closing closes the other, so no half-open socket outlives the page.
    up.on('error', () => socket.destroy());
    socket.on('error', () => up.destroy());
    up.on('close', () => socket.destroy());
    socket.on('close', () => up.destroy());
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, () => ok(server));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...args] = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : undefined; };
  const usage = () => {
    console.error('usage: walkthrough.mjs check|results [--run <dir>] | serve --app <url> [--port 4400] [--run <dir>]');
    process.exit(2);
  };
  let runDir;
  try { runDir = resolve(opt('--run') ?? defaultRunDir()); } catch { console.error('walkthrough: not in a git checkout on a branch; pass --run <dir>'); process.exit(2); }
  const file = join(runDir, 'walkthrough.json');
  if (cmd === 'check') {
    const walkthrough = readJson(file);
    if (!walkthrough) { console.error(`walkthrough: no ${file}`); process.exit(1); }
    const problems = validate(walkthrough, runDir);
    for (const p of problems) console.error(`walkthrough: ${p}`);
    if (problems.length) process.exit(1);
    const groups = new Set(walkthrough.flows.map((f) => f.group ?? ''));
    console.log(`walkthrough: ${walkthrough.flows.length} flows in ${groups.size} groups, valid`);
  } else if (cmd === 'serve') {
    const app = opt('--app');
    if (!app) usage();
    if (!existsSync(file)) { console.error(`walkthrough: no ${file}; write it first`); process.exit(1); }
    const port = Number(opt('--port') ?? 4400);
    startProxy({ app, port, runDir }).then(
      () => console.log(`walkthrough: http://localhost:${port} (the app at ${app}, with the panel: hover its button to look, click to pin, Alt+W)`),
      (e) => { console.error(`walkthrough: could not listen on ${port}: ${e.code ?? e.message}`); process.exit(2); },
    );
  } else if (cmd === 'results') {
    const walkthrough = readJson(file);
    if (!walkthrough) { console.error(`walkthrough: no ${file}`); process.exit(1); }
    const s = summarise(walkthrough, readJson(join(runDir, 'walkthrough-results.json')));
    console.log(`walkthrough: ${s.finished ? 'finished' : 'not finished'}; pass ${s.counts.pass}, fail ${s.counts.fail}, skip ${s.counts.skip}, open ${s.counts.open}`);
    for (const n of s.notable) console.log(`  ${n.result.padEnd(4)} ${n.id} ${n.title}${n.note ? `: ${n.note}` : ''}`);
    console.log(`notes: ${s.notes.total}, kept ${s.notes.kept}, overturned or commented ${s.notes.overturned.length}`);
    for (const n of s.notes.overturned) console.log(`  ${n.answer.padEnd(8)} ${n.id} [${n.kind}] ${n.text}${n.note ? `: ${n.note}` : ''}`);
  } else usage();
}
