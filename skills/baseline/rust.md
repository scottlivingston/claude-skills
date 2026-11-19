# Rust defaults

Rust's rules, and how a Rust repo meets each gate requirement in [`global.md`](global.md).

## Files

Two trees sit under `rust/`:

- **`rust/copy/`** lands byte for byte at the same path under the repo root: the formatter and ast-grep configs, `deny.toml`, the ast-grep rules with their tests, and the checks under `mise-tasks/lint.d/`. On a later run, a file that differs from its copy here is drift: restore it, and move whatever the repo added into a file of its own.
- **`rust/merge/`** holds fragments to merge into a file the repo owns: `mise.toml`, `Cargo.toml`, and `gitignore` for `.gitignore`. Add what is missing and leave the repo's other entries alone.

Three things the fragments leave to the repo:

- **Every `PIN` in `mise.toml` becomes an exact current version.** Rust is a dated nightly (`nightly-YYYY-MM-DD`), with a `targets` entry for each target the repo builds.
- **`lint:clippy` gets a pass for every further compile surface:** each feature set built on its own, each extra target, each other workspace root. A surface with no test targets runs the production pass alone.
- **Every member crate inherits the lints and the edition:** `[lints] workspace = true` and `edition.workspace = true`. Another workspace root carries the root's `[workspace.lints]` tables verbatim.

## How the gate is met

| Requirement in `global.md`      | Check                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| Formatting                      | `fmt:check` — dprint, running rustfmt on `.rs`                                       |
| Comment caps, IDs, banners      | `lint:comments`                                                                      |
| Test names                      | `lint:ast-grep`, rule `test-name`                                                    |
| Integration test headers        | `lint:layout`, on each `tests/*.rs`                                                  |
| Dependency advisories           | `lint:deny`                                                                          |
| Drift                           | `lint:clippy-config` for scoped `clippy.toml` files, `lint:lints-config` for lints   |
| Proved checks                   | each `*-selftest.sh`, and `ast-grep test`                                            |
| Unwritten code is skipped       | `walk.sh`, the dprint excludes and the `ast-grep scan` globs                         |

Rust adds these to the gate:

- **Clippy, warnings denied:** the `all` group plus `unwrap_used`, `panic`, `allow_attributes_without_reason`, `dbg_macro`, `todo` and `unimplemented`, and `unsafe_code` forbidden. Test targets allow the lints in `CLIPPY_TEST_ALLOWS` on the command line; test code takes no per-file `#[allow]`.
- **Module layout** (`lint:layout`): a module root — `lib.rs`, `mod.rs`, or a `foo.rs` beside `foo/` — holds only `mod` declarations, `pub use` re-exports and its header; a `mod.rs` alone in its directory becomes `<dir>.rs`; no `types.rs`.
- **Dead code** (`lint:ast-grep`, rule `no-allow-dead-code`): no `#[allow(dead_code)]`. Delete the code, or gate it with the same `#[cfg]` as its users.
- **Doc links** (`lint:docs`): a broken intra-doc link fails.

## CLAUDE.md

- **Cargo runs only through mise,** which wraps it with mr-boxington so every checkout and agent worktree shares one compilation cache.
- **Tests run through cargo-nextest,** never `cargo test`.
- **New crates use edition 2024.**

## CONVENTIONS.md

- **An `#[allow]` sits on the narrowest item it can, and its `reason` says why the lint is wrong there** — not that the code is unfinished.
- **Outside test code, an `.expect()` carries a message stating why it cannot fail.** If the invariant can't be stated, the code wants a `Result` and `?`.
- **`#[ignore]` marks a test with an external prerequisite and nothing else.**
