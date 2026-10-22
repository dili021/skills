---
name: create-verification-skill
description: "Generate a project's verify CLI and its guide, so agents drive the app the way a user does: any language, framework, or platform. Use for /create-verification-skill, \"make a control skill for this repo\", or when a project has no scripted way to prove UI/CLI/service behavior."
disable-model-invocation: true
---

# Create a verification skill

Every serious project needs a scripted way to drive the real app and prove behavior: launch it, exercise a feature the way a user would, and capture evidence. This skill generates that for the repo: an executable, the **verify CLI** at `verify/cli`, and its guide at `docs/agents/verify.md`. Both are committed and run nothing on their own, so a teammate who does not use these skills never meets them. You write the generator's output for the next agent, not for a human: it will be read cold, mid-task, by an agent that has never seen the app.

## 1. Interview the repo, not the user

Answer these from the codebase and only ask the user what you cannot observe:

- **Surface:** what does a user actually touch? A web UI, a CLI/TUI, a desktop app, an API, a mobile app, a library? A repo can have several; pick the primary one and note the rest.
- **Run:** how does the app start locally? Prefer the repo's own documented dev command (package scripts, Makefile, README quickstart). Note ports, env vars, seed data, auth.
- **Drive:** how can an agent interact with it programmatically? Existing harnesses first — Playwright/Cypress specs, expect scripts, PTY helpers, curl-able endpoints, a debug port. Only then pick a generic recipe: browser/CDP for web and Electron, a tmux/PTY harness for CLI/TUI, plain HTTP for services.
- **Observe:** what evidence can be captured? Screenshots, terminal transcripts, response bodies, logs, exit codes, DB state.
- **Isolate:** can two instances run side by side (ports, data dirs, profiles)? If not, say so in the guide and make `up` refuse a second instance: refusing to double-drive a shared instance beats corrupting the user's session.

If the checkout doesn't build or start as-is, fix that first (or report it precisely) before generating; a CLI written against a broken base teaches wrong steps. When an irrelevant missing asset blocks startup (a static dir the API never serves, a sample config), the CLI's `up` may create it, clearly marked as verification scaffolding, and remove it in cleanup.

## 2. Generate the CLI and its guide

The verify CLI lives at `verify/cli`, written in the repo's own language, with its helpers in `verify/helpers/` and its proof cases in `verify/prove/`. `verify/` is committed. What a run produces (receipts, evidence, the record of what `up` started) goes to the uncommitted `.verify/` in the primary checkout, which `.git/info/exclude` keeps out of git. The CLI does the work and the guide documents it, so every agent runs the same steps. Its contract is the same in every repo:

| Verb | Does | Exit codes |
|------|------|------------|
| `up` | starts the app for verification, idempotent, prints where it listens, records what it started in `.verify/run/` | 0, 2 |
| `down` | stops only what `up` recorded | 0, 2 |
| `doctor` | read-only: process up, right build, port owned by us, auth valid | 0, 2 |
| `drive <action> [args]` | performs one user action through the real surface: a click or a fill found by role and name, a CLI call, a request | 0, 1, 2, 3 |
| `observe <view> [args]` | captures evidence: `screen`, `snapshot`, `state` (a second read-only view of stored data: a database query, an API read, a file), `logs` | 0, 2, 3 |
| `prove [case...]` | runs proof cases, all of them when none is named, and writes one receipt per case through `node scripts/receipt.mjs run prove <case> --evidence <path> -- <case command>` | 0, 1, 2, 3 |

The exit codes mean the same everywhere: 0 the behaviour holds, 1 the app did the wrong thing, 2 the harness could not run, 3 a **handle** was not found. A handle is anything the CLI relies on to reach the app: a selector, a route, a prompt string, a command. Exit 3 is a signal: the surface changed, on purpose (the map drifted) or by regression. Every exit 1 and 3 prints one line naming the feature, the handle or assertion, the screen or route, expected against actual, and the evidence path:

    verify: [case-status] handle not found: [aria-label="Confirm balance"] on /cases/:id (exit 3), evidence .verify/evidence/2026-10-20T10-00/case-status.png

**Proof cases** live in `verify/prove/`, one file per behaviour, named `<feature>-<behaviour>`. A case drives the real user path start to finish and asserts three things: the action happened, the resulting state shows on the surface, and the side effect is stored, read back through `observe state`. A case belongs here when its path crosses a process boundary: browser to API to database, CLI to filesystem, service to queue. Behaviour inside one component belongs in the repo's own test suite. Add `^verify/prove/` to `extra.test` in `scripts/floor-guard.config.json`, so a deleted case or a removed assertion is reported like any test. The full proof run is `node scripts/receipt.mjs run prove all -- verify/cli prove`, which `gate.mjs prove-all` reads.

Then write the **verify guide**, `docs/agents/verify.md`. The skills that drive the app read it (`verdict`, `afk`, `triage`, `diagnosing-bugs`, `maintain-verification-skill`, `code-graph`); nothing loads it on its own, so it has no frontmatter. Open it with one line naming the app, its surface and `verify/cli`, then these sections, each grounded in what the interview actually found (no placeholders left):

- **Launch:** what `up` runs and how it tells the app is ready (a log line, a port answering, a prompt), and what `down` stops. For a short-lived CLI or TUI there is no server to keep alive: `up` builds the binary (or installs deps) once, and each `drive` starts in its own isolated PTY or tmux session.
- **Doctor:** what `doctor` checks to answer "is this instance worth driving?": process up, right version/build, port owned by us, auth valid. An agent runs it first whenever anything looks off.
- **Drive:** the actions `drive` knows, with the real handles from this repo, not examples. Prefer stable handles (ARIA labels, data attributes, prompt strings, route paths) over coordinates and tab order.
- **Evidence:** what `observe` captures for a proof; it goes to `.verify/evidence/`. State the proof standards: exercise the real user path, not internal setters or test-only endpoints; capture the action and the resulting state, not just the final screen; verify side effects (files written, rows inserted, messages sent) alongside what's visible; mocks only where a production boundary already isolates the external system. When the safe path is a dry-run or test mode, verify what it actually skips by observing (files, network, git refs) rather than trusting its name: some dry-runs still touch the network or open a browser.
- **Cleanup:** how `down` tears down instances the run created. It kills what `up` started, never by process name. Cleanup removes instances and scratch state, never the evidence: proof artifacts survive the teardown in `.verify/evidence/`.
- **Helpers:** every script in `verify/helpers/` is executable and its invocation is shown in the guide. A helper the reader has to reverse-engineer is not a helper. State the rule for later agents in the guide: look in `verify/helpers/` before writing a script to drive the app, and save any new driving script to `verify/helpers/candidates/` with a first-line comment saying what it does. The folder is the memory an agent does not have between sessions.

## 3. Seed the feature map

Create `docs/agents/verify/features/README.md` plus one file per user-facing feature you can identify (aim for the top 3-5 to start, from routes, commands, menus, or docs; when the repo has `graphify-out/`, the `code-graph` skill finds where each one enters the code). Follow the shape in [`references/feature-map-example/`](references/feature-map-example/), with a README index and one file per feature. Each file answers, from the user's point of view: what the feature is, how to reach it, how to drive it with `verify/cli`, and what observable end state proves it works. The four H2s are `Sub-features`, `How to get to it (user POV)`, `Driving it with verify/cli`, and `Gotchas`. Write at least one proof case in `verify/prove/` for the feature you drive in step 4. The map is the repo's maintained verification source; a proof that drives one convenient entry point is incomplete when the map lists others.

## 4. Prove the CLI before handing it over

Run it end to end once: `up`, `doctor`, `prove` on the ONE case you wrote (one is enough; the map exists so later runs can cover the rest), `down`. Then run one `drive` against a handle that does not exist and confirm exit 3 with the one-line message. After `down`, confirm the evidence in `.verify/evidence/` and the receipt in `.verify/receipts/` still exist: a cleanup that eats the proof fails this step. Fix what fails, and run `down` after every failed iteration too, so broken attempts don't strand processes and ports. A CLI that was never executed is a draft, not a deliverable.

## 5. Offer the maintenance loop

Point the user at `/maintain-verification-skill` for keeping the map honest as the app changes. Suggest a cadence only if they ask.
