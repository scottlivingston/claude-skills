#!/usr/bin/env bash
# List the standards files governing a set of paths, per SKILL.md: every
# CONVENTIONS.md on each path's ancestor chain, root included. Paths are files
# or directories, repo-relative or absolute, as arguments or one per line on
# stdin with `-`; none means the repo root. One line per governing file:
#   <file> TAB <directory it binds> TAB <how many of the paths it governs>
# then `uncovered TAB <path>` for each path none of them governs. With no
# CONVENTIONS.md on any path, prints the fallback files found instead —
#   fallback TAB <file>
# — or `none` when there are none of those either.
set -euo pipefail

root=$(git rev-parse --show-toplevel)
cd "$root"

if [ "${1:-}" = "-" ]; then paths=$(cat); else paths=$(printf '%s\n' "$@"); fi
[ -n "$paths" ] || paths=.

out=$(printf '%s\n' "$paths" | while read -r p; do
  [ -n "$p" ] || continue
  p=${p#"$root"/}; p=${p#./}
  # a file's own directory starts the walk; a directory starts it itself
  if [ -d "$p" ]; then d=$p; else d=$(dirname "$p"); fi
  hit=0
  while :; do
    [ -f "$d/CONVENTIONS.md" ] && { printf 'G\t%s\n' "${d#./}/CONVENTIONS.md"; hit=1; }
    [ "$d" = . ] && break
    d=$(dirname "$d")
  done
  [ "$hit" = 1 ] || printf 'U\t%s\n' "$p"
done)

if printf '%s\n' "$out" | grep -q '^G'; then
  printf '%s\n' "$out" | awk -F'\t' '$1 == "G" { sub(/^\.\//, "", $2); n[$2]++ } END { for (f in n) print f "\t" n[f] }' | sort | while IFS=$'\t' read -r f n; do
    scope=$(dirname "$f"); [ "$scope" = . ] && scope="(repo root)"
    printf '%s\t%s\t%s\n' "$f" "$scope" "$n"
  done
  printf '%s\n' "$out" | awk -F'\t' '$1 == "U" { print "uncovered\t" $2 }'
  exit 0
fi

found=0
for f in CODING_STANDARDS.md CONTRIBUTING.md STYLEGUIDE.md; do
  [ -f "$f" ] && { printf 'fallback\t%s\n' "$f"; found=1; }
done
if [ -d docs ]; then
  while read -r f; do printf 'fallback\t%s\n' "$f"; found=1; done < <(
    find docs -maxdepth 2 -type f \( -iname 'coding_standards*.md' -o -iname 'contributing*.md' -o -iname 'styleguide*.md' -o -iname 'style-guide*.md' -o -iname 'conventions*.md' \) | sort
  )
fi
[ "$found" = 1 ] || echo none
