---
name: ship
description: Take a spec (or a completed wayfinder map) through to committed, reviewed code with one human approval gate — distill the spec if needed, break it into tickets (the approval gate), then implement the ticket DAG with a fresh agent per ticket, reviewing each.
disable-model-invocation: true
---

Ship turns a fully-decided plan into code with minimal human involvement. The human's two touchpoints: approving the ticket breakdown, and reviewing the final result. Everything upstream of ship is where the decisions got made — ship never makes product decisions; when it hits one, it stops and asks.

The user invokes with a spec (issue URL/number or file path) or a wayfinder map. For the issue tracker, read `issue-tracker.md` in this plugin's `skills/` directory (a repo-level tracker doc overrides it).

## Process

### 1. Establish the spec

- Given a **spec**: read it in full (body and comments).
- Given a **wayfinder map**: if it isn't complete (open tickets or non-empty Not-yet-specified), stop — chart or `/drain` first. Otherwise run `/to-spec <map>` (map mode) and continue with the published spec.

### 2. Tickets — the approval gate

Run `/to-tickets <spec>`. Its quiz — granularity, blocking edges, merge/split — is the **single approval gate** of the whole run. Do not skip it. After the human approves and the tickets are published, no further approval is sought until the final report.

### 3. Implement the DAG

Work the frontier **serially, one ticket per fresh agent** — blocking edges encode logical order, not file overlap, so tickets are not run in parallel even when the frontier is wide.

Loop until no tickets remain open:

1. Take the first frontier ticket (all blockers closed). Claim it (assign).
2. Spawn a fresh agent with: the spec, the ticket body, and the `/implement` discipline — `/tdd` at the seams the spec agreed, typecheck regularly, single test files regularly, full suite at the end, commit to the current branch. The fresh context per ticket is the point; never implement two tickets in one agent.
3. Review the ticket's diff with `/two-axis-review` against the spec (Spec axis) and the repo's standards (Standards axis). Findings worth fixing → a fix agent applies them and re-runs the affected tests; then close the ticket with a resolution comment linking the commits.
4. A ticket that fails — tests won't go green, or it needs a product decision the spec doesn't hold — is left open and unclaimed with a comment saying exactly what's missing. Continue with tickets it doesn't block; report it at the end. If it blocks everything, stop and surface it now.

### 4. Final report

Run the full test suite once more. Report per ticket: what landed (commits), review findings fixed vs waived, and any tickets left open with why. The branch is left for human review — ship never merges, pushes to shared branches, or opens PRs unless the user asked for that explicitly.
