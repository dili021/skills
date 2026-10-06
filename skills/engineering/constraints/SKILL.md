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

1. **Read before asking.** Find the stack, the test runner, the linters, today's coverage, the CI workflows and any agent hooks. Report what you found in two lines. Done when you can name the typecheck, lint and test commands, or say which one is missing.

2. **Ask four questions, one at a time, each with a default.** "I don't know" takes the default.
   - Which dimensions beyond the floor: coverage of changed lines, security scanning, performance budgets, accessibility, architecture boundaries. Default: coverage and security.
   - Does a failing check block the agent mid-task, or warn? Default: the floor blocks, the rest warns for the first two weeks.
   - Target numbers, or measure today and hold that line? Default: measure and hold.
   - The slowest check tolerated before work is handed back. Default: 90 seconds at task end, no limit in CI.

   Done when all four have an answer or a default.

3. **Write `CONSTRAINTS.md`** from [`CONSTRAINTS-TEMPLATE.md`](CONSTRAINTS-TEMPLATE.md). Every enforced row names the command that produces its verdict. A rule with no command moves to "Measured, not yet enforced" or gets cut. For measure-and-hold, run the measurement now and record today's number with its direction. Done when you have run every enforced row's command once and read its output.

4. **Place each check by cost.** The edit loop takes checks under 5 seconds on changed files: types, lint, the floor. Task end takes checks inside the budget from step 2: related tests, coverage of changed lines, the floor guard. CI takes everything else. Add one `check` entry in the place this repo keeps its scripts, running the task-end set. Done when `check` is green on the base branch.

5. **Install the floor guard.** Copy [`scripts/floor-guard.mjs`](scripts/floor-guard.mjs) into the repo's scripts directory, add it to `check` and to CI, and extend its three patterns for this stack. Prove it: on a throwaway branch add one suppression comment and confirm exit code 1, then discard the branch. Done when the guard is clean on the base branch and red on the throwaway.

6. **Find the outside opinion.** Rank every enforced row by who owns its verdict. **External**: a compiler, a vulnerability database, axe, Lighthouse. The agent cannot argue with these. **Project**: lint rules and boundaries a human owns. **Suite**: the project's own tests, which the agent can also rewrite. Done when at least one row is external, or the report says none exists and what it would take to add one.

7. **Report.** The file you wrote, what runs in the edit loop, at task end and in CI, what is measured only, and what the user still has to do by hand (CI secrets, branch protection, tools that need approval to install).

## Rules

- **Loosening is loud.** Lowering a threshold, removing a rule or adding an exception gets its own commit and a line in the PR's Merge Danger. Tightening needs no ceremony.
- **The floor guard reports six moves**, the cheap roads to green: a threshold moved, a test made easier, a checker silenced, work left unfinished, an exception added, a checker's own config changed. Exit code 2 means the guard could not run. Report that as "could not run", never as clean.
- **A checker's config is part of the bar.** The guard flags any change to lint, compiler, test runner, CI or hook config, and to the check scripts in `package.json`. It cannot tell tightening from loosening there, so a person decides. `--warn-config` prints those findings without failing. Use it on a pull request where a person has approved the config change, and nowhere an agent runs alone.
- **Scope to the diff.** Coverage of changed lines is a number this change can move. Project coverage is inherited, so it is held, not targeted.
- **Machine-wide tools can run in CI only.** On a machine where installs need approval, say so in the row's "Runs at" cell.
