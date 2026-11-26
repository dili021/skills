# Dili skills

Skills, hooks and scripts that shape how agents work and write for one user. This glossary covers terms that the skills share.

## Writing feedback

**Correction** (ispravka):
A pair of an agent's text and the version of it the user accepted. The accepted version is either the user's own edit (a changed PR description, an amended commit) or the agent's rewrite after a remark that drew no further objection.
_Avoid_: fix, edit, feedback

**Remark** (primedba):
A user's objection to an agent's text that names what is wrong but leaves no accepted version behind. The wording varies; "too long", "too vague" and "give an example" are all remarks.
_Avoid_: complaint, comment, feedback

## Tuning unslop

**Cycle** (ciklus):
One run of a bulk phase followed by a cut phase, ending in the user's keep-or-revert decision for the whole run.

**Bulk phase**:
The part of a cycle that adds or rewrites rules for as long as the score rises.
_Avoid_: grow phase, expansion

**Cut phase**:
The part of a cycle that removes, merges or shortens rules for as long as the score stays within the threshold of the score at the end of the bulk phase.
_Avoid_: prune phase, compression
