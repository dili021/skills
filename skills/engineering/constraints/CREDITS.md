# Credits

The model here comes from [Addy Osmani](https://github.com/addyosmani)'s [`constraint-driven-development`](https://github.com/addyosmani/agent-skills/blob/main/skills/constraint-driven-development/SKILL.md) skill: a `CONSTRAINTS.md` whose every row names its checking command, measure-and-hold in place of invented targets, checks placed by cost, and the five moves an agent makes to reach green. `SKILL.md` and the template are rewritten shorter for this repo.

[`scripts/floor-guard.mjs`](scripts/floor-guard.mjs) is his reference implementation from `references/floor-guard.md` at commit `1401c8b`, with one addition of mine: the `checker-config-changed` rule and its `--warn-config` flag. MIT, see `LICENSE.addyosmani` at the repo root. The untouched original is in `sources/addyosmani/`.
