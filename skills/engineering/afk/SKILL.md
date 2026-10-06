---
name: afk
description: Drive a task from its brief to a merge-ready pull request while I am away.
disable-model-invocation: true
argument-hint: "ticket, spec, issue or problem statement"
---

# AFK

Take a task from its brief to a **merge-ready** pull request without the user: built, proven, reviewed, CI green, evidence in the PR body. The user merges. This skill never merges, deploys or force-pushes.

## The gate, before the user leaves

1. **Preflight the project.** Look for `CONSTRAINTS.md` with its `check` command, a `verify-<app>` skill, CI that runs on pull requests, and a clean working tree. For each one missing, say what it costs this run (without a verify skill, UI criteria come back INCONCLUSIVE) and name the skill that adds it: `/constraints`, `/create-verification-skill`. Done when each is present or the user has said to run without it.

2. **Write the finish condition as a predicate.** A list of statements a command or a driven user path can pass or fail. From tickets, that is every acceptance criterion with its **Proven by** line. A duration is never a finish condition. Done when nothing on the list needs a human to judge it.

3. **Pick the route.**
   - One ticket or a small fix: build it in this session the way `/implement` does.
   - A ticket set: run `/lanes` steps 1 to 4 now, so the lane cut, the join policies and the setup plan are approved here.
   - A raw problem with no spec: attempt it directly when it is small and `git revert` undoes it. Anything larger needs `/grill-with-docs` with the user present, so stop and say so.

4. **Sort the open questions.** A question whose answer is a fact you can observe by running something is yours: settle it during the run with an experiment or a prototype. A product or preference call is the user's: ask all of them now, in one message, each with your recommended answer.

5. **Present the contract and wait for a clear yes.** The finish condition, the route, the answers from step 4, the stop list below, and the escape hatch. This is the only approval. Done when the user approves.

## The run

6. **Isolate and log.** Work in a git worktree off the base branch. Start a decision log with the `show-me-your-work` skill.

7. **Build in verifiable units.** One change, its check, one commit. Use `/tdd` at the seams. Run the project's `check` command at the end of each unit, and advance only from green.

8. **Stay unblocked.** Decide reversible things yourself, log the decision with its reason, continue. For a preference question that appears mid-run, take the answer you would recommend, log it under phase `assumed`, continue.

9. **Hold the stop list.** These wait for the user, with the run's state intact: deploys, data migrations and deletions, force-pushes, changes to auth, permissions or payments, anything touching secrets, messages to people outside the repo, loosening `CONSTRAINTS.md`, and anything `git revert` cannot undo. Keep working on whatever the waiting item does not block.

10. **Keep the predicate fixed.** A plateau means a different approach. Three failed attempts at the same failure trigger the escape hatch: stop, and write up what you tried, what you observed and what you would try next. Bugs you find outside the task get a logged note or an issue, and stay unfixed.

## The handoff

11. **Review.** Run `/code-review` against the base branch and fix what it finds.

12. **Prove.** Run `/verdict`. On FAIL, fix and run it again, inside its three-round limit.

13. **Open the pull request** with the `pr` skill's body, and put an **Attention** section first: every `assumed` decision, every INCONCLUSIVE criterion, every accepted trade-off, every stop-list item still waiting. Open it ready for review on PASS or PASS+NOTES. Otherwise open it as a draft that names what is missing.

14. **Drive CI to green.** Watch the checks with the project's forge CLI. Batch every known fix into one push. Fix real review-bot findings and dismiss noise with the reason stated on the thread. Product code pushed after the verdict needs a new verdict.

15. **Reply with the run's class first**, then the PR link, the predicate's state line by line, the Attention list, and what you tried and discarded:
    - **merge-ready**: verdict passed, CI green, nothing waiting.
    - **needs you**: a stop-list item or a product call is waiting.
    - **flawed**: the verdict still fails after three rounds.
    - **blocked**: access, credentials or environment are missing.
