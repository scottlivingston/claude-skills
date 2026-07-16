---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

## Tracker discipline

When the work comes from a ticket on the issue tracker (see `issue-tracker.md` in this plugin's `skills/` directory):

- **Claim first**: label the ticket `in-progress` before any work, so concurrent sessions and `/ship` runs skip it. One ticket per session — never batch.
- **On completion**: close the ticket with a comment linking its commits, and remove `in-progress`.
- **If blocked or parked** (red tests, or a decision the spec doesn't hold): do NOT close it — remove `in-progress`, comment exactly what's missing, and if it was a spec gap, also comment the gap on the spec issue.

## Discipline

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /two-axis-review to review the work.

Commit your work to the current branch.
