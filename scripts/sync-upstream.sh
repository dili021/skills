#!/usr/bin/env bash
# Track an upstream skills repo without giving up ownership of your forks.
#
#   ./scripts/sync-upstream.sh                 # what changed upstream since the pin?
#   ./scripts/sync-upstream.sh diff <skill>    # full diff for one skill
#   ./scripts/sync-upstream.sh adopt <skill>   # overwrite your copy with upstream's
#   ./scripts/sync-upstream.sh pin             # mark upstream HEAD as reviewed
#
# Adopt overwrites, so review the diff first and commit your own work before adopting.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE="$ROOT/.cache/upstream"
URL=$(node -p "require('$ROOT/UPSTREAM.json').upstreams[0].url")
BRANCH=$(node -p "require('$ROOT/UPSTREAM.json').upstreams[0].branch")
PINNED=$(node -p "require('$ROOT/UPSTREAM.json').upstreams[0].pinned")

if [ ! -d "$CACHE/.git" ]; then
  mkdir -p "$(dirname "$CACHE")"
  git clone --quiet "$URL" "$CACHE"
fi
git -C "$CACHE" fetch --quiet origin "$BRANCH"
HEAD_SHA=$(git -C "$CACHE" rev-parse "origin/$BRANCH")

# Where does a skill live upstream? Ours are flat by name; upstream nests by category.
upstream_path() {
  git -C "$CACHE" ls-tree -d --name-only "origin/$BRANCH" \
    skills/engineering/"$1" skills/productivity/"$1" skills/misc/"$1" skills/in-progress/"$1" 2>/dev/null | head -1
}
local_path() {
  find "$ROOT/skills" -mindepth 2 -maxdepth 2 -type d -name "$1" | head -1
}

case "${1:-status}" in
  status)
    if [ "$PINNED" = "$HEAD_SHA" ]; then
      echo "Up to date with $URL@$BRANCH ($HEAD_SHA)."
      exit 0
    fi
    echo "Upstream moved: ${PINNED:0:8} -> ${HEAD_SHA:0:8}"
    echo
    changed=0
    for dir in "$ROOT"/skills/*/*/; do
      skill=$(basename "$dir")
      up=$(upstream_path "$skill") || true
      [ -z "$up" ] && continue
      stat=$(git -C "$CACHE" diff --shortstat "$PINNED" "$HEAD_SHA" -- "$up")
      [ -z "$stat" ] && continue
      printf '  %-32s %s\n' "$skill" "$stat"
      changed=$((changed + 1))
    done
    [ "$changed" -eq 0 ] && echo "  (no changes to skills you carry)"
    echo
    echo "Next: sync-upstream.sh diff <skill> | adopt <skill> | pin"
    ;;
  diff)
    skill="${2:?usage: sync-upstream.sh diff <skill>}"
    up=$(upstream_path "$skill")
    [ -z "$up" ] && { echo "Not in upstream: $skill (yours alone — nothing to sync)"; exit 0; }
    git -C "$CACHE" diff "$PINNED" "$HEAD_SHA" -- "$up"
    ;;
  adopt)
    skill="${2:?usage: sync-upstream.sh adopt <skill>}"
    up=$(upstream_path "$skill")
    mine=$(local_path "$skill")
    [ -z "$up" ] && { echo "Not in upstream: $skill"; exit 1; }
    [ -z "$mine" ] && { echo "Not in your repo: $skill"; exit 1; }
    git -C "$CACHE" checkout --quiet "$HEAD_SHA"
    rm -rf "$mine"
    cp -r "$CACHE/$up" "$mine"
    echo "Adopted upstream $skill into ${mine#$ROOT/} — review with: git diff -- ${mine#$ROOT/}"
    ;;
  pin)
    node -e "
      const fs = require('fs');
      const p = '$ROOT/UPSTREAM.json';
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      j.upstreams[0].pinned = '$HEAD_SHA';
      j.upstreams[0].pinnedDate = new Date().toISOString();
      fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
    "
    echo "Pinned upstream at ${HEAD_SHA:0:8}."
    ;;
  *)
    echo "usage: sync-upstream.sh [status|diff <skill>|adopt <skill>|pin]" >&2
    exit 1
    ;;
esac
