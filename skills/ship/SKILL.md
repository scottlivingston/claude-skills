---
name: ship
description: Implement a spec's ticket DAG in parallel — fresh agent per ticket in an isolated worktree, per-ticket review, serial merges — updating the tracker as it goes. Runs after /to-tickets; ends by handing off to /two-axis-review and a PR that closes the spec.
disable-model-invocation: true
---

Ship turns an approved ticket DAG into committed, reviewed code with no human in the loop until the end. All decisions were made upstream — the wayfinder map, the spec, the `/to-tickets` quiz. Ship never makes product decisions; when it hits one, it parks the ticket and reports.

The user invokes with a **spec** (issue URL/number) whose implementation tickets already exist as its sub-issues. For the issue tracker, read `issue-tracker.md` in this plugin's `skills/` directory (a repo-level tracker doc overrides it).

## Guardrails

- **Wrong entry point?** Redirect, don't improvise: a spec with no tickets → run `/to-tickets <spec>` (HITL) first. A wayfinder map → `/to-spec <map>` first. An incomplete map → keep charting or `/drain`.
- **Branch discipline**: if on the default branch, create `spec-<number>-<slug>` and work there. The whole run lands on one branch; one PR closes the spec at the end.
- Ship never merges to shared branches, pushes, or opens PRs unless the user asked explicitly.

## Process

### 1. Load the DAG

Read the spec in full (body + comments). List its sub-issue tickets with their blocking edges and states. Report the wave structure you see (what's frontier now, what unblocks when).

### 2. Implement in waves

Repeat until no tickets remain open:

1. **Frontier**: the open tickets whose blockers are all closed. **Claim them all** before any work: `gh issue edit <n> --add-label in-progress` for each (bootstrap the label first if the repo lacks it; local fallback per the tracker doc). **Checkpoint**: do not spawn any agent until every frontier ticket verifiably carries `in-progress` (`gh issue list --label in-progress`).
2. **Parallel implement**: one fresh agent per frontier ticket, each in an **isolated worktree** — via parallel `Agent` calls with worktree isolation, or a dynamic `Workflow` (this skill is your authorization to use it). Each agent gets the spec, its ticket body, and the `/implement` discipline: `/tdd` at the seams the spec agreed, typecheck regularly, single test files regularly, commit in its worktree. Each agent's **first action** is to confirm its ticket carries `in-progress` and add the label if missing — a backstop, not a substitute for the checkpoint above. Fresh context per ticket is the point — never two tickets in one agent.
3. **Per-ticket review**: review each finished ticket's diff along the two axes (standards + ticket/spec fidelity); a fix agent applies findings worth fixing in the same worktree.
4. **Serial merge**: merge the worktree branches into the ship branch **one at a time**, running the affected tests after each merge (full suite if cheap). Blocking edges encode logical order, not file overlap — the serial merge is where overlap surfaces. On conflict, a fix agent resolves it preserving both tickets' intent, then re-tests. Never merge on red.
5. **Tracker updates as you go**: on merge, close the ticket with a comment linking its commits and remove `in-progress`; if an agent parked its ticket (red tests, or a decision the spec doesn't hold), unclaim it (remove `in-progress`) and comment exactly what's missing — and if it was a spec gap, also comment the gap on the **spec issue** so the spec stays truthful. Post a one-line wave summary comment on the spec issue (tickets landed, tickets parked).

A parked ticket doesn't stop the run unless it blocks everything — continue with the tickets it doesn't block, surface it in the final report.

### 3. Hand off

Run the full test suite once more. Report per ticket: commits, review findings fixed vs waived, parked tickets and why. Then point the user at the next step: `/two-axis-review <base>` with the spec issue as the Spec source — and, once that passes, a PR whose body `Closes #<spec>` (the sub-issue tickets are already closed with commit links, so the PR ties the branch to the whole tree).
