---
name: standup
description: Short Serbian bullet list for a standup, what got done on the last workday and what is planned today.
argument-hint: "Day to report (default: the last workday)"
disable-model-invocation: true
---

# Standup

A standup report: the reported day's results and today's plan as short bullet lists, ready to paste into chat.

## Steps

1. **Pick the day.** The argument names it. Without one, take the last workday before today: on a Monday that is Friday. Done when you hold one date.

2. **Read the sessions.** Run `node <this skill's folder>/sessions.mjs <YYYY-MM-DD>`. It prints every Claude Code session active that day: its folder and the user's prompts with local times. Done when you have the list of folders and every task the prompts started.

3. **Read git.** In each folder from step 2 that is a git repo, run `git fetch -q`, then the commands below. Give both bounds with a time, `"<day> 00:00"`: a bare date means that date at the current time, so the next day's morning leaks in.
   - merged PRs: `git log origin/<main branch> --first-parent --since=<day> --until=<next day> --format="%s"`
   - the rest of the user's commits: `git log --all --author="$(git config user.name)" --since=<day> --until=<next day> --format="%h %D %s"`. The author filter drops checkpoint commits that tools write under their own name.

   Done when every commit of the day belongs to a merged PR, a branch in progress, or a housekeeping group.

4. **Confirm work outside git.** A prompt task with no commit (server access, a deploy, closed tickets) counts only once it finished. When the prompt shows only the request, grep that session's transcript (`~/.claude/projects/*/<session id>*.jsonl`) for the outcome. Done when each such task is confirmed or dropped.

5. **Read today's plan.** For each repo, collect: branches still in progress, the next tickets in the repo's plan notes (such as `.afk/*/NEXT.md` or a wave file), a deploy waiting for merged work, and the open remainder of a ticket that was only partly done. Done when each of these is a "Danas" item or known not to apply.

6. **Find the ticket links.** In each repo, `docs/agents/issue-tracker.md` names the tracker and how to look a ticket up; get each ticket id's web URL that way. A repo without that file keeps its ids as plain text. Done when each id has a URL or is known to have none.

7. **Write the report** by the format below and hand it over in chat. Done when every merged PR, every branch with commits, every confirmed outside task and every planned item from step 5 is an item.

## Format

- Serbian, two parts. Each starts with a plain line, „Juče“ for the reported day (its weekday name, such as „Petak“, when that day was not yesterday) and „Danas“ for the plan, followed by its bullets. No intro, no closing line.
- Impersonal forms, never first person: „Spojeno“, „Započet“, „Dodat“, „Povučene“, „Nastavlja se“. The participle agrees with the work it names: „Započet raspored…“, „Započeti deljeni linkovi…“.
- One short line per item: first the work, in words a user or teammate understands, then its tickets in parentheses as Markdown links, `[F-06](<url>)`. Parentheses hold only ticket ids, never a description; the line's text never names a ticket. A line with no ticket has no parentheses. An id with no URL stays plain text. Leave out PR numbers, branch names, commit hashes, file names and code.
- Merged PRs form one item, „Spojeno N PR-ova:“, with one nested line per PR. A PR that changes only tooling reads „izmena alata za …“.
- A branch with commits but no merge: „Započet <work> (<ticket>)“ when its first commit fell on that day, otherwise „Nastavljen <work> (<ticket>)“.
- Housekeeping commits of one kind (a contract pull, dependency bumps) together make one item, such as „Povučene nove izmene API draft-a“.
- Each confirmed outside task is one item.
- Questions, explanations and discussion that changed nothing are not items.

## Example

```
Juče
- Spojeno 5 PR-ova:
  - napredak, lista i preuzimanje exporta ([F-36](<url>))
  - javna stranica deljenog linka ([F-38](<url>))
  - na stagingu /blob/ prosleđuje na Azurite, pa fajlovi mogu da se preuzmu ([F-46](<url>))
  - naziv exporta i vreme sledećeg retake pokušaja, ugovor usklađen sa backendom ([F-36.3](<url>), [F-31.5](<url>))
  - frontend bugovi iz prvog QA sa staginga, uz logo i favicon ([#4124](<url>))
- Staging podignut na main sa /blob/ prosleđivanjem ([F-46](<url>))
- Započet raspored u uskim i niskim prozorima, brži testovi ([F-47](<url>))
- Započeti deljeni linkovi kao tab na strani Exports ([F-37](<url>))

Danas
- Nastavlja se raspored u uskim i niskim prozorima, testovi koji nasumično padaju ([F-47](<url>))
- Posle toga notifikacije ([F-39](<url>))
- Na staging ide javna stranica deljenog linka, naziv exporta sa vremenom retake-a i ispravke iz QA ([F-38](<url>), [F-36.3](<url>), [F-31.5](<url>), [#4124](<url>))
- Ostatak frontend bugova iz QA ([#4124](<url>))
```
