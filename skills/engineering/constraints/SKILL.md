---
name: constraints
description: "Write this project's quality bar as CONSTRAINTS.md: rules with numbers, each with the command that checks it."
disable-model-invocation: true
metadata:
  credits:
    skill: constraint-driven-development
    author: Addy Osmani
    url: "https://github.com/addyosmani/agent-skills/blob/main/skills/constraint-driven-development/SKILL.md"
---

# Constraints

An agent writes more code than you will read, so the bar has to live in checks that run around the agent. This skill writes that bar for one project as `CONSTRAINTS.md` at the repo root, and wires one command that enforces it.

## Process

1. **Read before asking.** Find every stack in the repo and the directory each lives in, then per stack the test runner, the linters and today's coverage. Find the CI workflows and any agent hooks. Report the stacks as one line each, `<stack> in <directory>`, and ask the user to confirm or correct that list before going on. Done when the user has confirmed the stacks and you can name the typecheck, lint and test commands for each, or say which one is missing.

2. **Ask four questions, one at a time, each with a default.** "I don't know" takes the default.
   - Which dimensions beyond the floor: coverage of changed lines, security scanning, performance budgets, accessibility, architecture boundaries. Default: coverage and security.
   - Does a failing check block the agent mid-task, or warn? Default: the floor blocks, the rest warns for the first two weeks.
   - Target numbers, or measure today and hold that line? Default: measure and hold.
   - The slowest check tolerated before work is handed back. Default: 90 seconds at task end, no limit in CI.

   Done when all four have an answer or a default.

3. **Write `CONSTRAINTS.md`** from [`CONSTRAINTS-TEMPLATE.md`](CONSTRAINTS-TEMPLATE.md), taking each stack's usual commands from [`STACKS.md`](STACKS.md). A repo with several stacks gets rows per stack, scoped to that stack's directory. Every enforced row names the command that produces its verdict. A rule with no command moves to "Measured, not yet enforced" or gets cut. For measure-and-hold, run the measurement now and record today's number with its direction. Done when you have run every enforced row's command once and read its output.

4. **Place each check by cost.** The edit loop takes checks under 5 seconds on changed files: types, lint, the floor. Task end takes checks inside the budget from step 2: related tests, coverage of changed lines, the floor guard. CI takes everything else. Add one `check` entry in the place this repo keeps its scripts, running the task-end set. Done when `check` is green on the base branch.

5. **Install the bar's scripts.** Copy every `.mjs` file from [`scripts/`](scripts/) and [`scripts/review.html`](scripts/review.html) into `scripts/` at the repo root; the other skills and the hooks call them there. `review.mjs` and `review.html` build the page a finished `/afk` run is reviewed on. Add `.verify/` and `.afk/` to `.git/info/exclude`: they hold receipts, evidence and handoff notes, never product code. Then:
   - Beside the scripts, write `floor-guard.config.json` with the confirmed stacks, so patterns for stacks this repo lacks stay off: `{ "stacks": ["dotnet", "ts", "python"] }`. The guard knows `ts`, `dotnet`, `python` and `go`. For a stack it lacks, or a suppression style this repo uses that it misses, add regex strings under `extra` (`suppress`, `stub`, `skip`, `test`, `assert`, `config`) instead of editing the scripts. Read the repo for those first: search for how existing code silences its linter and skips its tests.
   - Add the floor guard to `check`, and to CI when the setup is for the team; a personal setup leaves CI alone.
   - Make `check` run its whole set through `node scripts/receipt.mjs run check check -- <command>`, so every run leaves a **receipt**: the record of what ran, with which exit code, on exactly which content. `node scripts/gate.mjs check-green` reads it. The receipt covers one command: wrap a set as `-- sh -c '<first> && <second>'` or as one script entry, never as `-- <first> && <second>`, which records the first command alone.

   Prove the guard: on a throwaway branch add one suppression comment and confirm exit code 1, then discard the branch. Done when the guard is clean on the base branch and red on the throwaway, and a green `check` leaves `check-green` passing.

6. **Choose where `check` is enforced.** Ask one question. Recommend the first option when `docs/agents/handoff.md` says local branch, and the third for pull requests with CI.
   - **Before a merge into the base branch.** Copy [`scripts/githooks/`](scripts/githooks/) to `.githooks/` and fill `BASE` and `CHECK` in `.githooks/bar.conf`. `pre-merge-commit` runs `check` on the merge result when the current branch is the base. `pre-commit` does the same while `MERGE_HEAD` exists, which covers a merge finished after a conflict. Add `.githooks/** text eol=lf` to `.gitattributes`, so a Windows checkout keeps them runnable. They stay inactive until a clone runs `/setup-dili-skills`, which puts small wrappers that call them into `.git/hooks`, keeps any hook already there running first, and sets `--no-ff` for the base, since a fast-forward runs no hook.
   - **At the end of each agent turn.** `scripts/stop-check.mjs` as a Claude Code Stop hook runs `check` when files other than Markdown changed since the last green receipt. Offer it only when step 2's budget holds.
   - **In CI only.**

   Whichever is chosen, `scripts/no-verify.mjs` becomes a PreToolUse hook that refuses `--no-verify`, `git commit -n` and changes to `core.hooksPath`, so an agent cannot skip the hooks. `/setup-dili-skills` installs both Claude Code hooks into `.claude/settings.local.json`, where they bind only the person who ran it. Prove the first option in a throwaway clone (commit `.githooks/` to a throwaway branch, `git clone -b <that branch> . <scratch dir>`, then `node <setup-dili-skills>/scripts/activate.mjs on <base>` there): a branch with a failing test does not merge into the base, and a green branch does. Done when the choice and the `check` command are recorded in the "Check enforced" and "Check command" lines of `docs/agents/handoff.md` and, for the first option, both merges were observed.

7. **Find the outside opinion.** Rank every enforced row by who owns its verdict. **External**: a compiler, a vulnerability database, axe, Lighthouse. The agent cannot argue with these. **Project**: lint rules and boundaries a human owns. **Suite**: the project's own tests, which the agent can also rewrite. Done when at least one row is external, or the report says none exists and what it would take to add one.

8. **Report.** The file you wrote, what runs in the edit loop, at task end, before a merge and in CI, what is measured only, and what the user still has to do by hand (CI secrets, branch protection, tools that need approval to install).

## Rules

- **Loosening is loud.** Lowering a threshold, removing a rule or adding an exception gets its own commit and a line in the PR's Merge Danger. Tightening needs no ceremony.
- **The floor guard reports six moves**, the cheap roads to green: a threshold moved, a test made easier, a checker silenced, work left unfinished, an exception added, a checker's own config changed. Exit code 2 means the guard could not run. Report that as "could not run", never as clean.
- **A checker's config is part of the bar.** The guard flags any change to lint, compiler, test runner, CI or hook config, and to the check scripts in `package.json`. It cannot tell tightening from loosening there, so a person decides. `--warn-config` prints those findings without failing. Use it on a pull request where a person has approved the config change, and nowhere an agent runs alone.
- **Scope to the diff.** Coverage of changed lines is a number this change can move. Project coverage is inherited, so it is held, not targeted.
- **Machine-wide tools can run in CI only.** On a machine where installs need approval, say so in the row's "Runs at" cell.
- **Hooks are per clone.** The wrappers live in `.git/hooks`, which git never shares, so a clone runs no hook until `/setup-dili-skills` activates it there.
- **The merge hook covers merges only.** An explicit `--ff-only`, a cherry-pick or a rebase onto the base runs no hook. The flow reaches the base through merges, so this gap is accepted.
