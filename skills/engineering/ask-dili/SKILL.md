---
name: ask-dili
description: Ask which skill or flow fits your situation. A router over the skills in this repo.
disable-model-invocation: true
---

# Ask dili

You don't remember every skill, so ask.

The skills serve one **flow**: a problem becomes a contract, an agent runs the contract to a **merge-ready** pull request, and you give the verdict. You are in at two points, the contract and the verdict. Everything else here either feeds that flow or keeps it honest.

```
problem → contract → run → proof → merge-ready PR → your verdict → lessons
```

## Once per repo

**`/setup-dili-skills`** configures a repo for everything below: the issue tracker, the triage labels, where `GLOSSARY.md` and ADRs live, the bar (`CONSTRAINTS.md`, its `check` command and the floor guard), the project's `verify-<app>` skill, and `docs/agents/lessons.md`. It ends with a readiness table. Run it first. Run it again to finish a step that was blocked.

The two heavy steps are skills of their own, for running again later:

- **`/constraints`** writes the bar: rules with numbers, each naming the command that checks it.
- **`/create-verification-skill`** generates `verify-<app>`: how to launch the app, drive it as a user and capture evidence, with a map of user-facing features. **`/maintain-verification-skill`** keeps that map matching the app, and promotes repeated driving scripts into helper commands. Run it weekly.

## The flow

### 1. Where the work comes from

- **A small problem that `git revert` undoes** (a bug with a screenshot, a UI fix): straight to **`/afk`**. It reproduces the problem, writes its own acceptance criteria and builds. You react to the criteria afterwards.
- **An idea with decisions in it**: **`/grill-with-docs`** interviews you and keeps what it learns in `GLOSSARY.md` and ADRs. **`/grill-with-ui`** is the same interview in a browser page. Bring only product and preference calls to the interview. A question whose answer is a fact goes to **`/prototype`** or to the agent's own experiment.
- **Something too big to see across**: **`/wayfinder`** charts a map of decision tickets and resolves them one at a time. It produces decisions, then hands off to step 2.
- **Issues you did not write**: **`/triage`** moves them through the triage roles and reproduces each claim, with `verify-<app>` when there is one.
- **A hard bug**: **`/diagnosing-bugs`** builds a loop that goes red on the bug before it theorises.

### 2. The contract

**`/to-spec`** turns the thread into a spec. **`/to-tickets`** splits it into tracer-bullet tickets with blocking edges. The agent writes each ticket's acceptance criteria, every one with a **Proven by** line: the command, the test or the user path whose result shows the criterion holds. You correct and add.

Keep the interview, the spec and the tickets in one context window, so each builds on the same thinking.

### 3. The run

**`/afk`** takes the contract to a merge-ready PR while you are away. One look at the contract before you leave, a fixed finish condition, a stop list for anything irreversible. It builds through **`/implement`** when the tickets form one chain and through **`/lanes`** when they form several, and it keeps a decision log with **`/show-me-your-work`**.

To drive it yourself, call **`/implement`** or **`/lanes`** directly. Both build test-first with **`/tdd`** and end on the two proof skills below.

### 4. The proof

- **`/code-review`** reads the diff on two axes, Standards and Spec.
- **`/verdict`** is the independent check. A fresh agent that did not write the code drives the real app against the acceptance criteria and returns PASS, PASS+NOTES or FAIL. A criterion with no evidence is INCONCLUSIVE, and that fails.

`/afk`, `/implement` and `/lanes` run both. Run either by hand on any branch or PR.

### 5. The handoff

**`/pr`** shapes the PR body: the smallest visual that shows the change, before and after evidence, and whether the merge is a one-way or a two-way door. `/afk` puts an **Attention** section above it. In a repo that merges locally, the same body becomes a handoff note in `.afk/<branch>/HANDOFF.md` and the run ends on a branch. Read in this order: the run's class, Attention, the verdict table, the evidence. The diff comes last, where Attention points.

You merge. No skill here merges.

### 6. The lessons

**`/retro`** looks back over a session and proposes changes to the agent's environment: a lint rule, a row in `CONSTRAINTS.md`, a line in the verify skill. It also reads `docs/agents/lessons.md`, the buffer `/afk` fills with mistakes that may recur, and proposes a check once one kind of mistake has three entries.

## Context between phases

Read [PHASE-BOUNDARIES.md](PHASE-BOUNDARIES.md) at the gap between two phases: continue, `/clear`, `/handoff`, a subagent, or `/compact`, asked in that order. **`/handoff`** writes a portable file when the work moves to another directory, harness or person.

## Vocabulary underneath

- **`/domain-modeling`** sharpens the project's domain language and records hard-to-reverse decisions as ADRs.
- **`/codebase-design`** is the deep-module vocabulary: module, interface, depth, seam.
- **`/code-graph`** is how the other skills use a graphify graph when the repo has one: a freshness gate, then what a diff reaches, what two lanes share, where a feature enters the code. `/verdict`, `/lanes` and `/pr` call it.

## Codebase health

**`/improve-codebase-architecture`** finds deepening opportunities when you have a spare hour. A codebase that is easy to change is one an agent can be left alone in.

## Standalone

- **`/grill-me`**: the interview with no repo under it. **`/grilling`** is the primitive both interviews run.
- **`/research`**: a background agent reads primary sources and leaves a cited file.
- **`/to-questionnaire`**: when the missing answer is in someone else's head, write them a questionnaire.
- **`/wizard`**: an interactive script for steps only a human can take, like credentials and dashboards.
- **`/resolving-merge-conflicts`**: works a conflict hunk by hunk, by intent.
- **`/whiteboard-defense`**: a lesson on a shipped system so you can defend it at a whiteboard.
- **`/teach`**: learn a concept over several sessions.
- **`/wait-what`**: re-pitch the last message in plain language, with `GLOSSARY.md` vocabulary.
- **`/writing-for-agents`**: the reference for skills, `CLAUDE.md` and other documents agents read.
- **`/unslop`**: applies to everything written for a person.
