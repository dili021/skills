---
name: whiteboard-defense
description: Explain a shipped system so I can defend it at a whiteboard.
disable-model-invocation: true
argument-hint: "topic, ticket or branch (empty: pick from the active branch or PR)"
---

# Whiteboard defense

The user must be able to explain, without the code in front of them, any customer-facing system they shipped: how it works and why it is built that way. This skill is the lesson before that whiteboard. Teach; the user runs their own examination and asks follow-ups.

**Learner profile**: experienced in frontend and in the banking domain; beginner in backend and in AI/LLM systems. Define every backend or AI term the first time it appears, in one sentence. Edit this line as the profile changes.

## Process

1. **Pick the topic.** With an argument, that is the topic. Without one, read the active branch or PR against its base, list the systems it touches, and offer the three whose defense matters most. The user picks. Done when one topic is agreed.
2. **Read the primary sources.** Code, ADRs, tickets, specs and git history for the topic, before explaining anything. Done when every decision you are about to name has a source you can cite by path or commit.
3. **Explain, in this order, all five every time**:
   1. **How it works** at the level of components and data flow. Function names only where a defender would need them.
   2. **Why X and not Y**: each significant decision, the alternative that was on the table, and the reason.
   3. **The malicious actor**: who can feed this system bad input or misuse its output, and what happens.
   4. **Data structures**: what is stored or passed, in what shape, and why that shape.
   5. **Where it fails**: known failure points, what the user sees, how it is detected.

   A rung with no content gets one sentence saying so. Done when all five rungs are covered for the topic and the user has been invited to ask follow-ups.

## Rules

- **Every reason has a source, or is labelled.** For a decision with no recorded reason, say "unrecorded" or "inherited" (copied from a predecessor and never revisited), then offer what a good reason would be, marked as your proposal. At the whiteboard, "we inherited this and have not revisited it" survives; an invented rationale does not.
- **Separate "here" from "in general".** Repo facts come from step 2. General knowledge is allowed only to define a concept the learner lacks (what OCR is, what a graph node is), and is introduced as general.
- **Conversation only.** Talk at the granularity of the five rungs; the user drills into a rung when they want more. Write a document only when asked.
- **Stateless.** Each run starts fresh. For a gap wider than one system (what RBAC is, how LLM tool calling works), point to `/teach` for that topic.
