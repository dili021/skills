#!/usr/bin/env bash
# Expose this repo's skills to agents that read ~/.agents/skills (Codex, Cursor, …).
#
# Claude Code gets them through the plugin instead — see README. So this script also
# clears stale ~/.claude/skills symlinks for skills the plugin now provides, otherwise
# the same skill loads twice under one name.
#
#   ./scripts/link-agents.sh            # link, and report what it would unlink
#   ./scripts/link-agents.sh --prune    # also remove the stale ~/.claude/skills links
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTS="${AGENTS_DIR:-$HOME/.agents/skills}"
CLAUDE="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
PRUNE=false
[ "${1:-}" = "--prune" ] && PRUNE=true

mkdir -p "$AGENTS"
linked=0
for dir in "$ROOT"/skills/*/*/; do
  [ -f "$dir/SKILL.md" ] || continue
  skill=$(basename "$dir")
  target="$AGENTS/$skill"
  # Only ever replace a symlink or a copy we are superseding; never a foreign real directory
  # that isn't ours to move.
  if [ -e "$target" ] && [ ! -L "$target" ] && [ ! -f "$target/.from-dili-skills" ]; then
    mv "$target" "$target.bak.$(date +%Y%m%d%H%M%S)"
    echo "  backed up pre-existing $skill"
  fi
  rm -rf "$target"
  ln -s "${dir%/}" "$target"
  linked=$((linked + 1))
done
echo "Linked $linked skills into $AGENTS"

stale=()
for dir in "$ROOT"/skills/*/*/; do
  skill=$(basename "$dir")
  [ -e "$CLAUDE/$skill" ] && stale+=("$skill")
done
if [ ${#stale[@]} -gt 0 ]; then
  if $PRUNE; then
    for skill in "${stale[@]}"; do rm -rf "${CLAUDE:?}/$skill"; done
    echo "Pruned ${#stale[@]} entries from $CLAUDE (the plugin provides them now)"
  else
    echo
    echo "${#stale[@]} entries in $CLAUDE duplicate plugin skills: ${stale[*]}"
    echo "Re-run with --prune to remove them."
  fi
fi
