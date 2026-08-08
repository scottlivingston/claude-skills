# claude-skills

An opinionated, end-to-end workflow for Claude Code: take a loose idea, chart the unknowns as decision tickets on your issue tracker, resolve them with the right skill for each kind of question, cross-read the finished map for coherence, distill the decisions into a spec, break the spec into implementation tickets, ship them with parallel agents, review on two axes — and loop ship ↔ review until a round comes back clean.

Packaged as a Claude Code plugin (`scott-skills`).

## The workflow

A loose idea goes in; a PR that closes its spec comes out.

### 1. Chart the map — `/wayfinder`

Everything starts by naming a **destination** — the spec, decision, or change the effort is finding its way to. Wayfinder grills you to pin it down, then charts the way as a **map**: an issue on the repo's tracker whose child issues are **decision tickets**, wired with the tracker's native blocking links. The map is deliberately incomplete — a question becomes a ticket only when it can be *stated* precisely; everything dimmer waits in a "Not yet specified" section (the fog of war) and graduates into tickets as resolutions clear it. Anything past the destination is ruled out of scope explicitly.

### 2. Resolve the tickets — one kind of question, one skill

Every ticket carries a type and a mode — **HITL** (worked live with the human) or **AFK** (an agent works it alone). Each type is powered by a dedicated skill:

| Ticket type | Mode | Powered by | Resolves |
| --- | --- | --- | --- |
| **Grilling** | HITL | `/grilling` + `/domain-modeling` | The default: a round-by-round interview over the design tree that turns "what should it do?" into recorded decisions |
| **Design** | HITL | `/design` | The shape of code before it's built — module boundaries, interfaces, data shapes, the seams tests will live at |
| **Prototype** | HITL | `/prototype` | "How should it look / behave?" — cheap throwaway code or artifacts to react to |
| **Research** | AFK | `/research` | Questions answerable from documentation and primary sources; lands as a cited markdown file |
| **Task** | either | — | Manual work that must happen before a decision *can* be made (provision access, move data) |

Two supports run through all of this:

- **`/drain`** works the AFK frontier in parallel background agents while you sit only in the HITL conversations. Human time goes only where a human is needed.
- **`/domain-expansion`** turns any question that lands on unfamiliar terrain into a plain-language briefing on what the system does today — capabilities and concepts in the project's own vocabulary, with the code itself one ask away.

Each session resolves **one ticket**: the answer is recorded on the ticket, the ticket is closed, newly visible questions become new tickets, and fog that just became specifiable graduates. The map is complete when no tickets remain and the fog is empty — every implementation-relevant decision is recorded.

### 3. Review the map — `/map-review`

A complete map is a mechanical fact — frontier empty, fog gone — not a semantic one: its decisions were made in separate sessions, and no single context ever held all the resolutions at once. Before the spec is written, one session reads **every resolution in full, together**, hunting only what no per-ticket session could see: contradictions, early calls superseded by later context, gaps where the decisions don't compose into a clear route, undecided seams, scope leaks, and drifted index gists. Mechanical fixes are applied silently; real tensions are adjudicated with you one at a time, and fixes land as edits to the map and its tickets — never a separate artifact. A coherent map is marked `map-reviewed`; reopened decisions send the effort back to charting. It never re-litigates a settled decision's merits — cheap by default is what keeps it run rather than skipped.

### 4. Distill the spec — `/to-spec`

The completed map — its decision index and closed tickets — is synthesized into a single **spec issue**. No interview, no new decisions: to-spec only writes down what the map already settled. Design-ticket resolutions carry their interface stubs and seams into the spec, so implementation inherits agreed contracts and a Seams-under-test list.

### 5. Break it down — `/to-tickets`

The spec is broken into **implementation tickets** — vertical tracer-bullet slices, each sized to one fresh agent session, with blocking edges forming a DAG. This is an explicit approval gate: you review and approve the breakdown in a quiz before anything is built. After this gate, downstream stages make no product decisions.

### 6. Ship — `/ship`

One dynamic workflow implements the ticket DAG: a fresh agent per frontier ticket in an isolated git worktree, worktrees merged serially with tests after each merge, and a review pass over each wave's integrated diff. Never merge on red. When an agent hits a decision the spec doesn't hold, it parks the ticket and reports the gap on the spec issue — the run continues around it, and the gap comes back to you. (`/implement` is the manual alternative: one frontier ticket at a time, same discipline.)

### 7. Review — `/review`

The branch is reviewed along two axes that are never merged into one list: **Standards** (does the code follow the repo's documented conventions — canonically `CONVENTIONS.md`, with per-directory files scoping a monorepo's apps — plus a fixed code-smell baseline?) and **Spec** (does it do what the spec asked?). Every finding is labeled and carries a validated fix proposal. Mechanical validated fixes are auto-applied (one revertable commit each); the rest are walked past you one at a time — one finding, one verdict (**fix** / **ticket** / **later** / **skip**), next.

### 8. Loop until clean

`ticket` verdicts become implementation tickets that feed the next `/ship` round; `later` parks out-of-scope patterns as standalone cleanup tickets; every verdict — including skips — is recorded on the spec so no finding is ever re-litigated. Ship and review alternate until a review round comes back clean, then the PR that closes the spec issue is offered. The loop converges by construction: the set of unaddressed findings only shrinks.

## Driving it: `/next`

You don't memorize the chain. Start an effort with `/wayfinder <idea>`; after that, invoke **`/next`** each session. Because all state lives on the tracker, `/next` queries where the effort stands, announces the stage, and runs that stage's skill — exactly one unit of work per invocation, then it stops and says `/next` again. While the map is live it also drains the AFK frontier in the background while you sit in a HITL ticket, and it folds in any results a previous session didn't.

You can also enter partway: `/to-spec` with no argument specs the current conversation, `/to-tickets` can break down any plan, and `/review` reviews any branch or diff since a fixed point.

## The opinions

**The tracker is the memory, not the chat.** A big effort outlives any one context window, so all durable state — the map, decisions, the spec, tickets, blocking edges, claims — lives on the issue tracker. Any session (or any teammate) can pick up from the tracker alone; conversations are disposable. Claims are just an `in-progress` label, so concurrent sessions don't collide, and blocking uses the tracker's native dependency links so the frontier is visible in the tracker's own UI.

**Planning produces decisions, never deliverables.** Wayfinder tickets resolve *decisions*; implementation tickets never belong on a map. When resolving a question surfaces "now build X", that's the fog clearing — record the decision that makes X buildable and leave the building to `/ship`. The pull to just start coding is treated as the signal that planning is done.

**Don't chart what you can't see.** A question becomes a ticket only when it can be *stated* precisely (not answered — stated); everything dimmer stays in the fog and graduates as resolutions sharpen it. Scope is fixed by naming the destination first, and anything beyond it is ruled out of scope explicitly rather than left ambient.

**Everything is sized to a context window.** Each ticket — planning or implementation — is sized to one fresh agent session. Wayfinder resolves at most one ticket per invocation; ship never gives two tickets to one agent. Fresh context per unit of work is the point, not an inconvenience.

**Human time goes only where a human is needed.** Every planning ticket is typed HITL or AFK. `/drain` runs the AFK frontier in parallel background agents while the human sits only in the live conversations — and an agent must never stand in for the human's side of a HITL ticket. A grilling agent that answers its own questions has broken the workflow.

**HITL questions speak the domain language.** A human engages with capabilities and concepts — the project's ubiquitous language (`CONTEXT.md`) — not with file paths; prose dense with code references pushes them out of the decision instead of into it. Reading the code is the agent's job; the human gets the digest. When a question lands on terrain they don't hold a model of, `/domain-expansion` briefs them in plain language on what the system does today, and when they ask to see the source, it arrives as verified, cmd-clickable `path:line` references — links into the editor, never pasted snippets (the `code-anchors` skill holds the citation format).

**Approval gates are explicit, and downstream stages don't improvise.** The human approves the implementation breakdown in the `/to-tickets` quiz; after that, `/ship` makes no product decisions. When an agent hits a decision the spec doesn't hold, it parks the ticket and reports the gap rather than guessing.

**Implementation is vertical slices, in parallel, merged serially.** Tickets are tracer bullets — narrow but complete paths through every layer, demoable alone — not horizontal layers. (Wide mechanical refactors are the one exception, sequenced as expand–contract.) Fresh agent per ticket in an isolated worktree, one merge at a time, tests after each merge. Never merge on red.

**Review runs on two axes that are never merged.** Standards and Spec are reviewed by separate sub-agents and reported side by side — code can pass one axis and fail the other, and a single ranked list lets one axis mask the other. Every verdict is recorded on the spec, so the ship ↔ review loop never re-asks a settled finding.

**Standards live in `CONVENTIONS.md`, and the loop sharpens it.** Reviewable coding standards get one canonical home — `CONVENTIONS.md` at the repo root, with per-directory files as deltas in monorepos, nearest scope winning (the `conventions` skill holds the convention; repos without one fall back to whatever standards docs exist). `later` verdicts append their rediscovered rule there, so judgement calls the review keeps re-finding become documented standards the next round enforces — the standards doc gets sharper every lap. `CLAUDE.md` points at it, never duplicates it.

**Tests live at pre-agreed seams.** `/tdd` is red–green at seams agreed up front — with the user live, or inherited from the spec's Seams-under-test list (fed by design tickets) when agents run AFK — behavior over implementation details, one test → one implementation, never a bulk test suite written ahead of the code.

## The assumptions

What must be true of your project and working style for this workflow to fit:

- **You have an issue tracker with labels, sub-issues, and blocking links.** GitHub issues by default (via `gh`); a local-markdown fallback exists for repos without a remote. The `issue-tracker` skill defines the tracker contract every skill speaks; a repo can swap in its own tracker with a `.claude/issue-tracker.md` implementing that contract — fully, or as a delta over the default ("as GitHub, except…").
- **The effort is bigger than one context window.** That's what the map is for. If charting surfaces no fog — the whole journey fits one session — wayfinder tells you to skip the map and just do the work.
- **A human is actually available.** Grilling, prototypes, design decisions, the to-tickets approval quiz, spec-gap resolutions, and review verdicts are all HITL by design. This workflow reduces where human attention goes; it does not remove it.
- **You work in a git repo with a test suite you trust.** Ship implements in isolated worktrees and gates every serial merge on green tests; without meaningful tests, "never merge on red" protects nothing.
- **Sessions are disposable; only the tracker is durable.** Anything worth keeping must land on an issue before context clears. The flip side: any session — yours, a teammate's, a background agent's — can pick up the effort cold.
- **Concurrency is normal.** Background drain agents and parallel sessions edit the tracker at the same time; claims (`in-progress`), a single map-writer per session, and reconcile-before-routing in `/next` are what keep them from colliding.

## Standalone skills

Used by the chain, and useful on their own:

- **grilling** — relentless round-by-round interview over the design tree to stress-test a plan; facts get looked up, decisions get asked
- **wait-what** — stop and re-pitch the last message in plain language, using the project's ubiquitous vocabulary
- **domain-expansion** — a plain-language briefing on the system behaviour behind the current question, in the project's ubiquitous language; for when a question lands on unfamiliar terrain
- **domain-modeling** — build and sharpen the project's domain model (`CONTEXT.md`, ADRs)
- **design** — decide the shape of code before it's built — module boundaries, interfaces, data shapes, and the seams tests will live at — captured as contract snippets that flow into the spec
- **codebase-design** — shared vocabulary for deep modules: module, interface, depth, seam, adapter, leverage, locality
- **prototype** — throwaway code that answers a design question (a shareable single-file HTML logic demo, or switchable UI variants)
- **wizard** — generate an interactive bash wizard that walks a human through steps only they can perform (credentials, provisioning, cutovers)
- **research** — background-agent research against primary sources, captured as a cited markdown file in the repo
- **tdd** — the red–green loop, seams, mocking guidance, and test anti-patterns
- **writing-for-agents** — reference for writing documents agents consume: skills, `AGENTS.md`/`CLAUDE.md`, and the docs they point at
- **review** — review any branch, PR, or diff since a fixed point; works outside the chain with any issue as the Spec source

## Install

```
claude plugin marketplace add scottlivingston/claude-skills
claude plugin install scott-skills@claude-skills
```

Update after pushing changes:

```
claude plugin marketplace update claude-skills
```
