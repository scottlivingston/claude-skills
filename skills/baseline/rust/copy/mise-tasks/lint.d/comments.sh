#!/usr/bin/env bash
# mise-tasks/lint.d/comments.sh — `mise run lint:comments`.
#
# Comment caps, the ID ban and the banner ban, as three checks over every *.rs
# that walk.sh yields (test code included; the directories it prunes are not
# walked):
#   A. a contiguous comment block over its cap in prose lines fails: inline
#      // and /* */ 2, item docs /// 4, module headers //! 6. Blank lines and
#      fenced examples in doc comments don't count. There is no override.
#   B. a comment carrying a decision ID (D8), review ID (W7-SPEC-1) or ticket
#      reference (#503) fails.
#   C. a comment holding a run of eight or more `=` or `-` (a section banner)
#      fails: a file that needs sections wants splitting into modules.
# Comments come from ast-grep (rule: comment.yml), so `//` inside a string
# literal is never a comment. A block is consecutive whole-line comments of one
# kind on consecutive lines; a /* */ comment is a block of its own. A trailing
# // comment (after code) starts a block that continues onto the whole-line //
# comments directly below it that start at the trailing comment's column
# (rustfmt's continuation alignment); a whole-line comment at any other column
# starts a new block.
#
# Usage: comments.sh [ROOT_DIR]   (default: the repo root)
set -u

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="${1:-$(cd "$here/../.." && pwd)}"
root="${root%/}"

for tool in ast-grep jq; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "comments: $tool is not on PATH; the comment check needs it" >&2
    exit 1
  fi
done

# shellcheck source=walk.sh
. "$here/walk.sh"

files=()
while IFS= read -r f; do
  files+=("$f")
done < <(walk -name '*.rs' -type f -print | sort)

if [ "${#files[@]}" -eq 0 ]; then
  echo "comments: caps, IDs and banners are clean"
  exit 0
fi

# One TSV record per comment: file, 0-based line, whole-line flag, 0-based
# start column, kind, ID tokens, text (newline -> \001, tab -> space).
records="$(mktemp "${TMPDIR:-/tmp}/comments.XXXXXX")"
trap 'rm -f "$records"' EXIT
if ! ast-grep scan --rule "$here/comment.yml" --json=stream "${files[@]}" | jq -r '
  def kind: if startswith("//!") then "module"
    elif (startswith("///") and (startswith("////") | not)) then "doc"
    else "inline" end;
  (.text | rtrimstr("\n")) as $t
  | .range.start.column as $c
  | [ .file,
      .range.start.line,
      ((.lines | split("\n")[0])[0:$c] | test("^\\s*$")),
      $c,
      ($t | kind),
      (((if ($t | test("[=-]{8,}")) then ["BANNER"] else [] end) + [$t | match("\\bD[0-9]+\\b|\\b[A-Z][0-9]+-[A-Z]+-[0-9]+\\b|#[0-9]{2,}\\b"; "g").string]) | join(",")),
      ($t | gsub("\t"; " ") | gsub("\n"; "\u0001"))
    ] | @tsv' >"$records"; then
  echo "comments: ast-grep or jq failed" >&2
  exit 1
fi

LC_ALL=C awk -F '\t' -v root="$root/" '
function rel(f) { return index(f, root) == 1 ? substr(f, length(root) + 1) : f }
function flush(    i, s, fence, prose, cap, kd) {
  if (bkind == "") return
  prose = 0; fence = 0
  for (i = 1; i <= nlines; i++) {
    s = lines[i]
    sub(/^[ \t]+/, "", s)
    if (bkind == "block") {
      sub(/^\/\*+[!]?/, "", s); sub(/\*\/[ \t]*$/, "", s); sub(/^[ \t]*\*+/, "", s)
    } else {
      m = (bkind == "module") ? "//!" : (bkind == "doc") ? "///" : "//"
      if (substr(s, 1, length(m)) == m) s = substr(s, length(m) + 1)
      sub(/^ /, "", s)
    }
    if (s ~ /^[ \t]*$/) continue
    if ((bkind == "module" || bkind == "doc") && s ~ /^[ \t]*```/) { fence = !fence; continue }
    if (fence) continue
    prose++
  }
  if (bkind == "module") cap = 6
  else if (bkind == "doc") cap = 4
  else cap = 2
  kd = (bkind == "block") ? "inline" : bkind
  if (prose > cap) {
    printf "comments: %s:%d: %s comment block has %d prose lines (cap %d)\n", rel(bfile), bstart + 1, kd, prose, cap > "/dev/stderr"
    over[kd]++; total++
  }
  bkind = ""; nlines = 0
}
function load(text,    n, i, tmp) {
  n = split(text, tmp, "\001")
  for (i = 1; i <= n; i++) lines[i] = tmp[i]
  nlines = n
}
{
  file = $1; line = $2 + 0; whole = $3; col = $4 + 0; kind = $5; ids = $6; text = $7
  if (ids != "") {
    n = split(ids, t, ",")
    for (i = 1; i <= n; i++) {
      if (t[i] == "BANNER") {
        printf "comments: %s:%d: section banner in a comment\n", rel(file), line + 1 > "/dev/stderr"
        banners++
      } else {
        printf "comments: %s:%d: ID %s in a comment\n", rel(file), line + 1, t[i] > "/dev/stderr"
        idc++
      }
      total++
    }
  }
  isblock = (substr(text, 1, 2) == "/*")
  if (isblock || whole != "true") {
    flush()
    bkind = isblock ? "block" : kind; bfile = file; bstart = line
    load(text)
    if (isblock || kind != "inline") { flush(); bend = -9; btrail = 0 }
    else { bend = line; bcol = col; btrail = 1 }
    next
  }
  if (bkind == kind && file == bfile && line == bend + 1 && (!btrail || col == bcol)) {
    lines[++nlines] = text; bend = line
  } else {
    flush()
    bkind = kind; bfile = file; bstart = line; bend = line; btrail = 0
    load(text)
  }
}
END {
  flush()
  if (total > 0) {
    printf "comments: %d finding(s): %d inline, %d doc, %d module over cap; %d IDs; %d banners\n", total, over["inline"] + 0, over["doc"] + 0, over["module"] + 0, idc + 0, banners + 0 > "/dev/stderr"
    exit 1
  }
}
' "$records" || exit 1
echo "comments: caps, IDs and banners are clean"
