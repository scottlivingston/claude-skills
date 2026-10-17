#!/usr/bin/env bash
# Resolve the three model tiers per SKILL.md's order — repo policy, then user
# policy, then defaults, first found wins per key — and print one line per tier:
#   <tier>=<value> TAB <where it came from>
# Run from inside the repo (or pass its root). A line in a policy file naming no
# known tier is reported on stderr and ignored.
set -euo pipefail

root=${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}
repo_file="$root/.claude/model-policy.md"
user_file="$HOME/.claude/model-policy.md"

value_in() { # $1 = file, $2 = tier → the tier's value, or nothing
  [ -f "$1" ] || return 0
  awk -v t="$2" '
    { line = $0; sub(/^[ \t>*-]*/, "", line) }
    line ~ "^" t "[ \t]*:" { sub(/^[^:]*:[ \t]*/, "", line); sub(/[ \t`]+$/, "", line); gsub(/`/, "", line); print line; exit }
  ' "$1"
}

for f in "$repo_file" "$user_file"; do
  [ -f "$f" ] || continue
  awk -v f="$f" '
    { line = $0; sub(/^[ \t>*-]*/, "", line) }
    line ~ /^[A-Za-z_-]+[ \t]*:/ && line !~ /^(executor|decider|auditor)[ \t]*:/ {
      print "model-policy: " f ": ignoring \"" $0 "\" (not a tier)" > "/dev/stderr"
    }
  ' "$f"
done

for tier in executor decider auditor; do
  case $tier in executor) default=sonnet ;; *) default=inherit ;; esac
  v=$(value_in "$repo_file" "$tier"); src=$repo_file
  [ -n "$v" ] || { v=$(value_in "$user_file" "$tier"); src=$user_file; }
  [ -n "$v" ] || { v=$default; src=default; }
  printf '%s=%s\t%s\n' "$tier" "$v" "$src"
done
