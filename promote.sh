#!/usr/bin/env bash
# promote.sh — merge dev into main WITHOUT letting sandbox widget names leak into prod.
#
# Usage:  ./promote.sh ["commit message"]
#
# What it does:
#   1. Checks you're on a clean main.
#   2. git merge --no-ff --no-commit dev
#   3. For every widget config.json that already exists on main, restores main's
#      copy (keeps the prod customElementName).
#   4. For widgets NEW to main, strips the "dev-" prefix from customElementName.
#   5. Refuses to commit if any config.json still contains a "dev-" name.
#   6. Commits the merge. You then push and upload main's files to Cvent PROD.
set -euo pipefail

WIDGETS="Cvent Code Files/Cvent Widgets"
MSG="${1:-Promote dev to prod}"

die() { echo "ERROR: $*" >&2; exit 1; }

cd "$(git rev-parse --show-toplevel)"

[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || die "switch to main first:  git checkout main"
git diff --quiet && git diff --cached --quiet || die "working tree has uncommitted changes. Commit or stash them first (git stash), then re-run."
git rev-parse --verify --quiet dev >/dev/null || die "no local dev branch found."
[ -z "$(git rev-list main..dev)" ] && { echo "main already contains everything on dev. Nothing to promote."; exit 0; }

echo "Merging dev into main (no commit yet)..."
if ! git merge --no-ff --no-commit dev; then
  git merge --abort 2>/dev/null || true
  die "merge conflict. Resolve by hand: git merge --no-ff --no-commit dev, fix files, then follow the README promote steps."
fi

# 3. Restore prod config for widgets that already exist on main.
while IFS= read -r cfg; do
  [ -n "$cfg" ] || continue
  git checkout HEAD -- "$cfg"
  echo "kept prod config: $cfg"
done < <(git ls-tree -r --name-only HEAD -- "$WIDGETS" | grep '/config\.json$' || true)

# 4. New widgets (not on main yet): drop the dev- prefix.
while IFS= read -r cfg; do
  [ -n "$cfg" ] || continue
  if git cat-file -e "HEAD:$cfg" 2>/dev/null; then continue; fi
  if grep -q '"customElementName": *"dev-' "$cfg"; then
    sed -i '' -E 's/("customElementName": *")dev-/\1/' "$cfg"
    git add "$cfg"
    echo "new widget, renamed to prod: $cfg -> $(grep -o '"customElementName": *"[^"]*"' "$cfg")"
  fi
done < <(git diff --cached --name-only --diff-filter=A -- "$WIDGETS" | grep '/config\.json$' || true)

# 5. Hard stop if any sandbox name survived.
if git grep --cached -l '"customElementName": *"dev-' -- "$WIDGETS" >/dev/null 2>&1; then
  git grep --cached -n '"customElementName": *"dev-' -- "$WIDGETS" >&2
  git merge --abort
  die "a dev- customElementName would have landed on main. Merge aborted; nothing changed."
fi

git commit -q -m "$MSG"
echo
echo "Promoted. Merge commit: $(git rev-parse --short HEAD)"
echo
echo "Remaining differences between main and dev (should be config.json names only):"
git diff main dev --stat -- "$WIDGETS" || true
echo
echo "Next:  git push origin main   then upload main's widget files to Cvent PROD (widget + component files, verify via Sources)."
