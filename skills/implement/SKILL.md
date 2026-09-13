---
name: implement
description: "Implement a piece of work based on a spec or set of tickets. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously."
---

Implement the work described by the user in the spec or tickets.

## Tracker discipline

When the work comes from a ticket on the issue tracker (see `/issue-tracker`):

- **Claim first**: label the ticket `in-progress` before any work, so concurrent sessions and `/ship` runs skip it. One ticket per session — never batch.
- **Load bounded context**: when the ticket cites spec decision IDs (a `Decisions:` line or section), read the spec's kernel body plus exactly those decisions in full (the tracker doc's spec-decision read) — not the whole decision log. If mid-work you need a decision the ticket doesn't cite, look it up in the kernel's Decision Index, fetch it by ID, and note the missed routing in a ticket comment.
- **On completion**: close the ticket with a comment linking its commits, and remove `in-progress`.
- **If blocked or parked** (red tests, or a decision the spec doesn't hold): do NOT close it — remove `in-progress`, comment exactly what's missing, and if it was a spec gap, also comment the gap on the spec issue.

## Discipline

Use /tdd where possible, at pre-agreed seams.

Resolve the test recipes per `/testing` for the files the work touches before the first run: the *Scoping to a change* set is what you run while working, and the *Green* set is what passes once at the end — and if the repo has none, say "no TESTING.md — agents discovered test commands" in your report, then run typechecking regularly, single test files regularly, and the full test suite once at the end.

Outside a `/ship` run, review the work with /diff-review once done; inside one, the wave verification reviews the merged diff — don't review your own worktree.

Commit your work to the current branch.
