---
name: afk
description: Drive a task from its brief to a merge-ready pull request or branch while I am away.
disable-model-invocation: true
argument-hint: "ticket, spec, issue or problem statement"
---

# AFK

Take a task from its brief to **merge-ready** without the user: built, proven, reviewed, green, with the evidence written down. `docs/agents/handoff.md` says what merge-ready is in this repo: a pull request that is ready for review, or a local branch with a handoff note. The user merges. This skill never merges, deploys or force-pushes.

## The contract

1. **Preflight the project.** Look for `CONSTRAINTS.md` with its `check` command, `scripts/gate.mjs`, the verify guide `docs/agents/verify.md`, `docs/agents/handoff.md`, CI on pull requests when the handoff is a pull request, and a clean working tree. For each one missing, say what it costs this run (without a verify CLI, UI criteria come back INCONCLUSIVE; without the gate, the run class is your own judgement) and that `/setup-dili-skills` adds it. Done when each is present or the cost is stated in the contract.

2. **Reproduce, when the brief is a problem.** Drive the app on the base branch, with `verify/cli` when there is one, until you see the problem yourself. Keep that evidence as the "before". A problem you cannot reproduce after driving it as far as the tools reach ends the run as **blocked**, with what you tried.

3. **Write the finish condition as a predicate**, a list of statements a command or a driven user path can pass or fail.
   - From tickets, it is every acceptance criterion with its **Proven by** line.
   - From a problem, write the criteria yourself: the reproduction now shows the right result, the nearest unhappy path behaves, and the neighbouring behaviour stays as it was. Mark these `assumed`.

   A duration is never a finish condition. Done when nothing on the list needs a human to judge it.

4. **Sort the open questions.** A question whose answer is a fact you can observe by running something is yours: settle it during the run with an experiment or a prototype. A product or preference call is the user's.

5. **Pick the route** from the tickets' blocking graph.
   - One ticket, one chain, or a problem you have written up as one ticket: call the Skill tool with `implement`.
   - Two or more independent chains: call the Skill tool with `lanes`. Its lane cut and setup plan need the user's approval, so they are part of this contract.
   - A problem too large for one ticket needs `/grill-with-docs` and `/to-tickets` with the user present. Stop and say so.

6. **Start, or wait.** Start without waiting when all three hold: the change is **small**, no product question is open, and nothing on the stop list is in the plan. Small means all of: one ticket on the `implement` route, no schema migration, no new dependency, and no change to a contract between parts (an API shape, a DTO, a message or file schema another component reads). Post the contract in one message and begin. In every other case, post the contract and wait for a clear yes. The contract is the finish condition, the route, the user's questions each with your recommended answer, the stop list and the escape hatch.

## The run

7. **Isolate and log.** Work in a git worktree off the base branch. `lanes` makes its own. Keep this run's files in `.afk/<branch>/` in the primary checkout, where they outlive the worktree: the decision log as `decisions.tsv`, the evidence in `evidence/`, the handoff note as `HANDOFF.md`. The review page reads them under those names. Call the Skill tool with `show-me-your-work` and keep its log there for the whole run.

8. **Build through the route.** `implement` and `lanes` build test-first, run the project's `check` command, and end on `code-review` and `verdict`. Advance only from green.

9. **Stay unblocked.** Decide reversible things yourself, log the decision with its reason, continue. For a preference question that appears mid-run, take the answer you would recommend, log it under phase `assumed`, continue.

10. **Hold the stop list.** These wait for the user, with the run's state intact: deploys, data migrations and deletions, force-pushes, changes to auth, permissions or payments, anything touching secrets, messages to people outside the repo, lowering the bar, and anything `git revert` cannot undo. **Lowering the bar** is any change that makes a check easier to pass while the code stays the same: a threshold in `CONSTRAINTS.md`, a lint or compiler rule turned off or down, a skipped test, a suppression comment, a check moved out of `check` or CI. Keep working on whatever the waiting item does not block.

11. **Keep the predicate fixed.** A plateau means a different approach. Three failed attempts at the same failure trigger the escape hatch: stop, and write up what you tried, what you observed and what you would try next. Bugs you find outside the task get a logged note or an issue, and stay unfixed.

## The handoff

12. **Read the proof.** The route has already run `code-review` and `verdict`. A verdict that still fails after its three rounds makes this run **flawed**.

13. **Write the handoff.** Call the Skill tool with `pr` for the body, and put an **Attention** section first: every `assumed` criterion and decision, every INCONCLUSIVE criterion, every FAIL the verdict sorted as Contract unclear, Accepted trade-off or Noise with its reason, every stop-list item still waiting.
    - **Pull request**: open it ready for review on PASS or PASS+NOTES. Otherwise open it as a draft that names what is missing.
    - **Local branch**: write the body to `.afk/<branch>/HANDOFF.md` with only what the records cannot say: Attention, Summary, Merge Danger, and what you tried and discarded. Put the before and after evidence files in `.afk/<branch>/evidence/` and name them in one line. The criteria, the gate output and every evidence file reach the review page from the receipts. Push the work branch only when `docs/agents/handoff.md` says so, and never the base branch.

14. **Bring it to green on the current base.**
    - **Pull request**: watch the checks with the git host's CLI (`gh`, `glab` or `az`). Batch every known fix into one push. Fix real review-bot findings and dismiss noise with the reason stated on the thread.
    - **Local branch**: merge the base branch's tip into the work branch, then run `check` there, which writes its receipt, the full test suite, and the full proof run `node scripts/receipt.mjs run prove all -- verify/cli prove` when the repo has a verify CLI. These are the last gate. When the branch was pushed and the git host ran checks on it, read those too. Leave the base branch as it is.

    Product code committed after the verdict needs a new verdict, and so does a base merge that brought product code: run `/verdict` again when `node scripts/gate.mjs verdict-fresh` fails.

15. **Propose lessons.** List this run's candidates for `docs/agents/lessons.md` as ready-to-add rows: each verdict round that failed for a real reason, each floor guard finding, each time you assumed or asked what the code already answered. Add them when the user says so. When the user later overturns an `assumed` criterion, that is a row too.

16. **Reply with the run's class first**. On a local branch, first run `node scripts/review.mjs --class "<class>"` in the run's worktree, where the work branch is checked out, and put the page path it prints right after the class. Then the PR link, or the branch name with the path to its handoff note and the merge command from `docs/agents/handoff.md`, the predicate's state line by line, the Attention list, the proposed lessons, and what you tried and discarded:
    - **merge-ready**: verdict passed, checks green on the current base, nothing waiting. On a local branch this class needs `node scripts/gate.mjs merge-ready`, run in the run's worktree, to exit 0; quote its output. Without the gate, say the class is your own judgement.
    - **needs you**: a stop-list item or a product call is waiting.
    - **flawed**: the verdict still fails after three rounds.
    - **blocked**: access, credentials or environment are missing, or the problem did not reproduce.
