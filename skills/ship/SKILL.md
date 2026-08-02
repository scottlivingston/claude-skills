---
name: ship
description: Implement a spec's ticket DAG by authoring and launching one dynamic workflow — fresh agent per ticket in an isolated worktree, serial merges, a review pass per wave — while the managing session delegates everything and does no work itself. Runs after /to-tickets; ends by handing off to /two-axis-review and a PR that closes the spec. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

Ship turns an approved ticket DAG into committed, reviewed code with no human in the loop until the end. All decisions were made upstream — the wayfinder map, the spec, the `/to-tickets` quiz. Ship never makes product decisions; when it hits one, it parks the ticket and reports.

The user invokes with a **spec** (issue URL/number) whose implementation tickets already exist as its sub-issues. For the issue tracker, invoke `/issue-tracker`.

## Guardrails

- **Wrong entry point?** Redirect, don't improvise: a spec with no tickets → run `/to-tickets <spec>` (HITL) first. A wayfinder map → `/to-spec <map>` first. An incomplete map → keep charting or `/drain`.
- **Branch discipline**: if on the default branch, create `spec-<number>-<slug>` and work there. The whole run lands on one branch; one PR closes the spec at the end.
- Ship never merges to shared branches, pushes, or opens PRs unless the user asked explicitly.
- **The manager does no work.** This session authors the workflow, launches it, relays progress, and reports — implementation, review, merging, and tracker updates all happen inside the workflow's agents.

## Process

### 1. Load the DAG

Read the spec in full — the kernel body plus its addressable decisions, per the tracker doc's spec-decision convention — including its Testing Decisions, **Seams under test** list, and Decision Index. (A spec with no Decision Index is the pre-index format: one body, passed whole wherever the steps below say "kernel plus cited decisions".) List its sub-issue tickets with their blocking edges, states, and the decision IDs each cites. Compute the wave structure (what's frontier now, what unblocks when) and report it.

### 2. Author and launch the workflow

Run the whole implementation as **one dynamic `Workflow`** (this skill is your authorization to use it). Pass the DAG — ticket ids, titles, blocking edges, cited decision IDs — as `args`. The script loops waves until no tickets remain open; per wave:

1. **Claim**: claim every frontier ticket (the tracker doc's claim operation; run its bootstrap first if the markers don't exist), and verify the claim check passes before spawning any implementer.
2. **Parallel implement**: one fresh agent per frontier ticket, each in an **isolated worktree**. Each agent gets the spec **kernel** (Testing Decisions and Seams under test verbatim, Decision Index included), the **full text of the decisions its ticket cites** — never the whole decision log; bounded, relevant context is the point — its ticket body, and the `/implement` + `/tdd` discipline: red–green at the spec's seams, typecheck regularly, run single test files regularly, commit in its worktree. Its first action is confirming its ticket carries `in-progress`. Fresh context per ticket is the point — never two tickets in one agent. An agent that finds it needs a decision its ticket doesn't cite checks the Decision Index first: fetch that decision by ID (the tracker doc's read) and note the missed routing in a ticket comment. A decision the spec doesn't hold **anywhere**, or work no listed seam covers, **parks** the ticket: the agent unclaims it, comments exactly what's missing on the ticket, and comments the gap on the **spec issue** so the spec stays truthful.
3. **Serial merge**: merge finished worktree branches into the ship branch **one at a time**, running the affected tests after each merge (full suite if cheap). Blocking edges encode logical order, not file overlap — the serial merge is where overlap surfaces; on conflict, a merge agent resolves it preserving both tickets' intent, then re-tests. **Never merge on red** — a branch that can't come green is parked like any other. On green, close the ticket with a comment linking its commits and remove `in-progress`.
4. **Wave review**: one review pass over the wave's **combined merged diff** (split by subsystem if the wave is wide), along both axes — the repo's documented standards (sourced per the `/conventions` skill: `CONVENTIONS.md` at root plus any nearer scoped one, with the fallback sources for repos not using the convention), and fidelity to the tickets and spec — the kernel plus every decision the wave's tickets cite, contract snippets included. Reviewing the integrated wave rather than each ticket alone is deliberate: it sees how parallel tickets compose.
5. **Confident fixes**: a single fix agent serially applies only **confident standards fixes** — documented-standard hard violations whose fix the reviewer states outright — testing after each. This is deliberately lighter than `/two-axis-review`'s mechanical tier: no proposer/validator pipeline mid-run. Everything else the wave review surfaces — judgement calls, repo-wide patterns, spec divergences — is **deferred to the closing `/two-axis-review`**; the one exception is a divergence where the *spec* may be wrong, which is a spec gap: comment it on the spec issue now.
6. **Wave summary**: one comment on the spec issue — tickets landed, tickets parked, fixes applied, findings deferred.

A parked ticket doesn't stop the run unless it blocks everything — later waves exclude tickets whose blockers didn't land, and the run continues around them.

### 3. Monitor and hand off

While the workflow runs, relay its progress; touch nothing. When it completes, run the full test suite once more and report per ticket: commits, wave-review fixes applied, findings deferred, parked tickets and why. Then point the user at the next step: `/two-axis-review <base>` with the spec issue as the Spec source, in a fresh session (`/next` routes there). The closing review picks up everything the wave reviews deferred and runs the ship ↔ review loop until a round comes back clean — and then the PR whose body `Closes #<spec>` ties the branch to the whole tree.
