#!/usr/bin/env bash
# Shape's preflight, per SHAPE.md: proves an effort can run unattended before
# the lead takes over. Run from inside the repo after `wf.py setup <slug>`.
#
#   preflight.sh <slug>
#
# Prints one PASS, WARN, or FAIL line per check; exits 1 on any FAIL. The last
# check runs every CI job once on the effort branch, so it takes as long as CI.
set -uo pipefail

slug=${1:?usage: preflight.sh <slug>}
here=$(cd "$(dirname "$0")" && pwd)
wf() { "$here/wf.py" --effort "$slug" "$@"; }
branch="effort/$slug"
charter="docs/wayfinder/$slug.md"
failed=0
pass() { echo "PASS  $*"; }
warn() { echo "WARN  $*"; }
fail() { echo "FAIL  $*"; failed=1; }

for t in git python3; do command -v "$t" >/dev/null || fail "$t is not installed"; done
git rev-parse --git-dir >/dev/null 2>&1 || { fail "not inside a git repository"; exit 1; }
effort=$(wf effort 2>&1) && pass "effort $slug is set up" || { fail "$effort"; exit 1; }

if body=$(git show "$branch:$charter" 2>/dev/null); then
  pass "charter is at $charter on $branch"
  for s in "Destination" "Acceptance behaviors" "Principles" "Design" "Out of scope" "CI" "Limits" "Delegated"; do
    grep -q "^## $s" <<< "$body" || fail "charter has no '## $s' section"
  done
  behaviors=$(grep -cE '^- \*\*B[0-9]+:' <<< "$body")
  [ "$behaviors" -gt 0 ] && pass "charter lists $behaviors acceptance behaviors" || fail "charter lists no '- **B<n>: …**' behaviors"
  bad=$(grep -E '^- \*\*B[0-9]+:' <<< "$body" | grep -v '→' | grep -oE 'B[0-9]+' | tr '\n' ' ')
  [ -z "$bad" ] || fail "behaviors with no '→ <observable end state>': $bad"
  for l in "Pieces at once" "Build slots" "Drive slots"; do
    grep -qE "^- \*\*$l:\*\* *[0-9]+" <<< "$body" || fail "charter Limits has no number for '$l'"
  done
  skill=$(grep -oE '\.claude/skills/verify-[A-Za-z0-9._-]+' <<< "$body" | head -1)
  if [ -n "$skill" ]; then
    git cat-file -e "$branch:$skill/SKILL.md" 2>/dev/null && pass "verification skill $skill exists" || fail "charter names $skill but $branch has no $skill/SKILL.md — pass it to wf.py setup with --add"
  elif grep -qi 'built by the first foundation piece' <<< "$body"; then
    warn "greenfield: Plan must make the walking skeleton plus its verify skill the first piece"
  else
    fail "charter names no verify skill and doesn't say the first foundation piece builds one"
  fi
else
  fail "no charter at $charter on $branch"
fi

hook=$(git rev-parse --path-format=absolute --git-path hooks)/reference-transaction
grep -q "only the gate moves effort branches" "$hook" 2>/dev/null && pass "$branch is protected: only the gate moves it" || fail "the protection hook is missing at $hook — rerun wf.py setup"
head=$(git rev-parse -q --verify "$branch^{commit}"); prev=$(git rev-parse -q --verify "$branch~1")
if [ -z "$prev" ]; then
  warn "$branch has one commit, so the protection could not be tried"
elif git update-ref "refs/heads/$branch" "$prev" 2>/dev/null; then
  WAYFINDER_GATE=1 git update-ref "refs/heads/$branch" "$head"
  fail "a direct move of $branch was not refused — the hook is not running (is core.hooksPath pointing elsewhere?)"
else
  pass "a direct move of $branch is refused"
fi

mux=$(sh "$here/../multiplexer/mux.sh" which 2>/dev/null || echo none)
[ "$mux" != none ] && pass "running inside $mux" || warn "no multiplexer: the lead runs the gate in the background, and the human starts the lead and the status pane by hand"

planner=$(bash "$here/../model-policy/resolve-model-policy.sh" 2>/dev/null | awk -F'[=\t]' '$1 == "planner" {print $2}')
case $planner in
  '') fail "model policy has no planner tier" ;;
  inherit) warn "planner tier inherits the session model — set it in ~/.claude/model-policy.md to pin it" ;;
  *) pass "planner tier runs on $planner" ;;
esac

jobs=$(python3 -c 'import json,sys; print(len(json.load(sys.stdin)["ci"]))' <<< "$effort")
if [ "$jobs" -gt 0 ]; then
  pass "charter lists $jobs CI job(s); running them on $branch"
  wf check-base || { failed=1; echo "FAIL  CI is red on $branch before anything is built — fix the jobs or the base, then rerun"; }
else
  fail "charter's ## CI section lists no '- **<name>:** \`<command>\`' job"
fi

exit $failed
