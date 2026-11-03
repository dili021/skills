// The walkthrough proxy and checklist, driven over real HTTP against a small stand-in app.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inject, startProxy, summarise, validate } from '../walkthrough.mjs';

const run = mkdtempSync(join(tmpdir(), 'walkthrough-'));
mkdirSync(join(run, 'evidence'), { recursive: true });
writeFileSync(join(run, 'evidence', 'shot.png'), 'png-bytes');
writeFileSync(join(run, '..', 'outside.txt'), 'secret');

const checklist = {
  title: 'feat/demo',
  notes: [{ id: 'D1', kind: 'question', text: 'Edit buttons follow the role' }],
  flows: [
    { id: 'F1', group: 'Demo', title: 'Save works', route: '/form', steps: ['Type a name', { do: 'Click Save', notes: [{ id: 'D2', kind: 'assumed', text: 'Save is disabled while busy' }] }], expect: ['Saved'], evidence: ['evidence/shot.png'] },
    { id: 'F2', title: 'Delete asks first', steps: ['Click Delete'], expect: ['A confirmation'] },
  ],
};
writeFileSync(join(run, 'walkthrough.json'), JSON.stringify(checklist));

// The stand-in app: an HTML page, a script, a redirect, and a WebSocket echo.
const app = http.createServer((req, res) => {
  if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "script-src 'none'" }); res.end('<!doctype html><html><head><title>App</title></head><body><app-root></app-root></body></html>'); return; }
  if (req.url === '/main.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end('console.log("</head>")'); return; }
  if (req.url === '/old') { res.writeHead(302, { location: `http://localhost:${app.address().port}/new` }); res.end(); return; }
  if (req.url === '/host') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end(req.headers.host); return; }
  res.writeHead(404); res.end();
});
app.on('upgrade', (req, socket) => {
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
  socket.on('data', (d) => socket.write(d));
  socket.on('end', () => socket.end());
});
await new Promise((ok) => app.listen(0, ok));
const appUrl = `http://localhost:${app.address().port}`;
const proxy = await startProxy({ app: appUrl, port: 0, runDir: run });
const base = `http://localhost:${proxy.address().port}`;
after(() => {
  for (const server of [proxy, app]) { server.closeAllConnections(); server.close(); }
});

const get = (path) => fetch(base + path, { redirect: 'manual' });

test('adds the panel to HTML pages and drops a CSP that would block it', async () => {
  const res = await get('/');
  const html = await res.text();
  assert.match(html, /<script src="\/__walkthrough\/overlay\.js" defer><\/script><\/head>/);
  assert.equal(res.headers.get('content-security-policy'), null);
  assert.equal(Number(res.headers.get('content-length')), Buffer.byteLength(html));
});

test('passes every other response through untouched', async () => {
  assert.equal(await (await get('/main.js')).text(), 'console.log("</head>")');
});

test('points redirects back at the proxy and sends the app its own Host', async () => {
  assert.equal((await get('/old')).headers.get('location'), '/new');
  assert.equal(await (await get('/host')).text(), new URL(appUrl).host);
});

test('serves the panel script, the checklist and the evidence', async () => {
  assert.match(await (await get('/__walkthrough/overlay.js')).text(), /customElements\.define\('dili-walkthrough'/);
  const data = await (await get('/__walkthrough/data')).json();
  assert.equal(data.walkthrough.flows.length, 2);
  assert.equal(data.results, null);
  const shot = await get('/__walkthrough/evidence/evidence/shot.png');
  assert.equal(shot.headers.get('content-type'), 'image/png');
  assert.equal(await shot.text(), 'png-bytes');
});

test('serves no file outside the run folder', async () => {
  assert.equal((await get('/__walkthrough/evidence/..%2Foutside.txt')).status, 404);
  assert.equal((await get('/__walkthrough/evidence/../outside.txt')).status, 404);
});

test('saves the results to the run folder, and the summary reads them', async () => {
  const body = { finished: true, flows: { F1: { result: 'fail', note: 'Save stayed grey' }, F2: { result: 'pass' } }, notes: { D1: { answer: 'overturn', note: 'add a can-flag' }, D2: { answer: 'keep' } } };
  const res = await fetch(base + '/__walkthrough/results', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(res.status, 200);
  const saved = JSON.parse(readFileSync(join(run, 'walkthrough-results.json'), 'utf8'));
  assert.equal(saved.finished, true);
  assert.equal(saved.flows.F1.note, 'Save stayed grey');

  const s = summarise(checklist, saved);
  assert.deepEqual(s.counts, { pass: 1, fail: 1, skip: 0, open: 0 });
  assert.deepEqual(s.notable.map((n) => n.id), ['F1']);
  assert.equal(s.notes.total, 2);
  assert.equal(s.notes.kept, 1);
  assert.deepEqual(s.notes.overturned.map((n) => [n.id, n.note]), [['D1', 'add a can-flag']]);
});

test('refuses results that are not JSON or have no flows', async () => {
  const post = (b) => fetch(base + '/__walkthrough/results', { method: 'POST', body: b });
  assert.equal((await post('nope')).status, 400);
  assert.equal((await post('{"finished":true}')).status, 400);
});

test('passes a WebSocket upgrade through to the app', async () => {
  const echo = await new Promise((ok, fail) => {
    const s = net.connect(proxy.address().port, 'localhost', () => {
      s.write('GET /ws HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
    });
    let got = '';
    s.on('data', (d) => {
      got += d.toString();
      if (got.includes('101') && !got.includes('ping')) s.write('ping');
      if (got.includes('ping')) { s.end(); ok(got); }
    });
    s.on('error', fail);
  });
  assert.match(echo, /101 Switching Protocols[\s\S]*ping/);
});

test('says when the app does not answer', async () => {
  const dead = await startProxy({ app: 'http://localhost:9', port: 0, runDir: run });
  const res = await fetch(`http://localhost:${dead.address().port}/`);
  dead.closeAllConnections();
  dead.close();
  assert.equal(res.status, 502);
  assert.match(await res.text(), /did not answer/);
});

test('check names every problem in a checklist', () => {
  assert.deepEqual(validate(checklist, run), []);
  const bad = {
    notes: [{ id: 'F1', kind: 'x', text: 'clashes with a flow id' }],
    flows: [
      { id: 'F1', title: 'ok', steps: ['a'], expect: ['b'], evidence: ['evidence/missing.png'] },
      { id: 'F1', title: '', steps: [{ notes: [] }], expect: [], route: 'no-slash' },
    ],
  };
  const problems = validate(bad, run);
  for (const want of ['evidence not found: evidence/missing.png', 'duplicate id', '"title"', 'step 1 must be', '"expect" must be a non-empty array', 'needs at least one "expect"', '"route" must start with /', 'note F1: duplicate id']) {
    assert.ok(problems.some((p) => p.includes(want)), `missing: ${want}\n${problems.join('\n')}`);
  }
  assert.deepEqual(validate({ flows: [] }, run), ['"flows" must be a non-empty array']);
});

test('an expect can sit on the step it follows instead of the flow', () => {
  const onSteps = { flows: [{ id: 'S1', title: 'Rename', steps: [{ do: 'Click Edit', expect: ['The dialog opens'] }, { do: 'Save', expect: ['The new name shows'] }] }] };
  assert.deepEqual(validate(onSteps, run), []);
  const none = { flows: [{ id: 'S2', title: 'Nothing to see', steps: ['Click', { do: 'Save', expect: [] }] }] };
  assert.deepEqual(validate(none, run), ['flow S2 step 2: "expect" must be a non-empty array of strings', 'flow S2: needs at least one "expect", on a step or on the flow']);
});

test('adds the script once, also to a page without a head', () => {
  assert.equal(inject('<p>hi</p>'), '<p>hi</p><script src="/__walkthrough/overlay.js" defer></script>');
  const once = inject('<head></head>');
  assert.equal(inject(once), once);
});
