---
name: walkthrough
description: A person's own pass over finished work, on the running app. Writes a checklist of the flows to verify, with steps, expected results, the verifier's evidence and the decisions worth challenging, and serves it as a panel over the app through a local proxy, never committed. Use at the end of an /afk run, or when the user asks to walk through, check or verify a branch themselves.
---

# Walkthrough

The verdict is an agent's proof. The walkthrough is the person's: the app they will ship, with a panel listing each flow to try, the steps, what they should see, the verifier's evidence beside it, and the decisions made along the way that they may want to overturn. They mark each flow Pass, Fail or Skip and each decision Keep or Overturn.

Nothing touches the app's repo. A proxy in front of the running app adds the panel; the checklist and the results live in `.afk/<branch>/`, which git ignores.

`$SKILL` is this skill's base directory. Plain Node, no install: `node $SKILL/walkthrough.mjs <command>`. Every command finds the run as `.afk/<current branch>/` in the primary checkout, also from a worktree; `--run <dir>` points elsewhere.

## Process

1. **Gather the run.** In the branch's checkout, read from `.afk/<branch>/`: `HANDOFF.md`, `decisions.tsv`, the verdict report (its path is the `report` field of `.verify/receipts/<branch>/verdict--verdict.json`), and the evidence folder. Read the tickets' acceptance criteria and the verify guide's feature map (`docs/agents/verify.md` or the project's verify skill) for the user paths. Done when you can name every acceptance criterion, the user path that proves it, and every decision marked assumed, accepted trade-off or open question.

2. **Write `.afk/<branch>/walkthrough.json`** (schema below).
   - One flow per acceptance criterion a person can see in the app, grouped by ticket, then one per neighbour the verdict drove. A criterion proven only by a command (a green `check`, a build's output) stays with the gate.
   - Steps are what a person does in the browser, in the app's words: the button names and labels as shown, starting from the flow's `route` and the account in `as`.
   - `expect` is what they should see when it works: text on screen, a status, a URL.
   - `evidence` names the verifier's screenshots and videos for that flow, relative to the run folder, so the person can compare.
   - **Notes** carry what the person may want to challenge: each assumed decision, accepted trade-off, open question and process slip from the handoff and the decision log. Put a note on the step it changes, else on its flow, else in the run-wide `notes` list.

   Run `node $SKILL/walkthrough.mjs check`. Done when it exits 0, and every visible criterion and every assumed decision appears exactly once.

3. **Serve it.** The app must be running: reuse one the user already runs, else start it the way the project's verify guide says. Start `node $SKILL/walkthrough.mjs serve --app <app url> [--port 4400]` in the background; it prints the URL. Hand the person that URL, with one line: what to sign in as first, and that hovering the Walkthrough button opens the panel, a click pins it, and Alt+W pins it from the keyboard. In an `/afk` reply, put the URL right after the review page.

4. **Read the results when the person says they are done.** `node $SKILL/walkthrough.mjs results` lists the counts, each failed, skipped or commented flow, and each overturned or commented decision. Answer each one:
   - A **fail**: reproduce it, then fix it on the branch (product code after a verdict needs a new verdict) or file it as a ticket, whichever the person picks.
   - A **skip** stays unverified: say so.
   - An **overturned decision**: the change it implies, built like a fail, and a row in `docs/agents/lessons.md` when the decision was a guess the code could have answered.

   When the run has a review page, rebuild it (`node scripts/review.mjs`) so the results appear beside the verdict. Stop the proxy. Done when every fail, skip and overturned decision has an answer the person accepted.

## walkthrough.json

```json
{
  "title": "feat/invites-detail-users",
  "notes": [
    { "id": "D24", "kind": "question", "text": "Publisher edit buttons follow the role: the API has no can-flag for it.", "ref": "decisions #24" }
  ],
  "flows": [
    {
      "id": "05.3",
      "group": "05 Publisher detail",
      "title": "A stale edit shows the conflict message and keeps your input",
      "as": "Maya Chen (Admin)",
      "route": "/setup/publishers?publisher=pub-lakeview",
      "steps": [
        "Open the same address in a second tab",
        { "do": "In the second tab, click Edit, rename to \"Lakeview B\" and save", "notes": [
          { "id": "D9", "kind": "assumed", "text": "Two tabs stand in for two people: the mock keeps data per browser.", "ref": "decisions #9" }
        ] },
        "Back in the first tab, click Edit, type \"Lakeview A\" and save"
      ],
      "expect": ["\"Someone else changed this\" above the form", "Your \"Lakeview A\" still in the field", "Reload shows \"Lakeview B\""],
      "evidence": ["evidence/verdict/v-t05-two-tab-conflict/03-tab-a-conflict.png"],
      "notes": []
    }
  ]
}
```

- Required: `flows` (non-empty); per flow `id`, `title`, `steps` (strings, or `{ "do", "notes" }` for a step with notes), `expect`. Optional: `title`, `notes`, and per flow `group`, `as`, `route` (starts with `/`), `evidence`, `notes`.
- A note needs `id`, `kind` and `text`; `ref` points back to the record. Every id, flow or note, is unique. Kinds in use: `assumed`, `trade-off`, `question`, `decision`, `slip`.
- The results land in `walkthrough-results.json` beside it: `{ "finished", "updatedAt", "flows": { "<id>": { "result", "note" } }, "notes": { "<id>": { "answer": "keep|overturn", "note" } } }`.

## Gotchas

- The panel opens on hover over its button and closes once the pointer leaves the button and the panel, except while a note is being typed. A click pins it; Pin in its header and ✕ release it. The pinned state survives a reload.
- The panel's Go opens a route with the History API, so a single-page app keeps its state. "With a reload" does a full page load.
- The proxy sends the app its own Host header, so dev servers that check it answer. It passes WebSocket upgrades through, so live reload keeps working.
- A Service Worker mock (MSW) works through the proxy: the proxy's origin is the page's origin, so the worker registers there. That origin has its own storage: data the person created on the app's own port is not there.
- Results save to disk through the proxy and to the browser as a backup. When the proxy is down, the panel says "Not saved to disk".
