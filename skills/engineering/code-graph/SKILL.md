---
name: code-graph
description: How to use this repo's graphify code graph. Refresh it, then ask what a diff reaches, what two sets of files share, or where a feature enters the code. Use when a skill needs a blast radius, lane collisions or entry points and the repo has `graphify-out/`.
---

# Code graph

Some repos carry a [graphify](https://github.com/Graphify-Labs/graphify) graph at `graphify-out/graph.json`: the code parsed into symbols and the calls, imports and references between them, built locally with no model call. It answers what is connected to what. Every answer is a **lead** to confirm in the code or by driving the app.

## What a diff reaches

Run the script from this skill's folder, inside the checkout that holds the change:

```bash
node <this skill's folder>/scripts/reach.mjs --base <base ref> [--depth 3] [--json]
```

It refreshes the graph, maps every changed line to the symbol that owns it, and walks the edges backwards. The output has four parts: the changed symbols, the symbols reached outside the changed files with the hop count and the edge that led there, the changed files the graph has no symbols for, and the deleted files.

- **Exit 0**: use the reach. Name its source in your report: "from the code graph at `<short sha>`".
- **Exit 2**: there is no usable graph, because graphify is missing or the refresh failed. Report "code graph stale, not used" and fall back to grep.

When the repo has a `verify-<app>` skill, match the reached files and symbols to its feature map. A reached feature is one the verifier should drive.

## What the reach leaves out

- **It stops at a language boundary.** An Angular service and the .NET route it fetches are joined by a URL string, which the graph cannot follow. The same holds for a service called over HTTP or a queue. For a changed route, DTO or message, grep the other side for its name.
- **It misses some calls.** A call through a fully qualified name, reflection or dependency injection by string can leave no edge. A symbol absent from the reach is unproven, and a hop marked `inferred` is a guess.
- **Templates, styles, config and docs have no symbols.** The script lists them. Check those by grep.

Reach is a claim about structure. Whether a reached feature still works is settled by driving it.

## The freshness gate

The script runs it for you. When you query the graph by hand, pass it first:

1. A git worktree starts without a graph, because `graphify-out/` is untracked. Build one there: `graphify extract . --code-only`.
2. Otherwise bring the graph to the code in front of you: `graphify update .`. It is local and incremental, so run it every time.
3. When either command fails, the graph is **stale**. Leave it unused and say so.

The git hooks from `graphify hook install` rebuild the graph after a commit or a checkout, in the background. The gate still runs, because that rebuild may not have finished and a worktree has no graph.

## Other questions

- **What do these two sets of files share?** `graphify path "<a>" "<b>"` prints the shortest chain between two nodes. Run it for pairs of key files, one from each set. A short chain through a shared module is a collision to settle before the work starts.
- **Where does this feature enter the code?** `graphify query "<question>"` walks the graph from the nodes that match, and `graphify explain "<node>"` lists one node's connections.
- **What depends on this one symbol?** `graphify affected "<node>" --depth 2`.

Name a node by its file path or by its `id` from `graph.json`. A bare class name that exists in two stacks matches nothing.
