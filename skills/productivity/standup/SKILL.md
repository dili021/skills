---
name: standup
description: Short Serbian bullet list of what got done on one workday, for a standup.
argument-hint: "Day to report (default: the last workday)"
disable-model-invocation: true
---

# Standup

A standup report: the day's results as a short bullet list, ready to paste into chat.

## Steps

1. **Pick the day.** The argument names it. Without one, take the last workday before today: on a Monday that is Friday. Done when you hold one date.

2. **Read the sessions.** Run `node <this skill's folder>/sessions.mjs <YYYY-MM-DD>`. It prints every Claude Code session active that day: its folder and the user's prompts with local times. Done when you have the list of folders and every task the prompts started.

3. **Read git.** In each folder from step 2 that is a git repo, run `git fetch -q`, then:
   - merged PRs: `git log origin/<main branch> --first-parent --since=<day> --until=<next day> --format="%s"`
   - the rest of the user's commits: `git log --all --author="$(git config user.name)" --since=<day> --until=<next day> --format="%h %D %s"`. The author filter drops checkpoint commits that tools write under their own name.

   Done when every commit of the day belongs to a merged PR, a branch in progress, or a housekeeping group.

4. **Confirm work outside git.** A prompt task with no commit (server access, a deploy, closed tickets) counts only once it finished. When the prompt shows only the request, grep that session's transcript (`~/.claude/projects/*/<session id>*.jsonl`) for the outcome. Done when each such task is confirmed or dropped.

5. **Find the ticket links.** In each repo, `docs/agents/issue-tracker.md` names the tracker and how to look a ticket up; get each ticket id's web URL that way. A repo without that file keeps its ids as plain text. Done when each id has a URL or is known to have none.

6. **Write the list** by the format below and hand it over in chat. Done when every merged PR, every branch with commits, and every confirmed outside task is an item.

## Format

- Serbian, bullets only: no heading, no intro, no closing line.
- Impersonal past participles, never first person: „Merge-ovano“, „Započet“, „Dodat“, „Povučene“.
- One short line per item, naming what a user or teammate gets. Ticket ids go in parentheses as Markdown links, `[F-06](<url>)`; an id with no URL stays plain text. Leave out PR numbers, branch names, commit hashes, file names and code.
- Merged PRs form one item, „Merge-ovano N PR-ova:“, with one nested line per PR. A PR that changes only tooling reads „izmena alata za …“.
- A branch with commits but no merge: „Započet <ticket> (…)“ when its first commit fell on that day, otherwise „Nastavljen <ticket> (…)“.
- Housekeeping commits of one kind (a contract pull, dependency bumps) together make one item, such as „Povučene nove izmene API draft-a“.
- Each confirmed outside task is one item.
- Questions, explanations and discussion that changed nothing are not items.

## Example

```
- Merge-ovano 5 PR-ova:
  - navigacija po ulozi, Dashboard kao početna ([F-06](<url>), [F-08](<url>))
  - provera reset linka pre forme ([F-44](<url>))
  - detalj novog izdavača posle Add publisher ([F-12](<url>), [F-45](<url>))
  - pokretanje aplikacije na lokalnom backend-u ([F-01.2](<url>))
  - izmena alata za proveru koda
- Povučene nove izmene API draft-a
- Započet [F-43](<url>) (module switch)
- Pavlu dodat SSH pristup GPU serveru
```
