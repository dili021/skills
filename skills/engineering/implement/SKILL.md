---
name: implement
description: "Build one ticket, or one chain of tickets, in this session: test-first, reviewed, then proven. Use when the work is a single ticket or tickets that each block the next."
---

Implement the work described by the user in the spec or tickets.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly and single test files regularly. Once, at the end, run the project's `check` command from `CONSTRAINTS.md` (or the full test suite when the repo has none), and fix until it is green.

Once done, use /code-review to review the work, then /verdict to prove it against the acceptance criteria.

Commit your work to the current branch.

## The handoff

When `/afk` or `/lanes` called you, return to it: it writes the handoff.

When the user called you directly, hand off the way `/afk` does, by steps 13, 15 and 16 of [`../afk/SKILL.md`](../afk/SKILL.md):

- Write `.afk/<branch>/HANDOFF.md`: the Attention section in two parts, **For you** and **Info**, then Summary, Merge Danger, **Lessons** and what you tried and discarded.
- Push and open a pull request only when the user asked for one; otherwise "push and open the PR" is the first For you item. When a PR exists, its Attention items become threads, in the form `docs/agents/handoff.md` gives.
- Build the review page with `node scripts/review.mjs --class "<class>"`, then reply short, in the five parts of step 16. The walkthrough link is offered, not started.
