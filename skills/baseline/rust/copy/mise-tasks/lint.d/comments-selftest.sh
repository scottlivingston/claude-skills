#!/usr/bin/env bash
# mise-tasks/lint.d/comments-selftest.sh — fixtures for `mise run lint:comments`.
#
# Each case is a tree generated under a scratch dir (never committed: its .rs
# files would be formatted and scanned like real code). comments.sh runs on
# each; the exit code and the planted file:line in the output are asserted, so
# a check that finds nothing cannot pass.
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=check.sh
. "$here/check.sh"

# expect_fail <case> <planted>
expect_fail() { expect_fail_with "$here/comments.sh" comments "$@"; }

# lines <array> <prefix> <count>: fill <array> with <count> numbered comment
# lines (bash 3.2 has no mapfile).
lines() {
  local i
  eval "$1=()"
  for ((i = 1; i <= $3; i++)); do eval "$1+=(\"\$2 line \$i\")"; done
}

c=clean
lines inline2 '//' 2
lines doc4 '///' 4
lines mod6 '//!' 6
lines fenced '/// let x =' 10
put $c a.rs "${mod6[@]}" '' "${inline2[@]}" 'fn a() {}' "${doc4[@]}" '///' \
  '/// ```rust' "${fenced[@]}" '/// ```' 'fn b() {}'
put $c b.rs \
  'fn a() {' \
  '    let a = 1; // one' \
  '    let b = 2; // two' \
  '    let c = 3; // three' \
  '    let d = 4; // four' \
  '    let e = 5; // five' \
  '    let _ = (a, b, c, d, e);' \
  '}' \
  "${doc4[@]}" \
  "${inline2[@]}" \
  'fn b() {}' \
  "${inline2[@]}" \
  '' \
  "${inline2[@]}" \
  'fn c() {}' \
  'fn d() {' \
  '    let a = 1; // one' \
  '    // two' \
  '    // three' \
  '    let b = 2;' \
  '}'
put $c c.rs \
  'const S: &str = "http://x // D8 #503 W7-SPEC-1 ==========";' \
  'const R: &str = r#"/* D9 */ color: #000;"#;' \
  '// R2 is not an ID' \
  '// D3D11 and 0xD8' \
  'fn f() {}' \
  '// #7 and #1a2b3c, a -> b, x == y' \
  'fn g() {}'
put $c target/p.rs '// a' '// b' '// c' '// d' '// e D8'
put $c .claude/p.rs '// a' '// b' '// c' '// d' '// e D8'
put $c vendor/p.rs '// a' '// b' '// c' '// d' '// e D8'
out="$(bash "$here/comments.sh" "$work/$c" 2>&1)"
rc=$?
check "clean: exits 0" '[ "$rc" -eq 0 ]' "exit $rc: $out"

c=inline-over
put $c a.rs 'fn a() {}' "${inline2[@]}" '// three' 'fn b() {}'
expect_fail $c a.rs:2

c=trailing-aligned-over
put $c a.rs 'fn a() {' '    let x = 1; // one' '               // two' '               // three' \
  '               // four' '               // five' '}'
expect_fail $c a.rs:2

c=block-over
put $c a.rs 'fn a() {}' '/* one' '   two' '   three' '   four' '   five */' 'fn b() {}'
expect_fail $c a.rs:2

c=doc-over
put $c a.rs 'fn a() {}' "${doc4[@]}" '/// five' 'fn b() {}'
expect_fail $c a.rs:2

c=module-over
put $c a.rs "${mod6[@]}" '//! seven' 'fn b() {}'
expect_fail $c a.rs:1

c=test-module-over
put $c a.rs 'fn a() {}' '#[cfg(test)]' 'mod tests {' '    // one' '    // two' '    // three' '    // four' \
  '    // five' '}'
expect_fail $c a.rs:4

c=decision-id
put $c a.rs 'fn a() {}' '// keeps D8' 'fn b() {}'
expect_fail $c a.rs:2

c=review-id
put $c a.rs 'fn a() {}' '/// see W7-SPEC-1' 'fn b() {}'
expect_fail $c a.rs:2

c=ticket-ref
put $c a.rs '//! from #503' 'fn b() {}'
expect_fail $c a.rs:1

c=trailing-id
put $c a.rs 'fn a() {' '    let x = 1; // #42' '}'
expect_fail $c a.rs:2

c=fenced-id
put $c a.rs '/// ```' '/// let x = 1; // D8' '/// ```' 'fn a() {}'
expect_fail $c a.rs:2

c=banner
put $c a.rs 'fn a() {}' '// ============' '// Section' '// ============' 'fn b() {}'
expect_fail $c "a.rs:2: section banner"

c=dash-banner
put $c a.rs 'fn a() {' '    // --- Phase A ----------' '}'
expect_fail $c "a.rs:2: section banner"

check_summary
