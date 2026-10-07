---
name: tdd
description: Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions "red-green-refactor", or wants integration tests.
---

# Test-Driven Development

TDD is the red → green loop; every section below applies on every cycle.

When exploring the codebase, read `CONTEXT.md` (if it exists) so test names and interface vocabulary match the project's domain language, and respect ADRs in the area you're touching (both per `/domain-modeling`).

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification — "user can checkout with valid cart" tells you exactly what capability exists — and survives refactors because it doesn't care about internal structure.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Seams — where tests go

**Seam** is meant in `/codebase-design`'s sense: where a module's interface lives, and so where tests observe behaviour.

**Test only at pre-agreed seams.** Before writing any test, write down the seams under test and confirm them. You can't test everything — agreeing the seams up front is how testing effort lands on the critical paths and complex logic instead of every edge case. Confirmation takes one of two forms:

- **Live session**: ask the user — "What's the public interface, and which seams should we test?" Describe each proposed seam at the interface level, in the project's domain language: what interface it is and what behaviour is observable there. Cite the code as `path:line` when the user asks to see it.
- **AFK session driven by a spec** (a `/ship` agent, say): the spec's **Seams under test** list *is* the confirmation — the human agreed it upstream, via design tickets on the `/wayfinder` map or at `/specify` time. Don't re-ask, and don't widen it.

Either way, no test is written at an unconfirmed seam. An AFK agent whose work no listed seam covers has found a **spec gap** — park and report it per the ship discipline, never invent a seam.

When the shape of that interface is itself in question — how deep the module is, where the seam belongs, what it should expose — consult `/codebase-design` as a reference, not a session to run.

## Anti-patterns

- **Implementation-coupled** — mocks internal collaborators, tests private methods, or verifies through a side channel (querying the database instead of using the interface). The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological** — the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth — a known-good literal, a worked example, the spec.
- **Horizontal slicing** — writing tests in bulk ahead of the implementation. One test, then one implementation, at a time.

## Rules of the loop

- **Red before green.** Write the failing test first, then only enough code to pass it. Don't anticipate future tests or add speculative features. The invocation and the test-name filter that keep the loop tight come from `/testing`.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Refactoring is not part of the loop.** It belongs to the review stage (`/diff-review`, whose Standards axis carries the smell baseline), not the red → green implementation cycle.
