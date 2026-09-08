#!/usr/bin/env bash
# Bump the plugin version, commit everything, push.
#
#   ./scripts/release.sh [patch|minor|major] [-m "commit message"]
#
# The bump is not cosmetic. Claude Code caches an installed plugin under its version
# number, so a push without one leaves every machine on the old snapshot.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
LEVEL="${1:-patch}"
MSG=""
[ "${2:-}" = "-m" ] && MSG="${3:?-m needs a message}"

node "$ROOT/scripts/sync-manifest.mjs"
NEW=$(node -e "
  const fs = require('fs');
  const p = '$ROOT/.claude-plugin/plugin.json';
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const [major, minor, patch] = j.version.split('.').map(Number);
  const next = { major: [major + 1, 0, 0], minor: [major, minor + 1, 0], patch: [major, minor, patch + 1] }['$LEVEL'];
  if (!next) { console.error('level must be patch, minor or major'); process.exit(1); }
  j.version = next.join('.');
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log(j.version);
")

git add -A
git commit -q -m "${MSG:-Release $NEW}"
git push -q origin HEAD
echo "Released $NEW. Run /plugin update where you use it."
