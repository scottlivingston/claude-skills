#!/usr/bin/env bash
# Shape's preflight, per SHAPE.md: proves an effort can run unattended before
# the lead takes over. Run from inside the repo once effort/<slug> exists.
#
#   preflight.sh <slug>
#
# Prints one PASS, WARN, or FAIL line per check; exits 1 on any FAIL. The last
# check has the gate run every CI job once on the effort branch, so it takes as
# long as CI.
set -uo pipefail

slug=${1:?usage: preflight.sh <slug>}
here=$(cd "$(dirname "$0")" && pwd)
effort() { python3 "$here/effort.py" --effort "$slug" "$@"; }
branch="effort/$slug"
charter="docs/wayfinder/$slug.md"
failed=0
pass() { echo "PASS  $*"; }
warn() { echo "WARN  $*"; }
fail() { echo "FAIL  $*"; failed=1; }

for t in git python3 sc; do command -v "$t" >/dev/null || fail "$t is not on PATH"; done
git rev-parse --git-dir >/dev/null 2>&1 || { fail "not inside a git repository"; exit 1; }
git rev-parse -q --verify "refs/heads/$branch" >/dev/null || { fail "no branch $branch — create it per SHAPE.md"; exit 1; }
# The gate's own view of the branch: it answers only for a branch sc protects.
shown=$(sc gate view "$branch" --json 2>&1) && pass "$branch is protected: it has a gate" || { fail "$shown"; exit 1; }
field() { python3 -c 'import json,sys; print(eval(sys.argv[1], {"e": json.load(sys.stdin)}))' "$1" <<< "$shown"; }

if body=$(git show "$branch:$charter" 2>/dev/null); then
  pass "charter is at $charter on $branch"
  # effort.py owns the charter's shape.
  if problems=$(effort charter-check); then
    pass "charter has every section, $(grep -cE '^- \*\*B[0-9]+:' <<< "$body") acceptance behaviors with an end state, and its limits"
  else
    while IFS= read -r line; do fail "$line"; done <<< "$problems"
  fi
  limit() { grep -E "^- \*\*$1:\*\* *[0-9]+" <<< "$body" | grep -oE '[0-9]+' | head -1; }
  slots() { sc pool list --json | python3 -c 'import json,sys; d=json.load(sys.stdin); print(next((p["slots"] for p in (d if isinstance(d, list) else d["pools"]) if p["name"] == sys.argv[1]), ""))' "$1"; }
  pool() {  # <pool> <the charter's number>
    [ -n "$2" ] || return 0
    have=$(slots "$1")
    [ -n "$have" ] || { sc run --pool "$1" -- true >/dev/null 2>&1; have=$(slots "$1"); }
    [ "$have" = "$2" ] && pass "pool $1 has $2 slots" || fail "pool $1 has ${have:-no} slots and the charter says $2 — the human resizes it on the Queue screen of sc tui"
  }
  pool build "$(limit 'Build slots')"
  skill=$(grep -oE '\.claude/skills/verify-[A-Za-z0-9._-]+' <<< "$body" | head -1)
  [ -z "$skill" ] || pool "drive-${skill##*verify-}" "$(limit 'Drive slots')"
  if [ -n "$skill" ]; then
    git cat-file -e "$branch:$skill/SKILL.md" 2>/dev/null && pass "verification skill $skill exists" || fail "charter names $skill but $branch has no $skill/SKILL.md — it has to be in the commit the branch was created from"
  elif grep -qi 'built by the first foundation piece' <<< "$body"; then
    warn "greenfield: Plan must make the walking skeleton plus its verify skill the first piece"
  else
    fail "charter names no verify skill and doesn't say the first foundation piece builds one"
  fi
else
  fail "no charter at $charter on $branch"
fi

[ "$(field "e['required'] is not None")" = True ] || fail "no [gates] table in sc.toml on $branch matches it, so nothing can land"
for s in wayfinder/spec wayfinder/standards; do
  [ "$(field "'$s' in (e['required'] or [])")" = True ] || fail "sc.toml on $branch does not require $s in the gate table that holds $branch"
done
[ "$(field "all('ci/' + j['name'] in (e['required'] or []) for j in e['jobs'])")" = True ] && pass "every CI job is a required status" || fail "sc.toml on $branch has a job its gate does not require"
head=$(git rev-parse -q --verify "$branch^{commit}"); prev=$(git rev-parse -q --verify "$branch~1")
if [ -z "$prev" ]; then
  warn "$branch has one commit, so the protection could not be tried"
elif git update-ref "refs/heads/$branch" "$prev" 2>/dev/null; then
  SC_GATE=1 git update-ref "refs/heads/$branch" "$head"
  fail "a direct move of $branch was not refused — the hook is not running (is core.hooksPath pointing elsewhere?)"
else
  pass "a direct move of $branch is refused"
fi

mux=$(sh "$here/../multiplexer/mux.sh" which 2>/dev/null || echo none)
[ "$mux" != none ] && pass "running inside $mux" || warn "no multiplexer: the human starts the lead and sc tui by hand"

planner=$(bash "$here/../model-policy/resolve-model-policy.sh" 2>/dev/null | awk -F'[=\t]' '$1 == "planner" {print $2}')
case $planner in
  '') fail "model policy has no planner tier" ;;
  inherit) warn "planner tier inherits the session model — set it in ~/.claude/model-policy.md to pin it" ;;
  *) pass "planner tier runs on $planner" ;;
esac

jobs=$(field "len(e['jobs'])")
if [ "$jobs" -gt 0 ]; then
  pass "sc.toml lists $jobs CI job(s); running them on $branch"
  sc gate run "$branch" && sc gate wait "$branch" || { failed=1; echo "FAIL  CI is red on $branch before anything is built — fix the jobs or the base, then rerun"; }
else
  fail "sc.toml on $branch lists no [jobs.<name>]"
fi

exit $failed
