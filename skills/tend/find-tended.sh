#!/usr/bin/env bash
# List the defined docs /tend sweeps, with the skill that owns each one and the lines to tend.
#
#   find-tended.sh [paths...]          every defined doc under the paths (none: the whole repo),
#                                      each tended whole
#   find-tended.sh --since <ref>       the defined docs a change since <ref> bears on: each doc
#                                      the change edited, and each doc whose text names a path
#                                      the change added, modified, deleted, or renamed (old or
#                                      new name). Uncommitted work counts as part of the change.
#                                      Each is tended on its focus lines only.
#
# Docs are tracked or untracked-but-not-ignored. One line per doc:
#   <doc> TAB <owning skill> TAB <absolute path of that skill's TENDING.md> TAB <why> TAB <focus>
# where <why> is `listed`, `edited`, or `names <path>`, and <focus> is `whole` or the doc's line
# numbers and ranges the change bears on (`12-18,40`): the lines it edited plus the lines naming
# a path it touched. A doc the change added is `whole`. Prints `none` when no doc qualifies.
set -euo pipefail

skills=$(cd "$(dirname "$0")/.." && pwd)
root=$(git rev-parse --show-toplevel)
cd "$root"

owner() {
  case "$1" in
    CONVENTIONS.md | */CONVENTIONS.md) echo conventions ;;
    TESTING.md | */TESTING.md) echo testing ;;
    PRINCIPLES.md | */PRINCIPLES.md) echo principles ;;
    CONTEXT.md | */CONTEXT.md | CONTEXT-MAP.md) echo domain-modeling ;;
    docs/adr/[0-9]*.md | */docs/adr/[0-9]*.md) echo domain-modeling ;;
  esac
}

emit() { printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$skills/$2/TENDING.md" "$3" "$4"; found=1; }
found=0

# the doc's line ranges the change left behind, from its diff against $ref; a pure deletion
# marks the line it left off at
edited_lines() {
  git diff -U0 "$ref" -- "$1" | awk '/^@@/ {
    split($3, a, ","); s = substr(a[1], 2) + 0; n = (a[2] == "" ? 1 : a[2] + 0)
    if (n == 0) { n = 1; if (s == 0) s = 1 }
    print (n == 1 ? s : s "-" (s + n - 1)) }'
}

if [ "${1:-}" = "--since" ]; then
  ref=${2:?--since needs a ref}
  git rev-parse --verify --quiet "$ref^{commit}" >/dev/null || { echo "bad ref: $ref" >&2; exit 2; }
  # every path the change touched, both sides of a rename, plus untracked new files
  changed=$( { git diff --name-status -M "$ref" | cut -f2- | tr '\t' '\n'; git ls-files -o --exclude-standard; } | sort -u)
  # match a path by its full form or its last two components, so app-relative mentions
  # (`agent/cycle/assistant.rs`) still hit; a one-component name (`CONVENTIONS.md`,
  # `Cargo.toml`) is too common to match on, root files included
  patterns=$(printf '%s\n' "$changed" | awk -F/ 'NF >= 2 { print; print $(NF-1) "/" $NF }' | sort -u)
  while IFS= read -r f; do
    o=$(owner "$f"); [ -n "$o" ] || continue
    why= lines=
    if printf '%s\n' "$changed" | grep -qxF "$f"; then
      why=edited
      # new since $ref (untracked, or absent at $ref): the change wrote all of it
      if ! git cat-file -e "$ref:$f" 2>/dev/null; then emit "$f" "$o" edited whole; continue; fi
      lines=$(edited_lines "$f")
    fi
    named=$(grep -nF -f <(printf '%s\n' "$patterns") "$f" 2>/dev/null || true)
    if [ -n "$named" ]; then
      [ -n "$why" ] || why="names $(printf '%s\n' "$named" | head -1 | grep -oF -f <(printf '%s\n' "$patterns") | head -1)"
      lines=$(printf '%s\n%s\n' "$lines" "$(printf '%s\n' "$named" | cut -d: -f1)")
    fi
    [ -n "$why" ] || continue
    focus=$(printf '%s\n' "$lines" | grep . | sort -t- -k1,1n -k2,2n | uniq | paste -sd, -)
    emit "$f" "$o" "$why" "${focus:-whole}"
  done < <(git ls-files -co --exclude-standard | sort -u)
else
  args=()
  for p in "$@"; do p=${p#"$root"/}; p=${p#./}; args+=("$p"); done
  while IFS= read -r f; do
    o=$(owner "$f"); [ -n "$o" ] || continue
    emit "$f" "$o" listed whole
  done < <(git ls-files -co --exclude-standard -- ${args[@]+"${args[@]}"} | sort -u)
fi

[ "$found" = 1 ] || echo none
