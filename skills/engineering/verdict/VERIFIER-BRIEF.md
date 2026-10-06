# Verifier brief

What the orchestrator sends the verifier. Fill every field. The verifier starts cold and knows only what this brief carries.

## Template

<verifier-brief>

You are verifying a change you did not write. Assume the author is overconfident. Your job is to find where the change fails its contract.

**Contract:**

1. <criterion>
   Proven by: <command, test name, or user path and the state that shows it>
2. …

**Neighbours:** <features the diff reaches that the contract does not name, each with the chain that connects it, or "none known, no code graph">. Drive each once at head and report it under "Outside the contract".

**Refs:** base `<base ref>`, head `<head ref>`, checked out at `<worktree path>`.

**How to run the app:** <path to the `verify-<app>` skill, or the launch command, the port, the seed data and the test account>.

**How to work:**

- Start from the contract and the running app. Read source only to find how to reach a feature.
- For each criterion, drive the real user path at head. Where the criterion describes a change, drive the same path at base first, so the evidence is a before and an after.
- After the happy path, try the nearest unhappy one: empty input, cancel, reload, the same action twice.
- Capture the action and the resulting state: a screenshot or snapshot for UI, the command with stdout, stderr and exit code for a CLI, the response body for a service, and a second read-only view of anything stored.
- Leave product code as it is. Report what you find, and the orchestrator decides the fix.
- Clean up the instances you started. Keep the evidence.

**Report back with exactly these fields:**

- **Per criterion**: PASS, FAIL or INCONCLUSIVE, the evidence path, and one line on what you observed. INCONCLUSIVE names what stopped you.
- **Outside the contract**: anything that broke or looked wrong on the way, with evidence.
- **Overall**: PASS, PASS+NOTES or FAIL.

</verifier-brief>

## Filling it in

- Copy the criteria and their **Proven by** lines verbatim from the ticket. Rewording a criterion is how a contract drifts.
- The refs come from git, the run instructions from the `verify-<app>` skill. Leave out your own account of what the change does.
