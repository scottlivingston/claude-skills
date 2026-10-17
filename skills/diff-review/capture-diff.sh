#!/usr/bin/env bash
# Pin a review's fixed point and capture what step 1 needs, per SKILL.md:
#   capture-diff.sh <fixed point> [--exclude <path>]...
# Fails before anything is captured when the fixed point doesn't resolve
# (exit 1) or the three-dot diff against it is empty (exit 3). Otherwise prints
# sections, each headed `## <NAME>`:
#   BRANCH  — HEAD's branch and whether it is the default branch (yes/no/unknown)
#   DIFF_CMD — the exact diff command, fixed point pinned to its sha
#   TOTALS  — files, insertions, deletions
#   STAT    — the diff's stat
#   LOG     — every commit since the fixed point, full messages
# Excluded paths are left out of the diff command and the stat alike.
set -euo pipefail

[ $# -ge 1 ] || { echo "usage: capture-diff.sh <fixed point> [--exclude <path>]..." >&2; exit 1; }
ref=$1; shift
excludes=()
while [ $# -gt 0 ]; do
  case $1 in
    --exclude) [ $# -ge 2 ] || { echo "capture-diff: --exclude needs a path" >&2; exit 1; }; excludes+=("$2"); shift 2 ;;
    *) echo "capture-diff: unknown argument $1" >&2; exit 1 ;;
  esac
done

sha=$(git rev-parse --verify --quiet "$ref^{commit}") || { echo "capture-diff: $ref doesn't resolve to a commit" >&2; exit 1; }
git merge-base "$sha" HEAD >/dev/null || { echo "capture-diff: $ref shares no history with HEAD" >&2; exit 1; }

pathspec=()
cmd="git diff $sha...HEAD"
if [ ${#excludes[@]} -gt 0 ]; then
  pathspec=(-- .)
  cmd="$cmd -- ."
  for e in "${excludes[@]}"; do
    pathspec+=(":(exclude)$e")
    cmd="$cmd ':(exclude)$e'"
  done
fi

if git diff --quiet "$sha...HEAD" ${pathspec[@]+"${pathspec[@]}"}; then
  echo "capture-diff: nothing changed since $ref, excluded paths aside" >&2
  exit 3
fi

branch=$(git symbolic-ref --quiet --short HEAD || echo "(detached)")
default=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||' || true)
if [ -z "$default" ]; then is_default=unknown
elif [ "$branch" = "$default" ]; then is_default=yes
else is_default=no; fi

echo "## BRANCH"
echo "branch=$branch default=$is_default"
echo
echo "## DIFF_CMD"
echo "$cmd"
echo
echo "## TOTALS"
git diff --shortstat "$sha...HEAD" ${pathspec[@]+"${pathspec[@]}"} | sed 's/^ *//'
echo
echo "## STAT"
git diff --stat "$sha...HEAD" ${pathspec[@]+"${pathspec[@]}"}
echo
echo "## LOG"
git log "$sha..HEAD"
