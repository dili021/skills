# skills

My agent skills, in one repo, installable anywhere as a Claude Code plugin.

A maintained fork of [mattpocock/skills](https://github.com/mattpocock/skills) (MIT),
plus my own. Forking rather than installing means I can edit any skill; the tradeoff is
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
  engineering/       forked from upstream
  productivity/      forked from upstream
  personal/          mine
scripts/
  new-skill.sh       scaffold a skill and update the manifest
  sync-manifest.mjs  regenerate plugin.json from what's on disk
  sync-upstream.sh   see, review and adopt upstream changes
UPSTREAM.json        upstream remote + the commit I last reviewed
```

Skill names must be unique across categories — Claude Code addresses a skill by name, not
by path. `sync-manifest.mjs` fails loudly on a collision.

## Add a skill

```bash
./scripts/new-skill.sh my-skill        # -> skills/personal/my-skill/SKILL.md
git add -A && git commit -m "Add my-skill" && git push
```

Then `/plugin update` wherever you use it.

## Change a forked skill

Edit it in place and commit. The fork is the point — no upstream permission needed. The
only cost is the next upstream diff, which you resolve by hand.

## Track upstream

```bash
./scripts/sync-upstream.sh              # which of my skills moved upstream since the pin
./scripts/sync-upstream.sh diff tdd     # read the change
./scripts/sync-upstream.sh adopt tdd    # take upstream's version (overwrites mine)
./scripts/sync-upstream.sh pin          # mark upstream HEAD reviewed
```

`adopt` overwrites, so commit your own work first and review with `git diff` after. For a
skill you've customised, don't adopt — read the diff and port the parts you want.

Run `pin` once you've been through the list, whether or not you adopted anything: the pin
means "reviewed up to here", so the next run shows only what's new.

## Attribution

Upstream skills are MIT © Matt Pocock — see `LICENSE.mattpocock`. My changes and my own
skills are MIT © Stefan Dili. `find-skills` (vercel-labs) is not vendored here; it stays
installed through the `skills` CLI.
