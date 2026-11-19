#!/usr/bin/env bash
# mise-tasks/lint.d/layout-selftest.sh — fixtures for `mise run lint:layout`.
#
# Each case is a tree generated under a scratch dir (never committed: a
# committed fixture needs a Cargo.toml, which cargo would find, and its .rs
# files would be formatted and scanned like real code). layout.sh runs
# on each; the exit code and the planted path in the output are asserted. A
# check that finds nothing proves nothing, so every failing case must name its
# file.
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=check.sh
. "$here/check.sh"

# expect_fail <case> <planted>
expect_fail() { expect_fail_with "$here/layout.sh" layout "$@"; }

# clean: everything allowed, nothing flagged.
c=clean
put $c a/mod.rs '//! Header.' 'pub mod b;' 'mod c;' 'pub use c::C;' 'pub(crate) use c::D;' '#[cfg(test)]' 'mod tests;'
put $c a/b.rs 'pub fn f() {}'
put $c a/c.rs 'pub struct C; pub struct D;'
put $c a/tests.rs '#[test] fn t() {}'
put $c b.rs '//! Header.' 'pub mod c;'
put $c b/c.rs 'pub fn f() {}'
put $c assets.rs 'pub fn f() {}'
mkdir -p "$work/$c/assets"
: >"$work/$c/assets/logo.png"
put $c d.rs 'pub fn f() {}'
put $c x/Cargo.toml '[package]'
put $c x/tests/common/mod.rs 'pub fn helper() {}'
put $c x/tests/it.rs '//! Covers x.' '#[test] fn t() {}'
put $c lib.rs '//! Header.' 'pub mod a;' 'pub use a::b::f;'
put $c m/src/lib.rs 'mod expand;' '#[proc_macro]' '/// Doc.' 'pub fn m(input: proc_macro::TokenStream) -> proc_macro::TokenStream { expand::run(input) }'
put $c m/src/expand.rs 'pub fn run(t: proc_macro::TokenStream) -> proc_macro::TokenStream { t }'
put $c vendor/p/mod.rs 'fn fat() {}'
put $c vendor/p/q.rs 'fn q() {}'
put $c vendor/types.rs 'pub struct T;'
put $c target/p/mod.rs 'fn fat() {}'
put $c target/p/q.rs 'fn q() {}'
put $c .claude/p/mod.rs 'fn fat() {}'
put $c .claude/p/q.rs 'fn q() {}'
out="$(bash "$here/layout.sh" "$work/$c" 2>&1)"
rc=$?
check "clean: exits 0" '[ "$rc" -eq 0 ]' "exit $rc: $out"

c=fat-mod-rs
put $c foo/mod.rs 'pub fn f() {}'
put $c foo/bar.rs 'pub fn g() {}'
expect_fail $c foo/mod.rs

c=fat-sibling-root
put $c foo.rs 'pub struct S;'
put $c foo/bar.rs 'pub fn g() {}'
expect_fail $c foo.rs

c=inline-tests-root
put $c foo/mod.rs 'mod bar;' '#[cfg(test)]' 'mod tests {' '    #[test] fn t() {}' '}'
put $c foo/bar.rs 'pub fn g() {}'
expect_fail $c foo/mod.rs

c=private-use-root
put $c foo/mod.rs 'mod bar;' 'use bar::g;'
put $c foo/bar.rs 'pub fn g() {}'
expect_fail $c foo/mod.rs

c=single-file-mod
put $c foo/mod.rs 'pub mod x;'
expect_fail $c foo/mod.rs

c=headerless-itest
put $c crate/Cargo.toml '[package]'
put $c crate/tests/t.rs '// not a header' '#[test] fn t() {}'
expect_fail $c crate/tests/t.rs

c=types-rs
put $c engine/src/types.rs 'pub struct T;'
expect_fail $c engine/src/types.rs

c=fat-lib-rs
put $c crate/src/lib.rs 'pub mod a;' 'pub fn helper() {}'
put $c crate/src/a.rs 'pub fn f() {}'
expect_fail $c crate/src/lib.rs

c=proc-macro-helper-in-lib
put $c m/src/lib.rs '#[proc_macro]' 'pub fn m(t: proc_macro::TokenStream) -> proc_macro::TokenStream { helper(t) }' 'fn helper(t: proc_macro::TokenStream) -> proc_macro::TokenStream { t }'
expect_fail $c m/src/lib.rs

check_summary
