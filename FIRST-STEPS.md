# First steps on a project

How to bring one repo to the point where an agent can take a task from its brief to a merge-ready pull request, and I only give the verdict. Written for a work repo on a company account, where some steps need a check with the team first.

The order matters. Proof comes before autonomy: an agent left alone without a way to prove its work produces unchecked work faster.

## 0. Before installing anything on a company machine

- **Plugin policy.** This plugin comes from a personal public repo and registers a `SessionStart` hook that runs `hooks/unslop-rule.sh`. Check that the company's Claude Code settings allow third-party marketplaces and hooks. When they do not, clone this repo and copy the skill folders you need into `~/.claude/skills/` instead.
- **Where the files go.** Steps 2 and 3 write `CONSTRAINTS.md`, `scripts/floor-guard.mjs` and `.claude/skills/verify-<app>/` into the work repo. Keep them out of the team's history until the team has agreed: list them in `.git/info/exclude`, which ignores files locally without touching `.gitignore`.
- **Data.** The verification skill drives a running app. Point it at a local or dev environment with seeded data and a test account. Never at production, and never with real customer data.
- **Pull requests or local merges.** `/setup-dili-skills` asks which one the repo uses. With pull requests, `/afk` opens them under my identity with an AI attribution line, so check the team's norm first. With local merges, `/afk` ends on a branch and writes the handoff note to `.afk/<branch>/HANDOFF.md`. Setup also asks whether the run may push that branch, which is what lets CI and review bots still see it.
- **Node.** The floor guard is a Node script and `grill-with-ui` needs Node 20. A machine set up only for .NET or Python may not have it.

## 1. Install

```bash
claude plugin marketplace add dili021/skills
claude plugin install dili-skills@dili
```

Already installed: `/plugin update`. A repo that still has `CONTEXT.md` renames it to `GLOSSARY.md`.

In the work repo, run `/setup-dili-skills` once. It records the issue tracker, the triage labels and where the glossary and ADRs live, then runs steps 2 and 3 below and ends with a readiness table. `/ask-dili` answers which skill fits a situation.

## 2. Write the bar

`/setup-dili-skills` runs this. `/constraints` runs it alone. Produces `CONSTRAINTS.md`, one `check` command, and the floor guard.

Done when:

- `check` is green on the base branch.
- The floor guard exits 1 on a throwaway branch that adds a suppression comment.
- At least one enforced row has an external verdict owner, or the report says why none exists.

Wiring the checks into CI changes shared config, so leave that for the PR in step 6.

## 3. Make the app provable

`/setup-dili-skills` runs this too. `/create-verification-skill` runs it alone. Produces `.claude/skills/verify-<app>/` with Launch, Doctor, Drive, Evidence and Cleanup sections, and a feature map with the top three to five features.

Done when the skill has run its own instructions once end to end: launched the app, driven one mapped feature, captured evidence, cleaned up, and the evidence is still there afterwards. A generated skill that never ran is a draft.

This is the step most likely to stall on a work project: local auth, VPN, seed data, a second instance that will not start beside the first. Fix the dev setup rather than working around it. Everything after this step depends on it.

## 4. One task with me watching

Pick a small ticket, a day's work or less, that `git revert` fully undoes.

1. Give it acceptance criteria, each with a **Proven by** line. `/to-tickets` writes them for a spec and I correct them.
2. `/implement`.
3. Read the `/verdict` table at the end, then open the evidence files and compare them with what I see when I use the app myself.

That comparison is the point of the step. When PASS matches what I see, the verdict has earned some trust. When it does not, fix the verify skill or the criteria before going further.

## 5. One task away from the keyboard: `/afk`

The same size of task, a different one. For a small problem that `git revert` undoes, `/afk` reproduces it, writes its own criteria and starts without waiting. For anything larger it posts the contract and waits for a yes: finish condition, route, stop list, escape hatch.

When I come back, read in this order: the run's class, the Attention section, the verdict table, the evidence. The diff comes last, and only where Attention points. Criteria the agent wrote are marked `assumed` in Attention. A wrong one costs another round, so correct it there.

Repeat until three runs in a row come back merge-ready with nothing in Attention that surprised me. Then move to ticket sets with `/lanes` under `/afk`.

## 6. Bring it to the team

Open one PR with `CONSTRAINTS.md`, the floor guard, the `check` command wired into CI, and the verify skill. The evidence from steps 4 and 5 is the argument for it.

## 7. After every run that went wrong: `/retro`

Each correction becomes a check: a lint rule, a row in `CONSTRAINTS.md`, a line in the verify skill's feature map. A correction that stays as a sentence in a prompt gets made again.

Two habits keep the setup from rotting:

- **A buffer before a fix.** `/afk` ends each run by proposing rows for `docs/agents/lessons.md`: mistakes that a check, a verifier or I had to catch and that could happen again. I say which to add. `/retro` reads the file and proposes a check once one kind of mistake has three rows.
- **A command instead of a throwaway script.** The verify skill tells agents to save any new driving script in `helpers/candidates/`. `/maintain-verification-skill` merges candidates that do the same job into one helper command and proves it live.

Once a week, `/maintain-verification-skill`, so the feature map keeps matching the app.

## A repo with .NET, Angular and Python in it

The skills name no stack, but three things need care.

- **The bar is written per stack.** Setup lists the stacks it found, one per folder, and I confirm the list. `/constraints` then writes rows only for those, from its `STACKS.md`: `dotnet build -warnaserror` and `dotnet test` for .NET, `ng build`, `ng lint` and `ng test` for Angular, `ruff`, `mypy` or `pyright` and `pytest` for Python. It writes `floor-guard.config.json` with the same stacks, and adds this repo's own suppression styles under `extra`. Re-running setup after a stack is added or dropped updates both.
- **The verify skill has several things to start.** A .NET backend, an Angular dev server and a Python service are three processes, each with its own port, config and seed data. Getting all three up from one command is most of the work in step 3. Do it for the path a user actually clicks through first.
- **Code that calls a model needs a deterministic proof.** A criterion like "the summary is good" cannot pass a verdict. Use what can be checked: the response parses against its schema, the expected tool is called, a refusal happens where it must, a score over a fixed evaluation set holds its number. Start the pilot in the .NET part, and bring the Python part in once it has an evaluation set.

## The code graph

With graphify installed, `/setup-dili-skills` builds the graph and installs the git hooks that rebuild it on commit and checkout. `/verdict` then asks it which features a diff reaches and has the verifier drive those too, `/lanes` asks it what two lanes share, and `/pr` names the blast radius from it. Each use refreshes the graph first, and a graph that cannot be refreshed is reported as stale and left unused.

## What stays mine

- The merge.
- Everything on `/afk`'s stop list: deploys, data migrations and deletions, force-pushes, auth, permissions, payments, secrets, messages to people outside the repo, and lowering the bar, which covers `CONSTRAINTS.md` and the config of every checker.
- Product and preference calls. Facts the agent can observe by running something are the agent's to settle.
