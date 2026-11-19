# mise-tasks/lint.d/check.sh — shared test harness for the lint.d
# fixture-driven selftests: the scratch-dir lifecycle, the checks/failed
# tally, the `check()` assertion primitive, and the `check_summary` tail
# that reports the tally and exits. Not a general test framework — scoped
# to what those selftests need.
# Non-executable (644), same as its callers: sourced, never run directly.

set -u

work="$(mktemp -d -p "${TMPDIR:-/tmp}")"
trap 'rm -rf "$work"' EXIT

checks=0
failed=0

check() {
  local desc="$1"
  checks=$((checks + 1))
  if eval "${2}"; then
    printf '  \033[32mok\033[0m    %s\n' "$desc"
  else
    failed=$((failed + 1))
    printf '  \033[31mFAIL\033[0m  %s\n' "$desc"
    printf '        %s\n' "$3"
  fi
}

# put <case> <relpath> [lines...]: write a file into the case tree.
put() {
  local f="$work/$1/$2"
  mkdir -p "$(dirname "$f")"
  shift 2
  printf '%s\n' "$@" >"$f"
}

# expect_fail_with <script> <prefix> <case> <planted>: the script fails on the
# case tree and its output names "<prefix>: <planted>".
expect_fail_with() {
  local script="$1" prefix="$2" case="$3" planted="$4" out rc
  out="$(bash "$script" "$work/$case" 2>&1)"
  rc=$?
  check "$case: exits 1" '[ "$rc" -eq 1 ]' "exit $rc: $out"
  check "$case: names $planted" 'printf "%s" "$out" | grep -qF "$prefix: $planted"' "$out"
}

check_summary() {
  echo
  if [ "$failed" -eq 0 ]; then
    printf '\033[32mall %d checks passed\033[0m\n' "$checks"
    exit 0
  fi
  printf '\033[31m%d of %d checks FAILED\033[0m\n' "$failed" "$checks"
  exit 1
}
