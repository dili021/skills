# First steps on a project

How to bring one repo to the point where an agent can take a task from its brief to a merge-ready pull request, and I only give the verdict. Written for a work repo on a company account, where some steps need a check with the team first.

The order matters. Proof comes before autonomy: an agent left alone without a way to prove its work produces unchecked work faster.

## 0. Before installing anything on a company machine

- **Plugin policy.** This plugin comes from a personal public repo and registers a `SessionStart` hook that runs `hooks/unslop-rule.sh`. Check that the company's Claude Code settings allow third-party marketplaces and hooks. When they do not, clone this repo and copy the skill folders you need into `~/.claude/skills/` instead.
- **Where the files go.** Steps 2 and 3 write `CONSTRAINTS.md`, `scripts/floor-guard.mjs` and `.claude/skills/verify-<app>/` into the work repo. Keep them out of the team's history until the team has agreed: list them in `.git/info/exclude`, which ignores files locally without touching `.gitignore`.
- **Data.** The verification skill drives a running app. Point it at a local or dev environment with seeded data and a test account. Never at production, and never with real customer data.
- **Pull requests.** `/afk` opens PRs under your identity and adds an AI attribution line. Check the team's norm for agent-written PRs before the first one.

## 1. Install

```bash
claude plugin marketplace add dili021/skills
claude plugin install dili-skills@dili
```

Already installed: `/plugin update`. In the work repo, run `/setup-matt-pocock-skills` once. It records the issue tracker, the triage labels and where the glossary and ADRs live. A repo that still has `CONTEXT.md` renames it to `GLOSSARY.md`.

## 2. Write the bar: `/constraints`

Produces `CONSTRAINTS.md`, one `check` command, and the floor guard.

Done when:

- `check` is green on the base branch.
- The floor guard exits 1 on a throwaway branch that adds a suppression comment.
- At least one enforced row has an external verdict owner, or the report says why none exists.

Wiring the checks into CI changes shared config, so leave that for the PR in step 6.

## 3. Make the app provable: `/create-verification-skill`

Produces `.claude/skills/verify-<app>/` with Launch, Doctor, Drive, Evidence and Cleanup sections, and a feature map with the top three to five features.

Done when the skill has run its own instructions once end to end: launched the app, driven one mapped feature, captured evidence, cleaned up, and the evidence is still there afterwards. A generated skill that never ran is a draft.

This is the step most likely to stall on a work project: local auth, VPN, seed data, a second instance that will not start beside the first. Fix the dev setup rather than working around it. Everything after this step depends on it.

## 4. One task with me watching

Pick a small ticket, a day's work or less, that `git revert` fully undoes.

1. Write its acceptance criteria, each with a **Proven by** line. `/to-tickets` does this for a spec.
2. `/implement`.
3. Read the `/verdict` table at the end, then open the evidence files and compare them with what I see when I use the app myself.

That comparison is the point of the step. When PASS matches what I see, the verdict has earned some trust. When it does not, fix the verify skill or the criteria before going further.

## 5. One task away from the keyboard: `/afk`

The same size of task, a different one. Approve the contract once: finish condition, route, stop list, escape hatch. Then leave it.

When I come back, read in this order: the run's class, the Attention section, the verdict table, the evidence. The diff comes last, and only where Attention points.

Repeat until three runs in a row come back merge-ready with nothing in Attention that surprised me. Then move to ticket sets with `/lanes` under `/afk`.

## 6. Bring it to the team

Open one PR with `CONSTRAINTS.md`, the floor guard, the `check` command wired into CI, and the verify skill. The evidence from steps 4 and 5 is the argument for it.

## 7. After every run that went wrong: `/retro`

Each correction becomes a check: a lint rule, a row in `CONSTRAINTS.md`, a line in the verify skill's feature map. A correction that stays as a sentence in a prompt gets made again.

Two habits keep the setup from rotting:

- **A buffer before a fix.** When the same kind of mistake shows up twice, write it to one notes file and leave it unfixed. Read the file every few days. Ten entries side by side show the pattern that ten separate fixes hide, and the pattern is what becomes a lint rule.
- **A command instead of a throwaway script.** The second time an agent writes its own script to drive the app, move that script into the verify skill as a helper command. Every later agent then drives the app the same way.

Once a week, `/maintain-verification-skill`, so the feature map keeps matching the app.

## What stays mine

- The merge.
- Everything on `/afk`'s stop list: deploys, data migrations and deletions, force-pushes, auth, permissions, payments, secrets, messages to people outside the repo, loosening `CONSTRAINTS.md`.
- Product and preference calls. Facts the agent can observe by running something are the agent's to settle.
