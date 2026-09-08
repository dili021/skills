#!/usr/bin/env bash
# Scaffold a new skill: ./scripts/new-skill.sh <name> [category]   (default category: personal)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="${1:?usage: new-skill.sh <name> [category]}"
CATEGORY="${2:-personal}"
DIR="$ROOT/skills/$CATEGORY/$NAME"

if ! [[ "$NAME" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "Skill names are lowercase kebab-case: $NAME" >&2
  exit 1
fi
[ -e "$DIR" ] && { echo "Already exists: skills/$CATEGORY/$NAME" >&2; exit 1; }

mkdir -p "$DIR"
cat > "$DIR/SKILL.md" <<MD
---
name: $NAME
description: One line saying what this does and when to use it — this is all the model sees when deciding whether to load the skill, so name the trigger situation, not just the topic.
---

# ${NAME//-/ }

What this skill is for, in a sentence.

## Process

1. …
MD
node "$ROOT/scripts/sync-manifest.mjs"
echo "Created skills/$CATEGORY/$NAME/SKILL.md"
