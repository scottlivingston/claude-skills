#!/usr/bin/env bash
# mise-tasks/lint.d/docs-selftest.sh — fixtures for `mise run lint:docs`.
#
# Runs rustdoc on single-file crates with exactly the $RUSTDOCFLAGS the task
# sets (empty means the task is not what is running this: fail), so the flags
# are proved, not assumed. The failing cases must exit non-zero and name the
# link; a private item's broken link must fail, because the real build
# documents private items.
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=check.sh
. "$here/check.sh"

if [ -z "${RUSTDOCFLAGS:-}" ]; then
  echo "docs-selftest: RUSTDOCFLAGS is empty; run it as 'mise run lint:docs', which sets the flags under test" >&2
  exit 1
fi

# doc_case <case> <expect: pass|fail> <needle> [source lines...]
doc_case() {
  local name="$1" expect="$2" needle="$3" out rc
  shift 3
  mkdir -p "$work/$name"
  printf '%s\n' "$@" >"$work/$name/f.rs"
  # shellcheck disable=SC2086 # RUSTDOCFLAGS is a flag list
  out="$(cd "$work/$name" && rustdoc --edition 2024 --crate-type lib --document-private-items $RUSTDOCFLAGS -o "$work/$name/out" f.rs 2>&1)"
  rc=$?
  if [ "$expect" = pass ]; then
    check "$name: exits 0" '[ "$rc" -eq 0 ]' "exit $rc: $out"
  else
    check "$name: exits non-zero" '[ "$rc" -ne 0 ]' "exit $rc: $out"
    check "$name: names $needle" 'printf "%s" "$out" | grep -qF "$needle"' "$out"
  fi
}

doc_case clean pass "" \
  '/// Calls [`other`].' \
  'fn one() { other() }' \
  'fn other() {}'

doc_case private-broken fail nope \
  '/// Calls [`nope`].' \
  'fn one() {}'

doc_case ambiguous fail init \
  '/// Runs [`init`].' \
  'pub fn one() {}' \
  'pub fn init() {}' \
  'pub mod init {}'

check_summary
