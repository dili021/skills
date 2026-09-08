# Lane brief

What the orchestrator sends each lane agent when it dispatches the lane. Fill every field. A lane agent starts cold: it knows only what this brief carries.

## Template

<lane-brief>

You own **lane <N>**. Work only inside `<worktree path>`, on branch `lane/<N>-<slug>`.

**Your tickets, in this order:**

1. <ticket title> — <what it delivers, and its acceptance criteria>
2. …

**How the repo runs here:** <install or copy that was already applied; the typecheck command; the test command; the dev server command and the port assigned to this lane, or "run no dev server"; the database name, schema or docker project name reserved for this lane>.

**Files you own:** <paths or areas this lane's tickets touch>.

**Files another lane owns:** <paths this lane must leave alone, and which lane owns them>. When a ticket turns out to need one of these, stop and report instead of editing it.

**How to work:**

- Use `/tdd` at the seams the tickets name. Typecheck often, run single test files as you go, and run the full suite once at the end.
- Commit to your own branch as you finish each ticket.
- Stay on your branch. Do not merge, rebase, pull, or switch branches, and do not touch the base branch or any other lane's worktree.
- Start a dev server only on the port assigned above.

**Stop and report early when:** a ticket needs a file another lane owns, a blocker you were told was done turns out to be missing, the setup in your worktree is broken, or an acceptance criterion contradicts the code you find.

**Report back with exactly these fields:**

- **Tickets done**: each one, with the commit that finished it.
- **Tickets not done**: each one, and what stopped you.
- **Files changed**: the paths, and any file you touched that falls outside the ones you own.
- **Checks**: the typecheck and test commands you ran, and their results verbatim. Say plainly when a check failed or you skipped it.
- **Affects other lanes**: anything you found that changes another lane's work: a shared type you altered, an interface that moved, a migration you added, an assumption in the tickets that turned out to be wrong.
- **Left for the orchestrator**: anything you deliberately did not do.

</lane-brief>

## Filling it in

- The **files you own** and **files another lane owns** fields come out of the collision check in step 2 of `SKILL.md`. When the check found nothing shared, say so rather than leaving the field blank.
- Copy the run commands from the setup plan you already proved green in step 5. Do not make the lane agent rediscover how the repo builds.
- A released join's brief adds one line: the lanes that merged before it started, and what they changed, taken from their reports.
