#!/usr/bin/env bash
# Track the upstream repos in UPSTREAM.json without giving up ownership of your forks.
#
#   ./scripts/sync-upstream.sh                 # what changed upstream since each pin?
#   ./scripts/sync-upstream.sh diff <skill>    # full diff for one skill
#   ./scripts/sync-upstream.sh adopt <skill>   # overwrite your copy with upstream's
#   ./scripts/sync-upstream.sh pin [<name>]    # mark an upstream's HEAD as reviewed
#
# Adopt overwrites, so review the diff first and commit your own work before adopting.
# A skill you have customised is better handled by reading the diff and porting by hand.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_ROOT="$ROOT/.cache/upstream"
COUNT=$(node -p "require('$ROOT/UPSTREAM.json').upstreams.length")

field() { node -p "require('$ROOT/UPSTREAM.json').upstreams[$1].$2"; }
roots() { node -p "require('$ROOT/UPSTREAM.json').upstreams[$1].skillRoots.join(' ')"; }

# Clone or refresh one upstream's cache, then echo its checkout path and current HEAD.
prepare() {
  local i="$1" name url branch cache
  name=$(field "$i" name); url=$(field "$i" url); branch=$(field "$i" branch)
  cache="$CACHE_ROOT/$name"
  if [ ! -d "$cache/.git" ]; then
    mkdir -p "$CACHE_ROOT"
    git clone --quiet "$url" "$cache"
  fi
  git -C "$cache" fetch --quiet origin "$branch"
  echo "$cache $(git -C "$cache" rev-parse "origin/$branch")"
}

# Provenance is recorded per skill in UPSTREAM.json, never guessed from the name: two
# upstreams can ship different skills under one name (pstack and mattpocock both have a
# tdd and a teach), and guessing would diff, or adopt, the wrong one.
# Echoes "<upstream index> <path in that upstream>", or nothing for a skill of your own.
locate() {
  node -e "
    const j = require('$ROOT/UPSTREAM.json');
    const p = j.provenance && j.provenance['$1'];
    if (!p) process.exit(0);
    const i = j.upstreams.findIndex((u) => u.name === p.upstream);
    if (i < 0) { console.error('Unknown upstream: ' + p.upstream); process.exit(1); }
    console.log(i + ' ' + p.path);
  "
}

# The skills this upstream carries, as "<name> <path>" lines.
skills_from() {
  node -e "
    const j = require('$ROOT/UPSTREAM.json');
    const name = j.upstreams[$1].name;
    for (const [skill, p] of Object.entries(j.provenance || {})) {
      if (p.upstream === name) console.log(skill + ' ' + p.path);
    }
  "
}

local_path() { find "$ROOT/skills" -mindepth 2 -maxdepth 2 -type d -name "$1" | head -1; }

case "${1:-status}" in
  status)
    for ((i = 0; i < COUNT; i++)); do
      name=$(field "$i" name); pinned=$(field "$i" pinned)
      read -r cache head <<<"$(prepare "$i")"
      echo "── $name"
      if [ "$pinned" = "$head" ]; then
        echo "   up to date at ${head:0:8}"
        echo
        continue
      fi
      echo "   moved ${pinned:0:8} -> ${head:0:8}"
      changed=0
      while read -r skill up; do
        [ -z "$skill" ] && continue
        stat=$(git -C "$cache" diff --shortstat "$pinned" "$head" -- "$up" 2>/dev/null || true)
        [ -z "$stat" ] && continue
        printf '   %-32s %s\n' "$skill" "$stat"
        changed=$((changed + 1))
      done < <(skills_from "$i")
      [ "$changed" -eq 0 ] && echo "   no changes to skills you carry"
      echo
    done
    echo "Next: sync-upstream.sh diff <skill> | adopt <skill> | pin [<upstream>]"
    ;;
  diff)
    skill="${2:?usage: sync-upstream.sh diff <skill>}"
    read -r i up <<<"$(locate "$skill")"
    [ -n "${i:-}" ] && prepare "$i" >/dev/null
    [ -z "${i:-}" ] && { echo "No upstream recorded for $skill (yours alone, nothing to sync)"; exit 0; }
    git -C "$CACHE_ROOT/$(field "$i" name)" diff "$(field "$i" pinned)" \
      "$(git -C "$CACHE_ROOT/$(field "$i" name)" rev-parse "origin/$(field "$i" branch)")" -- "$up"
    ;;
  adopt)
    skill="${2:?usage: sync-upstream.sh adopt <skill>}"
    read -r i up <<<"$(locate "$skill")"
    [ -n "${i:-}" ] && prepare "$i" >/dev/null
    mine=$(local_path "$skill")
    [ -z "${i:-}" ] && { echo "No upstream recorded for $skill" >&2; exit 1; }
    [ -z "$mine" ] && { echo "Not in your repo: $skill" >&2; exit 1; }
    cache="$CACHE_ROOT/$(field "$i" name)"
    git -C "$cache" checkout --quiet "origin/$(field "$i" branch)"
    rm -rf "$mine"
    cp -r "$cache/$up" "$mine"
    echo "Adopted $(field "$i" name)/$skill into ${mine#"$ROOT"/}"
    echo "Review with: git diff -- ${mine#"$ROOT"/}   (local edits, if any, are gone)"
    ;;
  pin)
    want="${2:-}"
    for ((i = 0; i < COUNT; i++)); do
      name=$(field "$i" name)
      [ -n "$want" ] && [ "$want" != "$name" ] && continue
      read -r _ head <<<"$(prepare "$i")"
      node -e "
        const fs = require('fs');
        const p = '$ROOT/UPSTREAM.json';
        const j = JSON.parse(fs.readFileSync(p, 'utf8'));
        j.upstreams[$i].pinned = '$head';
        j.upstreams[$i].pinnedDate = new Date().toISOString();
        fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
      "
      echo "Pinned $name at ${head:0:8}."
    done
    ;;
  *)
    echo "usage: sync-upstream.sh [status|diff <skill>|adopt <skill>|pin [<upstream>]]" >&2
    exit 1
    ;;
esac
