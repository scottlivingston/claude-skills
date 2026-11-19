# Global defaults

Rules for every repo, grouped by where each lands. `<…>` marks a placeholder for the repo's own name.

## Gate requirements

What the repo's `lint` task must enforce. Each language file says which check meets each one.

- **One gate.** `mise run lint` runs every deterministic check and fails on any finding, warnings included.
- **Formatting.** A formatter owns every source, Markdown, TOML and JSON file, at a line width of 120. Markdown is not hard-wrapped.
- **Comment caps.** A contiguous comment block fails over its cap in prose lines: 2 inline, 4 on an item's doc, 6 on a module or file header. Fenced examples don't count, and there is no override.
- **No IDs in comments.** A ticket, decision or review ID in a comment fails.
- **No section banners.** A comment holding a run of eight or more `=` or `-` fails: a file that needs sections wants splitting.
- **Test names.** A test named with a `test_` prefix fails.
- **Integration test headers.** An integration test file with no header comment fails.
- **Dependency advisories.** A known advisory against a locked dependency fails, unless an ignore entry says why it is safe and when to remove it. This is the one check in the gate that needs the network.
- **Drift.** Where a tool can't inherit its config, the copy is verbatim and a check fails when it diverges.
- **Proved checks.** Every custom check ships fixtures that prove it finds what it claims, and the fixtures run before the check does.
- **Custom syntax rules are ast-grep rules**, one per file under `lint/ast-grep/rules`, each with test cases and a snapshot under `lint/ast-grep/tests`.
- **Unwritten code is skipped.** `vendor/`, `archived/`, build output and `.claude/` (it holds other branches' worktrees) are never linted, and `.claude/worktrees/` is gitignored.

## CLAUDE.md

Rules an agent follows while working. `CLAUDE.md` stays short: these rules, then pointers to the other docs, never their contents.

- **Every command goes through mise.** Never invoke a toolchain binary directly: mise sets the toolchain, the environment and the working directory, so a direct call runs a different, unpinned toolchain. If a command isn't a mise task, add the task.
- **Every tool the repo needs is declared in `mise.toml`,** pinned to an exact version, with `lockfile = true` and `mise.lock` committed. Nothing is installed globally.
- **Tasks carry the standard names:** `check`, `build`, `test`, `lint`, `fmt`, `fmt:check`, and one `lint:<check>` per check in the gate.
- **A monorepo runs mise in monorepo mode,** and a project's task is invoked as `//<project>:<task>` from any directory.
- **Commit messages follow Conventional Commits:** `<type>(<scope>): <description>`, the scope optional.
- **A decision with a trade-off is an ADR under `docs/adr/`;** research goes under `docs/research/`.
- **Each root doc has one job:** `CLAUDE.md` for how an agent operates here, `CONVENTIONS.md` for the standards review checks, `TESTING.md` for how tests run, `CONTEXT.md` for the glossary. Each opens by saying what it owns and where the others live.

## CONVENTIONS.md

Rules review checks against a diff.

### The gate

- **A finding is fixed, not silenced.**
- **A check's finding states its reason and the fix.**
- **A mise task's description says what it checks and what makes it fail.**
- **A task that needs a credential or the network is not part of the gate,** the dependency advisory check excepted.
- **A document that tells the reader to run something names a mise task.**

### Comments

- **Comments explain why; the code says what.** A comment restating the line below it is a finding.
- **A comment carries no history** — no "no longer", "previously", or what a change replaced.
- **A comment describes the code it sits on.** One left on the wrong item after a move, or naming code that is gone, is a finding.
- **A comment carries one reason.** What needs more becomes a test named for the rule, or an ADR.
- **A module header states the decision or invariant the module holds,** never a restatement of what it contains.
- **Document what a public item does not do,** wherever the omission can bite a caller.
- **A runbook — env vars, expected runtime, memory needs — goes in `TESTING.md` or `docs/`,** not a module header.

### Tests

- **A test name is a sentence about the behavior,** not a label for the function under test. Read the failure output as prose: it should say what broke.
- **An integration test's header names what it covers and what is real versus stubbed.**
- **A unit test mocks every store, device and service it touches. An integration test or above runs against the real one.**
- **Tests sharing a live store isolate by data.** Seed what you assert on; never assert on the size of a shared list.
- **A test is skipped by default only when it has an external prerequisite.** Its doc says what it needs and how to run it, and a mise task runs it.

### Domain glossary

- **`CONTEXT.md` is a glossary and nothing else.** A term is one or two sentences saying what it is, plus an `_Avoid_` line, with no history.

## TESTING.md

- **A procedure for scoping a run to a change:** given the files a change touches, which tasks it has to pass.
- **The full gate, cheapest first, each step blocking the next:** `fmt:check`, `check`, `lint`, unit tests, integration tests.
- **A store-backed test tier provisions its own store on every run** and never touches the one development uses.
- **How to drive each app for real,** as mise tasks.
