---
name: testing
description: Where a repo's test recipes live — TESTING.md at root, per-directory deltas in monorepos, nearest scope wins — and how implementing and shipping skills scope their test runs to a change. Consult before running tests as a spawned agent, filling a workflow's test-notes slot, or setting up a repo's TESTING.md.
---

# Testing

Shared convention for where a repo's test recipes live and how skills find them. The implementing skills — `/implement`, `/tdd`, and every agent a `/ship` wave spawns — run whatever the repo documents; this doc fixes *where* that documentation canonically lives, so a cold agent finds the minimal set that has to pass for its change instead of running the whole suite on every merge.

## The file

`TESTING.md` at the repo root is the canonical home for **how tests are run** — the invocations, and which of them a given change has to pass. It is for running tests, not standards (how code should be written is `CONVENTIONS.md` territory) and not setup (installing toolchains and getting a checkout working is CONTRIBUTING territory).

Create it lazily — when the suite first grows past "run everything" being cheap. A repo without one still ships and implements (see [Fallback](#fallback)).

## Sections

Fixed headings, each optional, that the consuming skills quote **verbatim** into agent briefs — so write each as a recipe a stranger can follow, not a discussion:

- `## Typecheck` — the type-check invocation(s), if the language has one separate from the test run.
- `## Unit` — how to run unit tests: whole tree, one package, one file, one test by name.
- `## Integration` — how to run integration tests, and anything they need up first (a database, a container, an env file).
- `## Scoping to a change` — the load-bearing section. Given the set of files a change touches, which invocations are the **minimal set** that has to pass — the touched packages *and their reverse dependents* — and which touched paths force the **full suite** (lockfiles, root build config, shared test tooling, anything every package imports).
- `## Green` — what must pass before a ticket closes and before a PR: the definition of green for the whole repo, typically the full suite plus typecheck, or the CI command that stands in for it.

## Monorepo scoping

Any directory may carry its own `TESTING.md`, binding everything beneath it:

```
/
├── TESTING.md              ← binds the whole repo
├── crates/
│   ├── core/
│   │   └── TESTING.md      ← binds crates/core/** — a delta over root
│   └── cli/
└── apps/
```

- **Nearest ancestor wins.** The recipes governing a file are every `TESTING.md` on its ancestor path, root included; where two sections conflict, the nearer file's section wins.
- **Scoped files are deltas.** Write them as differences over the root — "as root, except…" plus additions — never as full copies; a copy forks and drifts.
- **No index file.** Scoping is purely directory-based, so the ancestor walk *is* the lookup.

A change spanning scopes takes the **union** of the governing files' scoping rules: collect the governing set per touched file, apply each file's own *Scoping to a change* to it, and run everything any of them names. Green for such a change is the root's *Green* section unless a nearer file tightens it.

## Resolution order

Resolve once per change, from the set of files it touches:

1. **Governing `TESTING.md` files** for the touched paths, per the scoping above.
2. **`~/.claude/testing.md`** — a user default in the same sections, for repos the user works in that carry none of their own.
3. **Nothing.** The agent discovers the commands itself — the task runner's help, `package.json` scripts, `Cargo.toml` workspace members, CI config — and runs single test files while working and the full suite once at the end.

## Writing recipes

- **Every command runs cold from the repo root.** A spawned agent has no shell history, no CLAUDE.md, no session context — it has this file and a checkout. If a command needs a `cd`, a service up, or an env var, the recipe says so on the same line.
- **Name the task runner form the repo insists on.** `just test`, `pnpm -r test`, `cargo nextest run` — if the repo has a wrapper it wants used instead of the raw tool, the recipe names the wrapper, so an agent never reaches for a raw invocation that skips the wrapper's setup.
- **Say how to pass a test-name filter.** Red–green runs one test dozens of times; the recipe shows the filter syntax for one file and one test name so that loop stays tight.
- **Write the scoping rule as a decision procedure.** "Touched `crates/<x>/**` → run `cargo test -p <x>` plus `-p` for every crate whose `Cargo.toml` depends on `<x>`; touched `Cargo.lock`, `Cargo.toml` at root, or `xtask/**` → full suite." An agent can execute that against a file list; "run the relevant tests" it cannot.
- **Skip what the environment already says.** A one-line lookup an agent can make (`--help`, the scripts block) needs no cache here; what belongs here is the rule no config confesses — which crates depend on which, which paths are load-bearing for everyone.

## Fallback

A repo without `TESTING.md` still ships and implements: agents fall through the resolution order and discover commands themselves. The gap stays visible — a `/ship` ledger's wave summary, or an `/implement` report, says **"no TESTING.md — agents discovered test commands"** so the next person can decide whether writing one is worth it.
