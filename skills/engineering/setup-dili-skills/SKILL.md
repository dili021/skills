---
name: setup-dili-skills
description: "Configure this repo for the skills: issue tracker, triage labels, domain docs, the quality bar, the verify skill and the lessons file. Run once per repo."
disable-model-invocation: true
---

# Setup dili skills

Scaffold the per-repo configuration that the engineering skills assume:

- **Issue tracker**: where issues live (GitHub by default; local markdown is also supported out of the box)
- **Triage labels**: the strings used for the five canonical triage roles
- **Domain docs**: where `GLOSSARY.md` and ADRs live, and the consumer rules for reading them
- **The bar**: `CONSTRAINTS.md`, its `check` command and the floor guard
- **The verify skill**: a project-local `verify-<app>` skill that drives the app as a user
- **The lessons file**: `docs/agents/lessons.md`, the buffer of agent mistakes that may become checks
- **The handoff**: whether a finished run ends on a pull request or on a local branch
- **The code graph**: a graphify graph and the git hooks that keep it fresh, when graphify is installed

This is a prompt-driven skill, not a deterministic script. Explore, present what you found, confirm with the user, then write.

## Process

### 1. Explore

Look at the current repo to understand its starting state. Read whatever exists; don't assume:

- `git remote -v` and `.git/config`: is this a GitHub repo? Which one?
- `AGENTS.md` and `CLAUDE.md` at the repo root: does either exist? Is there already an `## Agent skills` section in either?
- `GLOSSARY.md` and `GLOSSARY-MAP.md` at the repo root
- `docs/adr/` and any `src/*/docs/adr/` directories
- `docs/agents/`: does this skill's prior output already exist?
- `CONSTRAINTS.md` at the repo root, and a `check` entry in the repo's scripts
- `.claude/skills/verify-*/`: is there a verify skill already?
- Which stacks the repo holds (`*.sln` and `*.csproj`, `pyproject.toml`, `package.json`) and in which directories
- The git host's CLI (`gh`, `glab`, `az`) on `PATH` and signed in, and whether recent history merges through pull requests
- `graphify` on `PATH`, `graphify-out/`, and `graphify hook status`
- `.scratch/`: a sign that a local-markdown issue tracker convention is already in use
- Is the `triage` skill installed? (a `triage` skill folder alongside this one, or `triage` in your available skills.) This decides whether Section B runs at all.
- Monorepo signals: a `pnpm-workspace.yaml`, a `workspaces` field in `package.json`, or a populated `packages/*` with its own `src/`. These are present only in a genuinely large multi-package repo; their absence means single-context, which is almost every repo.

### 2. Present findings and ask

Summarise what's present and what's missing. Then take the sections in order. One section, one answer, then the next.

Lead each section with the recommended answer so the user can accept it in a word. Give a one-line explainer only when the choice genuinely branches; skip the section entirely when exploration already settled it (Section B when `triage` isn't installed, Section C when there's no monorepo).

**Section A: Issue tracker.**

> Explainer: The "issue tracker" is where issues live for this repo. Skills like `to-tickets`, `triage`, and `to-spec` read from and write to it. They need to know whether to call `gh issue create`, write a markdown file under `.scratch/`, or follow some other workflow you describe. Pick the place you actually track work for this repo.

Default posture: these skills were designed for GitHub. If a `git remote` points at GitHub, propose that. If a `git remote` points at GitLab (`gitlab.com` or a self-hosted host), propose GitLab. Otherwise (or if the user prefers), offer:

- **GitHub**: issues live in the repo's GitHub Issues (uses the `gh` CLI)
- **GitLab**: issues live in the repo's GitLab Issues (uses the [`glab`](https://gitlab.com/gitlab-org/cli) CLI)
- **Local markdown**: issues live as files under `.scratch/<feature>/` in this repo (good for solo projects or repos without a remote)
- **Other** (Jira, Linear, etc.): ask the user to describe the workflow in one paragraph; the skill will record it as freeform prose

Record the choice in `docs/agents/issue-tracker.md`. The GitHub and GitLab templates carry a "PRs as a request surface" flag, defaulted **off**. Leave it off and don't raise it: a user who wants external PRs in the triage queue can flip the flag in the file later.

**Section B: Triage label vocabulary.** Skip this section entirely if the `triage` skill isn't installed (exploration told you), since an uninstalled skill needs no labels.

If it is installed, ask exactly one question:

> Do you want to keep the default triage labels? (recommended: **yes**)

The defaults are the five canonical roles, each label string equal to its name: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. On **yes**, write them as-is. Only if the user says no, usually because their tracker already uses other names (e.g. `bug:triage` for `needs-triage`), collect the overrides so `triage` applies existing labels instead of creating duplicates.

**Section C: Domain docs.** Default to **single-context** (one `GLOSSARY.md` + `docs/adr/` at the repo root). This fits almost every repo; write it without asking.

Offer **multi-context** (a root `GLOSSARY-MAP.md` pointing to per-context `GLOSSARY.md` files) only when exploration found monorepo signals. Then confirm which layout they want.

**Section D: Handoff.** Ask one question: does finished work reach the base branch through a pull request, or through a local merge? Recommend pull request when the git host's CLI is signed in and recent history merges that way. Recommend local branch otherwise. For a local merge, ask one more: may the run push its work branch, so that CI and review bots that react to pushed branches still see it? Recommend yes when the git host runs anything on branch pushes. Record the answers and the base branch in `docs/agents/handoff.md`, from [handoff.md](./handoff.md).

### 3. Confirm and edit

Show the user a draft of:

- The `## Agent skills` block to add to whichever of `CLAUDE.md` / `AGENTS.md` is being edited (see step 4 for selection rules)
- The contents of `docs/agents/issue-tracker.md`, `docs/agents/domain.md`, and `docs/agents/triage-labels.md` (the last only when `triage` is installed)

Let them edit before writing.

### 4. Write

**Pick the file to edit:**

- If `CLAUDE.md` exists, edit it.
- Else if `AGENTS.md` exists, edit it.
- If neither exists, ask the user which one to create; don't pick for them.

Never create `AGENTS.md` when `CLAUDE.md` already exists (or vice versa); always edit the one that's already there.

If an `## Agent skills` block already exists in the chosen file, update its contents in-place rather than appending a duplicate. Don't overwrite user edits to the surrounding sections.

The block:

```markdown
## Agent skills

### Issue tracker

[one-line summary of where issues are tracked]. See `docs/agents/issue-tracker.md`.

### Triage labels

[one-line summary of the label vocabulary]. See `docs/agents/triage-labels.md`.

### Domain docs

[one-line summary of layout: "single-context" or "multi-context"]. See `docs/agents/domain.md`.
```

Include the `### Triage labels` sub-block, and write `docs/agents/triage-labels.md`, only when `triage` is installed and Section B ran. When it isn't, both are omitted.

Then write the docs files using the seed templates in this skill folder as a starting point:

- [issue-tracker-github.md](./issue-tracker-github.md): GitHub issue tracker
- [issue-tracker-gitlab.md](./issue-tracker-gitlab.md): GitLab issue tracker
- [issue-tracker-local.md](./issue-tracker-local.md): local-markdown issue tracker
- [triage-labels.md](./triage-labels.md): label mapping (only if `triage` is installed)
- [domain.md](./domain.md): domain doc consumer rules + layout

For "other" issue trackers, write `docs/agents/issue-tracker.md` from scratch using the user's description.

Create `docs/agents/lessons.md` from [lessons.md](./lessons.md) when it does not exist. `/afk` proposes entries for it and `/retro` reads it.

### 5. The bar

Skip when `CONSTRAINTS.md` already exists and its rows cover every stack you found in step 1. Otherwise read [`../constraints/SKILL.md`](../constraints/SKILL.md) and run its process here, starting from the stacks you found. It confirms them with the user, writes rows only for those, and tells the floor guard which stacks to check. When a stack has been added to or removed from the repo since the last run, update the rows and `floor-guard.config.json` to match. Done when its own completion criteria hold: `check` is green on the base branch and the floor guard is red on a throwaway branch.

### 6. The verify skill

Skip when a `verify-<app>` skill already exists. Otherwise call the Skill tool with `create-verification-skill`. Done when the generated skill has run its own instructions once end to end and the evidence survived cleanup.

When the app cannot be started here (missing credentials, VPN, seed data), stop this step, say exactly what is missing, and carry on to the report. The user fixes the dev setup and re-runs this skill.

### 7. The code graph

Skip when `graphify` is not on `PATH`, and report the row as missing and optional. Otherwise:

1. Unless the repo already tracks `graphify-out/`, add `graphify-out/` to `.git/info/exclude`. The graph is a local build product.
2. Build the graph when it does not exist: `graphify extract . --code-only`.
3. Run `graphify hook install`, so a commit or a checkout rebuilds the graph in the background.
4. `hook install` also registers a merge driver and writes a `graphify-out/graph.json merge=graphify` line into `.gitattributes`. That line only matters when the graph is committed. When it is not, undo it: restore `.gitattributes` if git tracks the file, delete it if the hook created it. Tell the user you did.

Done when `graphify hook status` reports both hooks, `git status` shows nothing new from this step, and `graph.json` holds nodes from every stack in the repo.

### 8. Report readiness

One table, one row per item: issue tracker, triage labels, domain docs, the bar, the verify skill, the lessons file, the handoff mode, the code graph, CI on pull requests. In local-branch mode the CI row reads "not used, the run's own `check` is the last gate". Each row is **ready**, **missing** or **blocked**, with what a missing or blocked row costs an `/afk` run. Without a verify skill, UI criteria come back INCONCLUSIVE.

On a repo shared with a team, say which files this run wrote and offer to list them in `.git/info/exclude`, together with `.afk/` and `graphify-out/`, so they stay out of the team's history until the team has agreed.

Mention that `docs/agents/*.md` can be edited directly later. Re-running this skill is for switching issue trackers, or for finishing a step that was blocked.
