---
name: flow-map
description: Flow map, an interactive HTML page that walks one request through an app's layers, with forks, replayable situations and the design decisions behind each step. Use when the user wants to visualize or explain how data and control move through an app, or to onboard someone onto its architecture.
---

# Flow map

A **flow map** is one local HTML page. The app's layers are **lanes**, its screens, controllers, workers, nodes and outside systems are **stations**, and one **packet** travels between them step by step. At each **fork** the reader picks a branch. **Situations** replay a branch worth seeing in one click. The **Decisions** tab says why each step is built the way it is, with what we get, what we pay, the risk and the source.

The page is a walkthrough an engineer explores at their own pace. Progress counts the steps seen, and the situations list what is still unseen.

All rendering lives in [template.html](template.html). You write only the JSON in its `<script type="application/json" id="flow">` block, the same way every time; the format is under **Data** below, and the template's own demo uses every field.

## Process

1. **Map the happy path.** Read the agent docs (`CLAUDE.md`, `AGENTS.md`), the glossary, ADRs, specs and tickets, then the code at each hop: routes, controllers, queues, workers, pipeline nodes, the DTOs that cross each boundary. Follow one realistic request from the first user action to the last stored state. Done when every hop has a station at both ends, a code path, a kind (data or control) and a mode (sync, async, stream, poll, human).

2. **Find the forks.** At every hop, list the outcomes the code handles explicitly: a duplicate, a failure and its retry, a fallback reader, a timeout, a match against existing state, each human choice. Make each a fork whose branches rejoin the main path. Done when every explicitly handled outcome is a branch or sits on a short list of cuts you report in step 6.

3. **Collect the decisions.** For every step, find what shaped it: an ADR, a ticket, a project rule, a recorded product decision. Write each decision with its reason, what we get, what we pay and the risk, and link it to every step it shapes. Take the reason and the numbers from the source; where the source gives no reason, write only what it says. Done when every decision names its source and every step it shapes lists it.

4. **Write the page.** Copy `template.html` to `<slug>.html`, in `docs/` when the repo has one, else the current directory. Replace only the JSON block. Packets carry the real field names of the contract at that hop, with invented values: invented names, and identifiers and account numbers whose check digits are valid wherever the domain has check digits. Use the glossary's terms in text and labels. Every pointer to another decision, step or station is a **reference** (`[[dec:id]]`, see **Data**), so the reader opens it in one click and comes back; every source that is a file in the repo is a link to that file. Write the `ui` strings in the language of the repo's docs; English is the default. Done when every step from steps 1 and 2 is in `steps` and every decision from step 3 is in `decisions`.

5. **Check it.** Run `node <this skill's directory>/check-flow.mjs <slug>.html` and fix every `ERROR`; read every warning. Then open the page in a headless browser if one runs here: one screenshot at 1440 px, one at 390 px, and walk two forks. Look for text spilling out of its box and stations on top of each other. Done when the check prints `OK` and the screenshots are clean, or you know no browser runs here and will say so.

6. **Report.** Give the path, the counts the check printed, the cuts from step 2, and which decision texts are your wording rather than the source's. Say whether you saw the page in a browser. The file stays local and uncommitted until the user asks for more.

Later changes, such as a renamed step, a new fork or a corrected decision, are edits to the JSON block. Run step 5 again after each one. When the template itself has changed, `node <this skill's directory>/upgrade-page.mjs <slug>.html` moves an existing page onto it and keeps its JSON.

## Data

```jsonc
{
  "title": "Receipt scanner", "titleAccent": "scanner",   // accent: the part of the title shown in red
  "intro": "One paragraph under the title.",
  "lang": "en", "start": "start", "storageKey": "receipt-flow-v1",
  "lanes": [ { "id": "web", "name": "User · Browser", "short": "Screen", "sub": "web/src", "height": 190 } ],
  "stations": { "api": { "lane": "api", "col": 0, "dy": 0, "icon": "🚪", "name": "API", "sub": "/api/receipts",
                         "desc": "What it does.", "code": ["api/src/routes.ts"], "external": false } },
  "flags": { "low_confidence_total": { "src": "worker", "text": "Total read with low confidence" } },
  "steps": { "save": { "from": "worker", "to": "db", "kind": "data", "mode": "sync", "edge": "INSERT",
                       "title": "Fields saved", "text": "What happens and why.", "code": ["worker/save.py"],
                       "packet": { "id": 7 }, "set": { "blurry": true }, "flags": ["code", { "code": "c2", "if": "blurry" }],
                       "unflag": ["code"], "status": { "text": "extracted", "tone": "warn" },
                       "variants": [ { "if": "blurry", "text": "...", "packet": {} } ],
                       "next": "review" } },
  "situations": [ { "step": "ocr_blurry", "title": "A blurry total", "text": "One line." } ],
  "decisions": [ { "id": "async", "part": "api", "title": "...", "decision": "...", "why": "... see [[dec:hash|the duplicate check]]",
                   "src": [ { "label": "ADR 0002", "href": "adr/0002-async-ocr.md" }, "vendor docs" ],
                   "plus": ["..."], "cost": ["..."], "risk": ["..."], "steps": ["store", "enqueue"] } ],
  "ui": { "progress": "Progres" }
}
```

- **Lanes** stack top to bottom in the order given, five colours. `short` names the lane in decision tags; `height` defaults to 190.
- **Stations** sit by `col`: the highest `col` lands at the right edge, so columns are relative. Keep stations of one lane at least one column apart, `name` within 18 characters and `sub` within 20; longer text is squeezed to fit. `dy` moves a station up or down inside its lane. `external` draws a dashed border.
- **Steps** move the packet `from` one station `to` another; `from` equal to `to` is an action in place. `kind` is `data` (the packet moves), `ctrl` (a call, an enqueue, a poll: control is handed over) or `human`. A step ends on exactly one of `next`, `choices` (`[{ "label", "hint", "next" }]`, a fork) or `"end": true`. `next` can be conditional: `{ "if": "invented", "then": "drop", "else": "check" }`.
- **State** comes from `set`, which names variables later steps read. A condition is a variable, `"!variable"`, or a list that must all hold. `variants` override `title`, `text`, `packet`, `status` or `next` when their `if` holds; the first matching variant wins, so put the more specific one first. `flags` raise entries from `flags` on this path, and `unflag` clears them; a flag item can carry its own `if`. `status` sets the state pill, with a `tone` of `ok`, `warn` or `bad`.
- **Situations** point at the step that shows the outcome; Play walks the shortest path there.
- **Decisions** take a lane id or `system` as `part`. An empty `plus`, `cost` or `risk` shows as "none known". `src` is a string or a list of strings and `{ "label", "href" }` links, `href` relative to the page.
- **References** are `[[dec:id]]`, `[[step:id]]` and `[[station:id]]`, with an optional label: `[[dec:id|the duplicate check]]`. They work in every text: step texts and variants, station descriptions, flag texts, situations, the intro and every decision field except the title. A reference opens its target in a modal whose Back button returns to where the reader was, and opening a step on the map leaves a button on the step card that leads back. The check fails on a decision named in quotes without a reference and warns on one named by its bare title.
- **`ui`** overrides any label. The keys and English defaults are at the top of the template's script.
