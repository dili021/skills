# skills

My agent skills, in one repo, installable anywhere as a Claude Code plugin.

Version 1 is one flow: a problem becomes a contract, an agent runs the contract to a merge-ready
pull request, and I give the verdict. The skills are mine. Most are derived from
[mattpocock/skills](https://github.com/mattpocock/skills), some from
[poteto/pstack](https://github.com/cursor/plugins/tree/main/pstack),
[addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) and
[jasonku09/grill-with-ui](https://github.com/jasonku09/grill-with-ui), all MIT. Their text sits
untouched under `sources/`, so an upstream update never overwrites a skill of mine.

## Install (per machine)

```bash
claude plugin marketplace add dili021/skills
claude plugin install dili-skills@dili
```

Or from inside Claude Code: `/plugin marketplace add dili021/skills`, then `/plugin`.

Update everywhere with `/plugin update`. It pulls this repo, so a push here is the only
distribution step.

For agents that read `~/.agents/skills` instead (Codex, Cursor), clone this repo and run:

```bash
./scripts/link-agents.sh --prune
```

These are symlinks, so a `git pull` updates them in place. `--prune` clears
`~/.claude/skills` entries for skills the plugin already provides, so nothing loads twice.

## Where to start

- [`FIRST-STEPS.md`](FIRST-STEPS.md) walks one repo from install to the first unattended run.
- `/setup-dili-skills` configures a repo: issue tracker, glossary, the bar, the verify skill.
- `/ask-dili` answers which skill fits a situation.

## Layout

```
.claude-plugin/
  marketplace.json   this repo as a marketplace (one plugin: dili-skills)
  plugin.json        the plugin. Its "skills" array is generated, never hand-edited
skills/              mine. The only skills the plugin loads
  engineering/       the flow: setup, contract, run, proof, handoff, lessons
  productivity/      interviews, handoff, teaching, writing for agents
  writing/           unslop
  personal/          whiteboard-defense
sources/             upstream text, untouched, never loaded
  mattpocock/  pstack/  addyosmani/  jasonku09/
hooks/
  hooks.json         SessionStart hook
  unslop-rule.sh     the always-on writing rule it prints
scripts/
  new-skill.sh       scaffold a skill and update the manifest
  sync-manifest.mjs  regenerate plugin.json from what's on disk
  sources.mjs        see upstream changes and merge them into my skills
  release.sh         bump the version, commit, push
SOURCES.json         the upstream repos, the commit each is pinned at, and which source
                     each of my skills derives from
```

Skill names must be unique across categories, because Claude Code addresses a skill by name.
`sync-manifest.mjs` fails loudly on a collision.

## Add a skill

```bash
./scripts/new-skill.sh my-skill        # -> skills/personal/my-skill/SKILL.md
./scripts/release.sh minor             # bump the version, commit, push
```

Then `/plugin update` wherever you use it.

**Bump the version on every change you want distributed.** Claude Code caches an installed
plugin under its version number, so `plugin update` on an unchanged version reports
"already at the latest version" and keeps serving the old snapshot. `release.sh` exists so
this cannot be forgotten.

## Change a skill

Edit it in place and commit. Every skill under `skills/` is mine, whatever it started as.

## Track upstream

```bash
node scripts/sources.mjs               # what moved upstream since each pin
node scripts/sources.mjs diff tdd      # upstream's change to the source of one skill
node scripts/sources.mjs pull          # merge the changes in, refresh sources/, move the pins
```

`SOURCES.json` records, per skill, the upstream path it derives from. A skill with no entry
is mine alone and the tooling leaves it alone.

`pull` runs a three-way merge for every derived file: the pinned upstream text is the base,
upstream's head is theirs, my skill is ours. A line only upstream touched arrives on its own.
A line both sides touched gets conflict markers, and `pull` lists the file. It then rewrites
`sources/` at the new commit and moves the pin. Nothing is committed, so `git diff` shows the
whole update and `git checkout .` undoes it. `pull` refuses to run while `skills/` or
`sources/` has uncommitted changes.

Two skills are marked `watch` instead of `port`: `ask-dili` and `constraints`. They are
rewrites, where a line-by-line merge would only produce noise. `pull` reports that their source
changed and I port by hand.

`status` also lists skills that are new upstream. To take one, copy it from `sources/` into
`skills/`, add its entry to `SOURCES.json` and run `sync-manifest.mjs`.

## The writing rule

`unslop` strips AI tells from writing. It has to apply to everything an agent writes for a
person, so a skill file alone is not enough: nothing makes a model load one before it
starts typing. `hooks/hooks.json` registers a `SessionStart` hook that prints the rule and
the path to the skill, and Claude Code feeds that hook's stdout into the session as
context. One injection per session, not per prompt.

My copy drops upstream's `disable-model-invocation: true`, which would have limited it to an
explicit `/unslop` call.

To change what every agent is told, edit `hooks/unslop-rule.sh`. To change the rules
themselves, edit `skills/writing/unslop/SKILL.md`.

## Attribution

Most skills derive from Matt Pocock's, MIT © Matt Pocock, see `LICENSE.mattpocock`.
`unslop`, `create-verification-skill`, `maintain-verification-skill` and `show-me-your-work`
derive from pstack, MIT © Lauren Tan (poteto), see `LICENSE.pstack`. `grill-with-ui` derives
from Jason Ku's, MIT © Jason Ku, see `LICENSE.jasonku09`; it needs Node 20+ at run time.
`constraints` follows Addy Osmani's `constraint-driven-development` and carries his floor
guard script with one added rule, MIT © Addy Osmani, see `LICENSE.addyosmani`. `pr` credits
Dex Horthy's `show-me` in its own `CREDITS.md`. My changes and my own skills (`afk`,
`verdict`, `lanes`, `ask-dili`, `whiteboard-defense`) are MIT © Stefan Dili. `find-skills`
(vercel-labs) is not carried here, it stays installed through the `skills` CLI.
