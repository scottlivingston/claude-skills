---
name: conventions
description: Where a repo's reviewable coding standards live — CONVENTIONS.md at root, per-directory deltas in monorepos, nearest scope wins — and how reviewers find them. Consult when reviewing code against standards, documenting a new standards rule, or setting up a repo's CONVENTIONS.md.
---

# Conventions

Shared convention for where a repo's coding standards live and how skills find them. The reviewing skills — `/two-axis-review`'s Standards axis and `/ship`'s wave review — enforce whatever the repo documents; this doc fixes *where* that documentation canonically lives, so review finds it deterministically and rules discovered during review have exactly one place to land.

## The file

`CONVENTIONS.md` at the repo root is the canonical home for **reviewable coding standards** — the rules a reviewer checks a diff against. It is for standards, not setup: how code should be written, not how to run the project (CONTRIBUTING territory) and not how an agent should operate (CLAUDE.md territory).

Create it lazily — when the first rule worth documenting exists. A repo without one still gets reviewed (see [Fallback](#fallback)).

## Monorepo scoping

Any directory may carry its own `CONVENTIONS.md`, binding everything beneath it:

```
/
├── CONVENTIONS.md              ← binds the whole repo
├── apps/
│   ├── web/
│   │   └── CONVENTIONS.md      ← binds apps/web/** — a delta over root
│   └── api/
└── packages/
```

- **Nearest ancestor wins.** The standards governing a file are every `CONVENTIONS.md` on its ancestor path, root included; where two rules conflict, the nearer file's rule wins.
- **Scoped files are deltas.** Write them as differences over the root — "as root, except…" plus additions — never as full copies; a copy forks and drifts.
- **No index file.** Scoping is purely directory-based, so the ancestor walk *is* the lookup — nothing like `CONTEXT-MAP.md` is needed.

A reviewer facing a diff that spans scopes collects the governing set per file and applies each file's own standards to it — one app's rules never judge another app's code.

## Writing rules

- **A rule must be checkable against a diff.** State it so a reviewer can cite it (file + rule) and point at the violating hunk. "Prefer clarity" isn't checkable; "errors cross module boundaries as `Result`, never as thrown exceptions" is.
- **Skip anything tooling enforces.** Formatters and linters own that layer; a rule belongs here only if review is the thing that catches it.
- **One rule per bullet**, naming the preferred alternative where one exists — reviewers propose fixes from these, so "don't X" is half a rule; "don't X, do Y" is whole.
- **A documented rule overrides the review smell baseline.** Where a rule endorses something the baseline would flag, the reviewer suppresses the smell — so document deliberate deviations rather than re-arguing them every round.

## Where rules come from

Written by hand any time — and grown by the review loop: `/two-axis-review`'s `later` verdict parks a repo-wide pattern as a cleanup ticket whose task list includes **appending the rule to the governing `CONVENTIONS.md`** — the scope nearest the pattern, root when it's repo-wide. That is the loop's self-improvement path: a judgement call the review keeps rediscovering becomes a documented standard the next round enforces as a hard violation. `CONVENTIONS.md` is the only file review ever appends rules to.

## CLAUDE.md points, never duplicates

Standards live here; `CLAUDE.md` may link to this file so coding agents follow the rules while writing, but never restates them. A rule living in both copies drifts, and "the repo overrides the baseline" turns ambiguous about which copy is the repo's word.

## Fallback

A repo without `CONVENTIONS.md` still has standards sources: anything documenting how code should be written — `CODING_STANDARDS.md`, `CONTRIBUTING.md`, `STYLEGUIDE.md`, or equivalents under `docs/`. Reviewers use them as found. `CONVENTIONS.md` is simply the first place looked, the tiebreaker, and the only append target.
