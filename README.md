# skills

My agent skills, in one repo, installable anywhere as a Claude Code plugin.

A maintained fork of [mattpocock/skills](https://github.com/mattpocock/skills), of the
`unslop` skill from [poteto/pstack](https://github.com/cursor/plugins/tree/main/pstack) and of
[jasonku09/grill-with-ui](https://github.com/jasonku09/grill-with-ui), all MIT, plus my own. Forking rather than installing means I can edit any skill; the tradeoff is
that upstream changes have to be adopted deliberately, which `scripts/sync-upstream.sh`
exists to make cheap.

## Install (per machine)

```bash
claude plugin marketplace add dili021/skills
claude plugin install dili-skills@dili
```

Or from inside Claude Code: `/plugin marketplace add dili021/skills`, then `/plugin`.

Update everywhere with `/plugin update` — it pulls this repo, so a push here is the only
distribution step.

For agents that read `~/.agents/skills` instead (Codex, Cursor), clone this repo and run:

```bash
./scripts/link-agents.sh --prune
```

Symlinks, not copies — a `git pull` updates them in place. `--prune` clears
`~/.claude/skills` entries for skills the plugin already provides, so nothing loads twice.

## Layout

```
.claude-plugin/
  marketplace.json   this repo as a marketplace (one plugin: dili-skills)
  plugin.json        the plugin — its "skills" array is generated, never hand-edited
skills/
  engineering/       forked from mattpocock; grill-with-ui from jasonku09 (runtime files only,
                     its design/, docs/ and page e2e test are not vendored)
  productivity/      forked from mattpocock
  writing/           unslop, forked from pstack
  personal/          mine
hooks/
  hooks.json         SessionStart hook
  unslop-rule.sh     the always-on writing rule it prints
scripts/
  new-skill.sh       scaffold a skill and update the manifest
  sync-manifest.mjs  regenerate plugin.json from what's on disk
  sync-upstream.sh   see, review and adopt upstream changes
UPSTREAM.json        upstream remotes, the commit I last reviewed for each, and which
                     upstream every vendored skill came from
```

Skill names must be unique across categories — Claude Code addresses a skill by name, not
by path. `sync-manifest.mjs` fails loudly on a collision.

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

## Change a forked skill

Edit it in place and commit. The fork is the point — no upstream permission needed. The
only cost is the next upstream diff, which you resolve by hand.

## The writing rule

`unslop` strips AI tells from writing. It has to apply to everything an agent writes for a
person, so a skill file alone is not enough: nothing makes a model load one before it
starts typing. `hooks/hooks.json` registers a `SessionStart` hook that prints the rule and
the path to the skill, and Claude Code feeds that hook's stdout into the session as
context. One injection per session, not per prompt.

The vendored copy drops upstream's `disable-model-invocation: true`, which would have
limited it to an explicit `/unslop` call.

To change what every agent is told, edit `hooks/unslop-rule.sh`. To change the rules
themselves, edit `skills/writing/unslop/SKILL.md`.

## Track upstream

```bash
./scripts/sync-upstream.sh                # which of my skills moved since each pin
./scripts/sync-upstream.sh diff tdd       # read the change
./scripts/sync-upstream.sh adopt tdd      # take upstream's version (overwrites mine)
./scripts/sync-upstream.sh pin mattpocock # mark that upstream's HEAD reviewed
```

Every vendored skill records which upstream it came from, in `UPSTREAM.json`'s
`provenance` map. Name matching would not do: pstack and mattpocock both ship a `tdd` and
a `teach`, so a lookup by name can diff, or adopt, the wrong skill. Record the provenance
when you vendor a skill, or the tooling treats it as yours and leaves it alone.

`adopt` overwrites, so commit your own work first and review with `git diff` after. For a
skill you've customised, don't adopt — read the diff and port the parts you want.

Run `pin` once you've been through the list, whether or not you adopted anything: the pin
means "reviewed up to here", so the next run shows only what's new.

## Attribution

Most vendored skills are MIT © Matt Pocock, see `LICENSE.mattpocock`. `unslop` is MIT ©
Lauren Tan (poteto), see `LICENSE.pstack`. `grill-with-ui` is MIT © Jason Ku, see
`LICENSE.jasonku09`; it needs Node 20+ at run time. My changes and my own skills are MIT © Stefan
Dili. `find-skills` (vercel-labs) is not vendored here, it stays installed through the
`skills` CLI.
