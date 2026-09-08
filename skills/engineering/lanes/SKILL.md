---
name: lanes
description: Implement a set of tickets in parallel, one agent per dependency lane.
disable-model-invocation: true
---

# Lanes

Implement a set of tickets in parallel. Cut the tickets into **lanes**, give each lane its own git worktree, its own branch and its own agent, and merge each lane into the base branch as it reports in.

A **lane** is a chain of tickets that must run in order because each blocks the next. Lanes are independent of each other by construction, so they run at the same time.

`/implement` is the single-lane version of this. Use it when the tickets form one chain.

## Process

### 1. Collect the tickets and their blocking edges

Work from the argument the user passed: a directory of ticket files, issue numbers or URLs, a spec path. With no argument, use the tickets already in the conversation.

Read every ticket in full, including its **Blocked by** field or the tracker's native blocking links. A ticket with no recorded blockers is not automatically independent: read what it builds and record the edge yourself when one ticket plainly needs another's code.

Done when every ticket has a title, an acceptance criterion, and an explicit blocker list (possibly empty).

### 2. Cut the lanes

Apply these rules to the blocking graph:

- Start a lane at each ticket with no blockers.
- Extend a lane with any ticket whose only blocker is that lane's last ticket.
- When two tickets share one blocker, the lane forks: one of them extends the lane, the other starts a new lane.
- A ticket blocked by tickets sitting in more than one lane is a **join**. A join extends no lane; step 3 decides when it runs.

Worked example. Tickets 1-6, where 2 is blocked by 1, 3 is blocked by nothing, 5 is blocked by 4, and 6 is blocked by 2 and 5. Lane A is 1 then 2, lane B is 3, lane C is 4 then 5, and 6 is a join.

Then check for **collisions**: two lanes that must edit the same file. Grep the codebase for the symbols and files each lane's tickets name. A collision is a merge conflict you already know about, so resolve it at cut time in one of two ways: fold the two lanes into one, or hand the shared edit to whichever lane touches it first as a prefactor and let the other lane build on the merged result (which makes it a join).

Done when every ticket sits in exactly one lane or is marked a join, and every known collision has been folded or turned into a join.

### 3. Get the cut approved and settle the joins

Show the user a numbered list of lanes, each with its tickets in order, and a separate list of joins with what blocks each one.

For every join, ask which policy it runs under:

- **Eager**: the join starts the moment its blocking lanes have merged into the base branch, while other lanes are still running.
- **Held**: the join waits until every lane has reported back, then runs as a final lane on the fully merged base.

Also ask whether the lane cut is right and whether any lane should be split or folded.

Iterate until the user approves. Do not create a worktree before that.

### 4. Probe the repo and propose a setup plan

A fresh worktree holds only tracked files, so an agent lands in a tree that may not build or test. Probe the source tree and report what each lane's worktree needs:

- **Ignored files needed to run**: run `git status --ignored --porcelain` and read `.gitignore`. Look for dependency trees (`node_modules`, `vendor`, `.venv`, `target`), environment files (`.env*`), local config, seeded databases, certificates, build output that tests read.
- **Cost of the install**: read the lockfile and the package manager. Time the repo's install command in the source tree if you cannot tell. Copying a dependency tree with `cp -a` is usually faster than a clean install, and installing is safer when a package manager rewrites paths inside the tree.
- **Dev server**: does any lane's work need one running (browser checks, e2e tests, a watch-mode build)? Which lanes, and what port does the repo default to?
- **Shared external state**: one database, one docker compose stack, one seeded queue, a fixed port in a config file. Two lanes hitting the same one corrupt each other's runs.

Present a setup plan naming, per lane: what gets copied or installed, which env files get copied and what changes inside them, whether that lane runs a dev server and on which port, and how shared external state gets split.

Two rules the plan follows:

- **One owner per port and per external service.** Give the repo's default port to the lane that most needs it. Every other lane that needs a server gets its own port and env pointing at it. Lanes with no browser work run no server at all.
- **Namespace or serialise shared state.** Give each lane its own database name, schema, or docker project name. When that is impossible, fold the affected lanes into one lane so their runs never overlap.

Get the user's approval on the plan. Ask about anything the probe could not settle (a credential only they hold, a service that allows one connection).

### 5. Create the worktrees and prove them green

For each lane, from the base branch:

```bash
git worktree add ../<repo>-lane-<N> -b lane/<N>-<slug>
```

Apply the approved setup plan to each worktree, then run the repo's typecheck and test commands inside it.

Done when every lane worktree produces the same typecheck and test result as the base branch. Fix the setup until it does. Dispatching an agent into a worktree that cannot run the tests wastes the whole lane.

### 6. Brief and dispatch the lanes

Write one brief per lane following [`LANE-BRIEF.md`](LANE-BRIEF.md), then dispatch every ready lane at once as background agents.

Ready lanes are the ones with no unmet blockers. Eager joins stay undispatched until step 7 releases them; held joins stay undispatched until every lane has reported.

### 7. Merge each lane as it reports, then release the frontier

When a lane reports back:

1. Read its report against the brief's format. When a field is missing or a check was skipped, send the lane agent back to finish it rather than merging.
2. Merge its branch into the base branch. On conflict, use `/resolving-merge-conflicts`.
3. Run typecheck and the full test suite on the base branch. A red base blocks every later merge, so fix it before taking the next lane.
4. Release the **frontier**: dispatch any eager join whose blocking lanes have now merged. Give a released join a fresh worktree cut from the current base branch, set up per step 4's plan.

Repeat until every lane and eager join has merged. Then dispatch the held joins, and merge them the same way.

### 8. Verify and clean up

On the base branch, with everything merged: run the full test suite, then `/code-review`.

Remove the lane worktrees with `git worktree remove`, and delete the merged lane branches.

Report to the user: which lanes ran, what each delivered, every conflict you resolved and how, anything a lane left undone, and anything a lane discovered that changes the remaining work.
