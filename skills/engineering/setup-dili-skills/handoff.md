# Handoff

How a finished run reaches the person who merges. `/afk` reads this file. No skill merges.

**Mode:** <pull request | local branch>

**Base branch:** <name>

**Push the work branch:** <yes | no>, used in local-branch mode only

## Pull request

The run ends on a pull request that is ready for review, opened with `<forge CLI>`. CI runs on it. The body follows the `pr` skill, with an Attention section first.

## Local branch

The run ends on a branch that is up to date with the base branch and green there. With "Push the work branch: no", nothing leaves the machine. With "yes", the run pushes the work branch and nothing else, so whatever the forge runs on a pushed branch runs on it. The handoff note, the decision log and the evidence sit in `.afk/<branch>/` in the primary checkout, which git ignores through `.git/info/exclude`.

To merge with the note as the commit message:

```bash
git merge --no-ff <branch> -F .afk/<branch>/HANDOFF.md
```
