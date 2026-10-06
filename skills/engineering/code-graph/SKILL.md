---
name: code-graph
description: How to use this repo's graphify code graph. Check it is fresh, then ask what a diff reaches, what two sets of files share, or where a feature enters the code. Use when a skill needs a blast radius, lane collisions or entry points and the repo has `graphify-out/`.
---

# Code graph

Some repos carry a [graphify](https://github.com/Graphify-Labs/graphify) graph at `graphify-out/graph.json`: the code parsed into nodes and edges, built locally with no model call. It answers what is connected to what. Every answer is a **lead** to confirm in the code or by driving the app. An edge marked `INFERRED` is a guess.

## The freshness gate

A graph that does not match the code under judgment gives confident wrong answers, so every use passes this gate first.

1. **Is there a graph in this checkout?** A git worktree starts without one, because `graphify-out/` is untracked. Build a code-only graph here when it is missing.
2. **Bring it to the commit you are judging.** Run graphify's update for this directory. A code-only update is local and incremental, so run it every time instead of reasoning about timestamps.
3. **Did the update succeed?** On any failure, or when `graphify` is not on `PATH`, the graph is **stale**. Leave it unused, say "code graph stale, not used" in your report, and fall back to grep.

Take the exact commands from `graphify --help` in this environment. They change between versions.

Done when the update exited cleanly at the commit you are judging, or you have reported the graph as stale.

## The hook

`graphify hook install` adds post-commit and post-checkout hooks that rebuild the graph, and `graphify hook status` reports them. `/setup-dili-skills` installs them. The hooks keep the primary checkout fresh between runs. The gate above still runs every time, because a hook fails silently and a worktree has no graph.

## The three questions

- **What does this diff reach?** List the changed files and symbols from `git diff --name-only <base>...<head>`. For each, ask the graph for its neighbours and for what depends on it, two hops out. Collect the modules reached and the user-facing entry points among them. When the repo has a `verify-<app>` skill, match those entry points to its feature map by name and path. The answer is a list of reached features, each with the chain of nodes that connects it to the diff.
- **What do these two sets of files share?** For each pair of key symbols, one from each set, ask for the path between them. A short path through a shared module is a collision to resolve before the work starts.
- **Where does this feature enter the code?** Ask for the nodes behind a route, a command or a menu label, and read them.

## Reporting

Name the source of every claim: "from the code graph at `<short sha>`" or "from grep, code graph stale". Reach is a claim about structure. Whether a reached feature still works is settled by driving it.
