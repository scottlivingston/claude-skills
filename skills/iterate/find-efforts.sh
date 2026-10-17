#!/usr/bin/env bash
# List the repo's /iterate efforts across every checkout `git worktree list`
# names, one line per effort, as tab-separated key=value fields:
#   status  name  log  branch  checkout  slice  stage  queued
# Active efforts only; --all includes done ones. Each index is read from the
# checkout that has its branch, else from the branch itself, else from wherever
# it was found. An index this can't parse prints an ERROR line on stderr and
# the exit status is 2; the other efforts still print.
set -euo pipefail

all=0
[ "${1:-}" = "--all" ] && all=1

git rev-parse --git-dir >/dev/null 2>&1 || { echo "find-efforts: not in a git repository" >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# <worktree path> TAB <branch, empty when detached>
git worktree list --porcelain | awk '
  /^worktree / { p = substr($0, 10); b = ""; bare = 0 }
  /^branch /   { b = substr($0, 8); sub("^refs/heads/", "", b) }
  /^bare$/     { bare = 1 }
  /^$/         { if (p != "" && !bare) print p "\t" b; p = "" }
  END          { if (p != "" && !bare) print p "\t" b }
' > "$tmp/worktrees"

# <log index path> TAB <worktree it was found in>
while IFS=$'\t' read -r wt _; do
  [ -d "$wt" ] || continue
  git -C "$wt" ls-files -- ':(glob)**/efforts/*/index.md' | while read -r f; do
    printf '%s\t%s\n' "$f" "$wt"
  done
done < "$tmp/worktrees" > "$tmp/found"

parse() { # $1 = log index path, stdin = index content
  # A formatter may wrap the header and long slice lines, so the header fields
  # are read from everything above the first section joined into one line, and a
  # slice line's indented continuations join it.
  awk -v lp="$1" '
    function d(v) { return v == "" ? "-" : v }
    function field(re,   v) { if (match(hdr, re)) { v = substr(hdr, RSTART, RLENGTH); split(v, a, "`"); return a[2] } return "" }
    function header() { branch = field("Branch: `[^`]*`"); checkout = field("Checkout:[ ]*`[^`]*`"); if (match(hdr, /Status: [a-z]+/)) status = substr(hdr, RSTART + 8, RLENGTH - 8); hdone = 1 }
    function slice(line,   n, f, st, label) {
      n = split(line, f, " · "); st = f[n]; sub(/[ \t]+$/, "", st)
      label = line; sub(/^- \[/, "", label); sub(/\].*$/, "", label)
      if (st == "queued") queued++; else { cur = label; curstage = st }
    }
    NR == 1 && /^# / { name = substr($0, 3) }
    !hdone && /^## / { header() }
    !hdone { hdr = hdr " " $0 }
    item != "" && /^[ \t]+[^ \t]/ { t = $0; sub(/^[ \t]+/, "", t); item = item " " t; next }
    item != "" { slice(item); item = "" }
    /^## / { inslices = ($0 == "## Slices") }
    inslices && /^- \[Slice / { item = $0 }
    END {
      if (!hdone) header()
      if (item != "") slice(item)
      if (branch == "" || status == "") { print "ERROR\t" lp; exit }
      # "-" stands in for an empty field: read collapses runs of tabs
      printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%d\n", status, d(name), lp, branch, d(checkout), d(cur), d(curstage), queued
    }
  '
}

rc=0
cut -f1 "$tmp/found" | sort -u | while read -r log; do
  first=$(awk -F'\t' -v l="$log" '$1 == l { print $2; exit }' "$tmp/found")
  branch=$(sed -n 's/.*Branch: `\([^`]*\)`.*/\1/p' "$first/$log" | head -n1)
  home=$(awk -F'\t' -v b="$branch" '$2 == b && b != "" { print $1; exit }' "$tmp/worktrees")

  if [ -n "$home" ] && [ -f "$home/$log" ]; then
    line=$(parse "$log" < "$home/$log")
  elif [ -n "$branch" ] && git show-ref --verify --quiet "refs/heads/$branch"; then
    line=$(git show "$branch:$log" 2>/dev/null | parse "$log")
  else
    line=$(parse "$log" < "$first/$log")
  fi

  case "$line" in
    ERROR*) echo "find-efforts: can't parse $log (no Branch: or Status: line)" >&2; echo 2 > "$tmp/rc"; continue ;;
  esac

  IFS=$'\t' read -r status name _ branch checkout slice stage queued <<< "$line"
  [ "$all" = 1 ] || [ "$status" = "active" ] || continue
  [ "$checkout" = - ] && checkout=
  [ "$slice" = - ] && slice=
  [ "$stage" = - ] && stage=

  if [ -z "$checkout" ]; then
    checkout=${home:+$home (no Checkout: line)}
    checkout=${checkout:-none}
  elif [ ! -d "$checkout" ]; then
    checkout="$checkout (missing)"
  fi

  printf 'status=%s\tname=%s\tlog=%s\tbranch=%s\tcheckout=%s\tslice=%s\tstage=%s\tqueued=%s\n' \
    "$status" "$name" "${log%/index.md}" "$branch" "$checkout" "${slice:-none}" "${stage:-none}" "$queued"
done

[ -f "$tmp/rc" ] && rc=$(cat "$tmp/rc")
exit "$rc"
