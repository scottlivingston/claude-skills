---
name: tickets
description: Break a plan, spec, or the current conversation into a set of tracer-bullet tickets, each declaring its blocking edges, published to the configured tracker — edges as text in one file per ticket locally, or native blocking links on a real tracker. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

# To Tickets

Break a plan, spec, or conversation into a set of **tickets** — tracer-bullet vertical slices, each declaring the tickets that **block** it.

For the issue tracker and triage vocabulary, invoke `/issue-tracker`.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes a reference (a spec path, an issue number or URL) as an argument, fetch it and read its full body and comments. For a spec, "full" includes its addressable decisions (`D1`…`Dn`, per the tracker doc's spec-decision convention) — the Decision Index in the body lists them.

A spec should also carry the `spec-reviewed` marker — `/spec-review`'s full read and codebase grounding; if it's absent, flag that the review hasn't run and let the user choose: review first, or break down anyway.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Ticket titles and descriptions should use the project's domain glossary vocabulary, and respect the architecture decision records (ADRs) in the area you're touching — glossary and ADRs both per `/domain-modeling`.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the work into **tracer bullet** tickets.

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests) — vertical, NOT a horizontal slice of one layer
- A completed slice is demoable or verifiable on its own
- Each slice is sized to fit in a single fresh context window
- Any prefactoring should be done first
- Slices after the skeleton hang off it as INDEPENDENT capabilities, not increments of one growing demo — "add X to what we had" chains; "X, standalone, atop the skeleton" parallelizes

</vertical-slice-rules>

Give each ticket its **blocking edges** — the other tickets that must complete before it can start. A ticket with no blockers can start immediately. The default is **no edge**; every edge must pass this test:

<edge-test>

Add an edge A → B only when B cannot land green without code A delivers — B's acceptance criteria are impossible to pass until A is done. These are NOT edges:

- Touching the same files (merge-conflict risk is not a blocker)
- Coming later in the narrative ("first we build X, then Y" is story order, not a dependency)
- Sharing a layer or theme

When B needs only A's **interface**, not its implementation, pull the contract (types, stubs, schema) into the skeleton ticket so B can start against the stub — don't chain B behind A.

</edge-test>

**Cut for the wave structure.** The DAG's shape is what `/ship` executes: wave 1 is every ticket with no blockers, wave 2 everything unblocked once wave 1 lands, and so on. Two properties make a breakdown fast, and they pull against each other — optimize both while drafting:

- **Shallow** — every edge cut per the edge test flattens the DAG by one; a chain is a queue of idle agents.
- **Disjoint files** — same-wave tickets run as parallel agents whose branches merge serially; two of them reshaping the same files means conflict agents and re-tests on the critical path. Note the files each ticket expects to touch and cut slices so dependency-free tickets touch different ones, preferring cuts that follow file boundaries. Those notes are for the critic below only, never published ticket content.

File overlap is still never an edge — the fix for two same-wave tickets touching the same files is a different cut, not a fake dependency.

**Route the spec's decisions.** When the source is a spec with a Decision Index, each ticket **cites the decision IDs it implements**, so its implementer gets only the decisions it needs. Route while drafting, then check **coverage**: every decision must be cited by at least one ticket. An orphaned decision is a finding for the quiz, never something to silently absorb — it means either a missing ticket or a decision that decided nothing.

**Wide mechanical refactors** no slice can land green (rename a column, retype a shared symbol): expand, migrate in batches, contract — each batch its own ticket. When even the batches can't stay green alone, let them share an integration branch that blocks a final integrate-and-verify ticket.

### 4. The DAG critic

Before any human sees the breakdown, one **adversarial critic agent** — fresh, not the author, on the decider tier per `/model-policy` — scores the DAG against the two properties from step 3. Give it the tickets with their edges and expected files, the edge test, and repo access; it must:

- **Compute the wave structure** and challenge the depth: every edge re-tested against the edge test; a chain of width-1 waves is a finding to justify, not a default (hub-and-spoke — one skeleton ticket blocking many independent slices — is healthy; a chain usually means fake edges, or one incremental storyline that should re-slice along independent capabilities).
- **Verify the expected files** — grep and list the actual files each ticket will touch, don't take the author's word — and flag every same-wave pair that overlaps.
- Return a typed verdict: **pass**, or **re-cut demanded**, naming the specific edges to drop and slices to re-cut.

A demanded re-cut gets exactly **one** revision, re-scored by the critic. A second failure is a real finding, not a lap to repeat: present it to the user (in the quiz, or as the gate question under `/next auto`) with the critic's diagnosis — the work may genuinely be a chain.

### 5. Quiz the user

**Under `/next auto`, this quiz is skipped**: a critic-passed breakdown is auto-approved and publishing proceeds. What would have been quiz findings — decisions no ticket cites, a second critic failure — post as `<!-- tickets pending-questions -->` on the spec instead, per `/finding-pipeline`'s gate (notify, end the turn; a matching `<!-- tickets summary -->` records the verdicts). Manual invocations run the quiz below.

Present the proposed breakdown **as plain markdown text in your reply** — a numbered list, followed by the wave structure so the user can see the parallelism at a glance. For each ticket, show:

- **Title**: short descriptive name
- **Blocked by**: which other tickets (if any) must complete first
- **What it delivers**: the end-to-end behaviour this ticket makes work
- **Decisions**: the decision IDs this ticket cites (spec sources only)
- **Where it lands**: the module or subsystem this slice touches, named in the project's own vocabulary — one plain phrase, so the user can judge the breakdown at the concept level. Code references (`path:line`) on request. (The published tickets still avoid file paths, per the note below.)

For a spec source, follow the wave structure with the **coverage check's result**: any decision no ticket cites, listed by ID — each is either a missing ticket or a dead decision, the user's call.

Only after the full breakdown is on screen as message text, ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the blocking edges correct — does each ticket only depend on tickets that genuinely gate it?
- Is the decision routing right — each ticket citing the decisions it genuinely needs, and what should happen to any orphaned decision?
- Should any tickets be merged or split further?

Load `/hitl-questions` and ask per it.

Iterate until the user approves the breakdown.

### 6. Publish the tickets to the configured tracker

Publish the approved tickets. **How** depends on the configured tracker (see `/issue-tracker`) — the tickets are the same either way, only the shape of the blocking edges changes:

- **Local files** → write one file per ticket under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency order (blockers first). Each file's "Blocked by" lists the numbers/titles it depends on. Use the per-ticket file template below — one ticket per file, never a single combined file.
- **A real issue tracker (GitHub, Linear, …)** → publish one issue per ticket in dependency order (blockers first) so each ticket's blocking edges can reference real identifiers. When the source is a spec issue, make each ticket a **child of the spec** (the tracker doc's parent/child operation), so the spec issue is the single parent the eventual PR closes. Use the platform's native blocking relationship for edges between tickets; otherwise set each ticket's "Blocked by" to the blocking issues. Apply the `impl` label plus the `ready-for-agent` triage label unless instructed otherwise — the tickets are agent-grabbable by construction. (If the markers don't exist yet, run the tracker doc's bootstrap first.)

Work the **frontier**: any ticket whose blockers are all done. For a purely linear chain that means top to bottom.

Do NOT close or modify any parent issue.

<local-ticket-template>

# <NN> — <Ticket title>

**What to build:** the end-to-end behaviour this ticket makes work, from the user's perspective — not a layer-by-layer implementation list.

**Decisions:** the spec decision IDs this ticket implements (`D3, D7`), or omit when the source has no Decision Index.

**Blocked by:** the numbers/titles of the tickets that gate this one, or "None — can start immediately".

**Status:** ready-for-agent

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2

</local-ticket-template>

<issue-template>

## Parent

A reference to the parent issue on the tracker (if the source was an existing issue, otherwise omit this section).

## What to build

The end-to-end behaviour this ticket makes work, from the user's perspective — not layer-by-layer implementation.

## Decisions

The spec decision IDs this ticket implements (`D3, D7`) — omit this section when the source has no Decision Index.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Blocked by

- A reference to each blocking ticket, or "None — can start immediately".

</issue-template>

In either form, tickets don't duplicate what the spec already holds: when the source spec has addressable decisions, a ticket **cites decision IDs rather than copying their snippets**, since a copy could only drift. Tickets from a plan or conversation (no addressable decisions) still carry **decision-encoding snippets** as first-class content: a state machine, reducer, schema, type shape, or API contract — especially one a prototype or design ticket validated — inlined, trimmed to the decision-rich parts with its origin noted, part of what review validates the implementation against. Either way, what tickets avoid is *speculative* implementation code — sketches of how to build things no decision has settled — and specific file paths or line numbers, which go stale fast. (Review-finding tickets published by `/diff-review` are the one exception on paths: a finding is about existing code, so it anchors by file + quoted snippet.)

End by pointing the user at the next step: `/ship <spec>` drives the whole DAG — parallel fresh agents per ticket, reviewed and merged wave by wave. The manual alternative is `/implement`, one frontier ticket at a time, clearing context between tickets.
