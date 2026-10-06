---
name: verdict
description: Independent verdict on whether a change does what its ticket says, from an agent that did not write it. Use before calling work done or merge-ready, or when the user asks to verify a change.
---

# Verdict

A **verdict** is PASS, PASS+NOTES or FAIL on a change, given by an agent that did not write it, after driving the real app. Passing tests and green CI are evidence for a verdict. They are never the verdict.

## Process

1. **Assemble the contract.** Collect the acceptance criteria from the ticket, the spec or the user's finish condition, each with its **Proven by** line. Add the base ref, the head ref, and the project's `verify-<app>` skill when one exists. When no criteria are written anywhere, write them from the request and mark them "assumed" in the report. Done when every criterion is a sentence someone can check by running something.

2. **Run the floor guard** when the repo has one: `node scripts/floor-guard.mjs --base <base>`. Exit code 1 findings go into the verdict. Exit code 2 is reported as "guard could not run".

3. **Dispatch the verifier.** A fresh subagent, on a different model from the one that wrote the code when the harness offers one. Brief it with [`VERIFIER-BRIEF.md`](VERIFIER-BRIEF.md). It receives the contract, the two refs and the way to run the app. The implementer's report, the diff summary and this conversation stay behind, because a verifier handed the conclusion checks the conclusion.

4. **Reconcile.** The verifier's report is data. Re-read each FAIL and each note against the criterion's text, then sort it:
   - **Contract unclear**: the criterion was ambiguous. Fix the criterion, run the verifier again.
   - **Real**: the change fails. Fix it, run the verifier again.
   - **Accepted trade-off**: real, and cheaper to accept than to fix. State it in the report.
   - **Noise**: the verifier lacked context. Name the context it lacked.

   Stop after three rounds. A fourth round means the change or the contract is wrong, and the report says which.

5. **Report** one table with a row per criterion: the criterion, PASS, FAIL or INCONCLUSIVE, the evidence path, and who verified. Under it: the floor guard result, accepted trade-offs, and the overall verdict.

## Rules

- **A criterion with no evidence is INCONCLUSIVE**, and INCONCLUSIVE fails the verdict.
- **The surface has to match.** A UI criterion proven by a unit test alone is INCONCLUSIVE.
- **Evidence is a path or a command with its output**, kept where the report says, and it survives cleanup.
- **The author never issues the verdict.** A subagent that cannot spawn a verifier reports "verdict owed" to its orchestrator.
- **A verdict covers the commit it ran on.** Product code pushed after it needs a new verdict. Changes to tests, docs or lint config alone keep it.
- **No `verify-<app>` skill**: the verifier uses the project's own run command, the report says the proof was improvised, and it recommends `/create-verification-skill`.
