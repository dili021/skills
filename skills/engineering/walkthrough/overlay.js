// The walkthrough panel. walkthrough.mjs adds this script to every page of the app it proxies.
// It lives in a shadow root, so the app's styles and the panel's never meet, and it talks only to
// the proxy's /__walkthrough/ routes. Hovering its button opens it, a click or Alt+W pins it, Esc closes it.
(() => {
  if (customElements.get('dili-walkthrough')) return;
  const API = '/__walkthrough/';
  const STORE = 'dili-walkthrough:';
  const RESULT_LABELS = { pass: 'Pass', fail: 'Fail', skip: 'Skip' };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const local = {
    get: (k, fallback) => { try { return JSON.parse(localStorage.getItem(STORE + k)) ?? fallback; } catch { return fallback; } },
    set: (k, v) => { try { localStorage.setItem(STORE + k, JSON.stringify(v)); } catch { /* storage full or blocked: the server copy still saves */ } },
  };

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .launch { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; display: flex; align-items: center; gap: 8px;
      padding: 8px 14px; border-radius: 999px; border: 0; background: #1f2937; color: #fff; font-size: 13px; font-weight: 600;
      box-shadow: 0 6px 20px rgba(0,0,0,.25); cursor: pointer; }
    .launch b { background: #374151; border-radius: 999px; padding: 1px 8px; font-weight: 600; }
    .panel { position: fixed; top: 0; right: 0; bottom: 0; width: 420px; max-width: 100vw; z-index: 2147483001; display: flex; flex-direction: column;
      background: #fff; color: #111827; border-left: 1px solid #e5e7eb; box-shadow: -8px 0 30px rgba(0,0,0,.12); font-size: 13px; line-height: 1.45; }
    header { padding: 12px 14px 0; border-bottom: 1px solid #e5e7eb; }
    .top { display: flex; align-items: center; gap: 8px; }
    .panel[hidden] { display: none; }
    .panel.peek { box-shadow: -12px 0 40px rgba(0,0,0,.18); }
    .launch[aria-pressed="true"] { background: #2563eb; }
    .pin { border: 1px solid #d1d5db; background: #fff; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .pin[aria-pressed="true"] { background: #2563eb; border-color: #2563eb; color: #fff; }
    .top h1 { flex: 1; margin: 0; font-size: 14px; font-weight: 700; }
    .top small { color: #6b7280; font-weight: 500; }
    .x { border: 0; background: #f3f4f6; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; font-size: 14px; }
    .bar { height: 4px; background: #f3f4f6; border-radius: 2px; margin: 10px 0 0; overflow: hidden; display: flex; }
    .bar i { display: block; height: 100%; }
    .tabs { display: flex; gap: 4px; margin-top: 8px; }
    .tabs button { border: 0; background: none; padding: 8px 10px; font-size: 13px; font-weight: 600; color: #6b7280; border-bottom: 2px solid transparent; cursor: pointer; }
    .tabs button[aria-selected="true"] { color: #111827; border-bottom-color: #2563eb; }
    main { flex: 1; overflow: auto; padding: 10px 14px 14px; }
    h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; margin: 14px 0 6px; }
    .flow { border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 8px; overflow: hidden; }
    .flow > button.head { width: 100%; display: flex; gap: 8px; align-items: flex-start; text-align: left; border: 0; background: #fff; padding: 10px 12px; cursor: pointer; font-size: 13px; }
    .flow > button.head:hover { background: #f9fafb; }
    .dot { flex: none; width: 10px; height: 10px; border-radius: 50%; margin-top: 4px; background: #d1d5db; }
    .dot.pass { background: #16a34a; } .dot.fail { background: #dc2626; } .dot.skip { background: #9ca3af; }
    .id { color: #6b7280; font-variant-numeric: tabular-nums; margin-right: 4px; }
    .body { padding: 0 12px 12px; border-top: 1px solid #f3f4f6; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 10px 0 4px; color: #374151; }
    .meta code { background: #f3f4f6; border-radius: 4px; padding: 1px 5px; font-size: 12px; }
    .btn { border: 1px solid #d1d5db; background: #fff; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600; cursor: pointer; color: #111827; }
    .btn:hover { background: #f9fafb; }
    .link { border: 0; background: none; color: #2563eb; cursor: pointer; font-size: 12px; padding: 0; text-decoration: underline; }
    ol, ul { margin: 4px 0 8px; padding-left: 20px; }
    li { margin: 3px 0; }
    .sub { font-weight: 600; margin: 8px 0 2px; }
    .ev { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 6px 0; }
    .ev a { display: block; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; background: #f9fafb; }
    .ev img, .ev video { display: block; width: 100%; height: 72px; object-fit: cover; object-position: top; }
    .ev a.file { padding: 6px; font-size: 11px; color: #374151; height: 72px; overflow: hidden; word-break: break-all; text-decoration: none; }
    .results { display: flex; gap: 6px; margin-top: 10px; }
    .results button { flex: 1; border: 1px solid #d1d5db; background: #fff; border-radius: 6px; padding: 6px; font-weight: 600; cursor: pointer; font-size: 12px; }
    .results button[aria-pressed="true"][data-result="pass"] { background: #16a34a; border-color: #16a34a; color: #fff; }
    .results button[aria-pressed="true"][data-result="fail"] { background: #dc2626; border-color: #dc2626; color: #fff; }
    .results button[aria-pressed="true"][data-result="skip"] { background: #6b7280; border-color: #6b7280; color: #fff; }
    textarea { width: 100%; min-height: 48px; margin-top: 6px; border: 1px solid #d1d5db; border-radius: 6px; padding: 6px 8px; font-size: 12px; resize: vertical; }
    .note { border-left: 3px solid #f59e0b; background: #fffbeb; border-radius: 0 6px 6px 0; padding: 6px 8px; margin: 6px 0; }
    .note.keep { border-left-color: #16a34a; background: #f0fdf4; }
    .note.overturn { border-left-color: #dc2626; background: #fef2f2; }
    .kind { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #92400e; margin-right: 6px; }
    .ref { color: #6b7280; font-size: 11px; margin-left: 4px; }
    .nbtns { display: flex; gap: 6px; margin-top: 6px; }
    .nbtns button { border: 1px solid #d1d5db; background: #fff; border-radius: 6px; padding: 2px 8px; font-size: 11px; font-weight: 600; cursor: pointer; }
    .nbtns button[aria-pressed="true"][data-answer="keep"] { background: #16a34a; border-color: #16a34a; color: #fff; }
    .nbtns button[aria-pressed="true"][data-answer="overturn"] { background: #dc2626; border-color: #dc2626; color: #fff; }
    .empty { color: #6b7280; }
    footer { border-top: 1px solid #e5e7eb; padding: 10px 14px; display: flex; align-items: center; gap: 10px; }
    footer .status { flex: 1; color: #6b7280; font-size: 12px; }
    footer .finish { background: #2563eb; border: 0; color: #fff; border-radius: 6px; padding: 8px 14px; font-weight: 700; cursor: pointer; }
  `;

  class Walkthrough extends HTMLElement {
    constructor() {
      super();
      this.root = this.attachShadow({ mode: 'open' });
      this.data = null;
      this.results = { flows: {}, notes: {}, finished: false };
      // Pinned stays open until unpinned. Peek is the hover preview: it opens over the launcher
      // and closes once the pointer has left both the launcher and the panel.
      this.pinned = local.get('pinned', false);
      this.peek = false;
      this.hideTimer = null;
      this.tab = local.get('tab', 'flows');
      this.expanded = new Set(local.get('expanded', []));
      this.status = '';
      this.timer = null;
    }

    async connectedCallback() {
      // Built once; later renders replace only the panel's content, so the element under the
      // pointer survives and hover keeps working.
      this.root.innerHTML = `<style>${CSS}</style><button class="launch" data-act="pin"></button><div class="panel" role="complementary" aria-label="Walkthrough" hidden></div>`;
      this.launcher = this.root.querySelector('.launch');
      this.panel = this.root.querySelector('.panel');
      for (const el of [this.launcher, this.panel]) {
        el.addEventListener('pointerenter', () => this.showPeek());
        el.addEventListener('pointerleave', () => this.hidePeekSoon());
      }
      this.root.addEventListener('click', (e) => this.onClick(e));
      this.root.addEventListener('input', (e) => this.onInput(e));
      window.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'w' || e.key === 'W')) { e.preventDefault(); this.setPinned(!this.pinned); }
        else if (e.key === 'Escape' && (this.pinned || this.peek)) this.close();
      });
      try {
        const res = await fetch(API + 'data', { cache: 'no-store' });
        const body = await res.json();
        this.data = body.walkthrough;
        const saved = body.results ?? local.get('results:' + location.host, null);
        if (saved) this.results = { flows: saved.flows ?? {}, notes: saved.notes ?? {}, finished: !!saved.finished };
      } catch {
        this.status = 'Could not load the checklist from the proxy.';
      }
      this.render();
    }

    get flows() { return this.data?.flows ?? []; }
    get done() { return this.flows.filter((f) => this.results.flows[f.id]?.result).length; }

    get visible() { return !!this.data && (this.pinned || this.peek); }

    setPinned(pinned) {
      this.pinned = pinned;
      this.peek = false;
      local.set('pinned', pinned);
      this.render();
    }

    close() {
      this.pinned = false;
      this.peek = false;
      local.set('pinned', false);
      this.render();
    }

    showPeek() {
      clearTimeout(this.hideTimer);
      if (this.pinned || this.peek || !this.data) return;
      this.peek = true;
      this.render();
    }

    /** A short delay, so moving from the launcher to the panel does not close it on the way. */
    hidePeekSoon() {
      clearTimeout(this.hideTimer);
      if (this.pinned) return;
      this.hideTimer = setTimeout(() => {
        // Typing a note keeps the preview open, so a stray pointer never loses the text box.
        if (this.pinned || this.root.activeElement?.tagName === 'TEXTAREA') return;
        this.peek = false;
        this.render();
      }, 250);
    }

    save(finished = this.results.finished) {
      this.results.finished = finished;
      local.set('results:' + location.host, this.results);
      clearTimeout(this.timer);
      this.status = 'Saving…';
      this.renderStatus();
      this.timer = setTimeout(async () => {
        try {
          const res = await fetch(API + 'results', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(this.results) });
          if (!res.ok) throw new Error(String(res.status));
          this.status = finished ? 'Finished and saved. Tell the agent you are done.' : `Saved ${new Date().toLocaleTimeString()}`;
        } catch {
          this.status = 'Not saved to disk (the proxy did not answer). Kept in this browser.';
        }
        this.renderStatus();
      }, finished ? 0 : 400);
    }

    /** Opens a route inside a single-page app without a reload, so the app keeps its state. */
    go(route) {
      history.pushState(null, '', route);
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    }

    onClick(e) {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const { act, id } = el.dataset;
      if (act === 'pin') this.setPinned(!this.pinned);
      else if (act === 'close') this.close();
      else if (act === 'tab') { this.tab = el.dataset.tab; local.set('tab', this.tab); this.render(); }
      else if (act === 'expand') {
        if (this.expanded.has(id)) this.expanded.delete(id); else this.expanded.add(id);
        local.set('expanded', [...this.expanded]);
        this.render();
      } else if (act === 'go') this.go(el.dataset.route);
      else if (act === 'reload') location.assign(el.dataset.route);
      else if (act === 'result') {
        const current = this.results.flows[id] ?? {};
        const result = current.result === el.dataset.result ? undefined : el.dataset.result;
        this.results.flows[id] = { ...current, result, at: new Date().toISOString() };
        this.save();
        this.render();
      } else if (act === 'answer') {
        const current = this.results.notes[id] ?? {};
        const answer = current.answer === el.dataset.answer ? undefined : el.dataset.answer;
        this.results.notes[id] = { ...current, answer };
        this.save();
        this.render();
      } else if (act === 'finish') {
        this.save(true);
      }
    }

    onInput(e) {
      const el = e.target;
      if (el.dataset.flowNote !== undefined) {
        const id = el.dataset.flowNote;
        this.results.flows[id] = { ...(this.results.flows[id] ?? {}), note: el.value };
        this.save();
      } else if (el.dataset.noteComment !== undefined) {
        const id = el.dataset.noteComment;
        this.results.notes[id] = { ...(this.results.notes[id] ?? {}), note: el.value };
        this.save();
      }
    }

    note(n) {
      const r = this.results.notes[n.id] ?? {};
      const pressed = (a) => String(r.answer === a);
      return `<div class="note ${esc(r.answer ?? '')}">
        <span class="kind">${esc(n.kind)}</span>${esc(n.text)}${n.ref ? `<span class="ref">${esc(n.ref)}</span>` : ''}
        <div class="nbtns">
          <button data-act="answer" data-id="${esc(n.id)}" data-answer="keep" aria-pressed="${pressed('keep')}">Keep</button>
          <button data-act="answer" data-id="${esc(n.id)}" data-answer="overturn" aria-pressed="${pressed('overturn')}">Overturn</button>
        </div>
        ${r.answer === 'overturn' || r.note ? `<textarea data-note-comment="${esc(n.id)}" placeholder="What instead, and why">${esc(r.note ?? '')}</textarea>` : ''}
      </div>`;
    }

    evidence(paths) {
      if (!paths?.length) return '';
      const items = paths.map((p) => {
        const url = API + 'evidence/' + p.split('/').map(encodeURIComponent).join('/');
        if (/\.(png|jpe?g|gif|webp|svg)$/i.test(p)) return `<a href="${url}" target="_blank" rel="noopener" title="${esc(p)}"><img src="${url}" alt="${esc(p)}" loading="lazy"></a>`;
        if (/\.(webm|mp4)$/i.test(p)) return `<a href="${url}" target="_blank" rel="noopener" title="${esc(p)}"><video src="${url}" muted preload="metadata"></video></a>`;
        return `<a class="file" href="${url}" target="_blank" rel="noopener">${esc(p.split('/').pop())}</a>`;
      });
      return `<div class="sub">The verifier's evidence</div><div class="ev">${items.join('')}</div>`;
    }

    flow(f) {
      const r = this.results.flows[f.id] ?? {};
      const open = this.expanded.has(f.id);
      const steps = f.steps.map((s) => (typeof s === 'string'
        ? `<li>${esc(s)}</li>`
        : `<li>${esc(s.do)}${(s.notes ?? []).map((n) => this.note(n)).join('')}</li>`)).join('');
      const body = open ? `<div class="body">
        <div class="meta">
          ${f.as ? `<span>Sign in as <b>${esc(f.as)}</b></span>` : ''}
          ${f.route ? `<span>Start at <code>${esc(f.route)}</code></span>
            <button class="btn" data-act="go" data-route="${esc(f.route)}">Go</button>
            <button class="link" data-act="reload" data-route="${esc(f.route)}">with a reload</button>` : ''}
        </div>
        <div class="sub">Steps</div><ol>${steps}</ol>
        <div class="sub">You should see</div><ul>${f.expect.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        ${(f.notes ?? []).length ? `<div class="sub">Decisions behind this flow</div>${f.notes.map((n) => this.note(n)).join('')}` : ''}
        ${this.evidence(f.evidence)}
        <div class="results">${Object.entries(RESULT_LABELS).map(([k, label]) =>
          `<button data-act="result" data-id="${esc(f.id)}" data-result="${k}" aria-pressed="${String(r.result === k)}">${label}</button>`).join('')}</div>
        <textarea data-flow-note="${esc(f.id)}" placeholder="What you saw (needed for a fail)">${esc(r.note ?? '')}</textarea>
      </div>` : '';
      return `<section class="flow"><button class="head" data-act="expand" data-id="${esc(f.id)}" aria-expanded="${open}">
        <span class="dot ${esc(r.result ?? '')}"></span><span><span class="id">${esc(f.id)}</span>${esc(f.title)}</span></button>${body}</section>`;
    }

    flowsTab() {
      const groups = new Map();
      for (const f of this.flows) {
        const g = f.group ?? '';
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(f);
      }
      return [...groups].map(([g, list]) => `${g ? `<h2>${esc(g)}</h2>` : ''}${list.map((f) => this.flow(f)).join('')}`).join('');
    }

    notesTab() {
      const global = this.data?.notes ?? [];
      return `<p class="empty">Decisions and assumptions from the run. Keep what you agree with, overturn what you would change.
        Ones tied to a flow or a step are shown there.</p>${global.length ? global.map((n) => this.note(n)).join('') : '<p class="empty">No run-wide decisions.</p>'}`;
    }

    renderStatus() {
      const el = this.root.querySelector('footer .status');
      if (el) el.textContent = this.status;
    }

    render() {
      const total = this.flows.length;
      this.launcher.innerHTML = this.data ? `Walkthrough <b>${this.done}/${total}</b>` : 'Walkthrough <b>none</b>';
      this.launcher.title = this.data ? 'Hover to look, click to pin (Alt+W)' : (this.status || 'No walkthrough.json for this run');
      this.launcher.setAttribute('aria-expanded', String(this.visible));
      this.launcher.setAttribute('aria-pressed', String(this.pinned));
      this.panel.hidden = !this.visible;
      this.panel.classList.toggle('peek', this.peek && !this.pinned);
      if (!this.visible) return;

      const count = (k) => this.flows.filter((f) => this.results.flows[f.id]?.result === k).length;
      const pct = (n) => (total ? (100 * n) / total : 0);
      const globalNotes = (this.data.notes ?? []).length;
      const scrolled = this.panel.querySelector('main')?.scrollTop ?? 0;
      this.panel.innerHTML = `
          <header>
            <div class="top"><h1>${esc(this.data.title ?? 'Walkthrough')} <small>${this.done}/${total}</small></h1>
              <button class="pin" data-act="pin" aria-pressed="${this.pinned}" title="${this.pinned ? 'Unpin: close when the pointer leaves' : 'Pin: keep it open'}">${this.pinned ? 'Pinned' : 'Pin'}</button>
              <button class="x" data-act="close" aria-label="Close the walkthrough">✕</button></div>
            <div class="bar"><i style="width:${pct(count('pass'))}%;background:#16a34a"></i><i style="width:${pct(count('fail'))}%;background:#dc2626"></i><i style="width:${pct(count('skip'))}%;background:#9ca3af"></i></div>
            <div class="tabs" role="tablist">
              <button role="tab" data-act="tab" data-tab="flows" aria-selected="${this.tab === 'flows'}">Flows (${total})</button>
              <button role="tab" data-act="tab" data-tab="notes" aria-selected="${this.tab === 'notes'}">Decisions (${globalNotes})</button>
            </div>
          </header>
          <main>${this.tab === 'notes' ? this.notesTab() : this.flowsTab()}</main>
          <footer><span class="status">${esc(this.status || (this.results.finished ? 'Finished.' : ''))}</span>
            <button class="finish" data-act="finish">Finish</button></footer>`;
      const main = this.panel.querySelector('main');
      if (main) main.scrollTop = scrolled;
    }
  }

  customElements.define('dili-walkthrough', Walkthrough);
  const mount = () => document.documentElement.appendChild(document.createElement('dili-walkthrough'));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
