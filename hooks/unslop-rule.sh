#!/usr/bin/env bash
# Fires once per session. Stdout on exit 0 becomes context the agent can see, so this is
# where the always-on writing rule lives: a skill alone is not enough, because nothing
# guarantees a model loads one before it starts typing.
#
# Keep it short. It is paid for in every session.
set -euo pipefail
SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/skills/writing/unslop/SKILL.md"

cat <<TXT
Writing rule for this session (from the unslop skill):

Before you write prose for a person, read $SKILL and apply it. That covers replies in the
transcript, commit messages, PR descriptions and titles, code comments, docs and reports.
Not code, identifiers, or quoted output.

The rules you break most: no em dashes (rule 13), no "not just X, but Y" (9), no bolded
label that restates its own line (16), no chatbot filler or sycophancy (20, 22), no
abstract metaphor nouns like substrate, surface, primitive, flywheel (26), active voice
with the actor named (29), plain word over the fancy synonym (31).
TXT
