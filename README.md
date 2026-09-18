# claude-skills

An opinionated, end-to-end workflow for Claude Code: take a loose idea, chart the unknowns as decision tickets on your issue tracker, resolve them with the right skill for each kind of question, partition the decisions into shippable slices as the delivery order becomes clear, then take each slice on its own schedule — cross-read for coherence, distil into a spec, review that spec against the code, break it into implementation tickets, and ship them wave by wave with parallel agents, every wave verified on two axes and only intent questions escalated to you — until a closing pass comes back clean.

Packaged as a Claude Code plugin (`scott-skills`).

## The workflow

A loose idea goes in; a PR that closes its spec comes out.

### 1. Chart the map — `/wayfinder`

Everything starts by naming a **destination** — the spec, decision, or change the effort is finding its way to. Wayfinder grills you to pin it down, then charts the way as a **map**: an issue on the repo's tracker whose child issues are **decision tickets**, wired with the tracker's native blocking links. The map is deliberately incomplete — a question becomes a ticket only when it can be *stated* precisely; everything dimmer waits in a "Not yet specified" section (the fog of war) and graduates into tickets as resolutions clear it. Anything past the destination is ruled out of scope explicitly.

### 2. Resolve the tickets — one kind of question, one skill

Every ticket carries a type and a mode — **HITL** (worked live with the human) or **AFK** (an agent works it alone). Each type is powered by a dedicated skill:

| Ticket type | Mode | Powered by | Resolves |
| --- | --- | --- | --- |
| **Grilling** | HITL | `/grilling` + `/domain-modeling` | The default: you say how you picture it, then one decision at a time gets argued out until "what should it do?" is recorded decisions |
| **Design** | HITL | `/design` | The shape of code before it's built — module boundaries, interfaces, data shapes, the seams tests will live at |
| **Prototype** | HITL | `/prototype` | "How should it look / behave?" — cheap throwaway code or artifacts to react to |
| **Research** | AFK | `/research` | Questions answerable from documentation and primary sources; lands as a cited markdown file |
| **Task** | either | — | Manual work that must happen before a decision *can* be made (provision access, move data) |

One support runs through all of this: **`/drain`** works the AFK frontier in parallel background agents while you sit only in the HITL conversations. Human time goes only where a human is needed.

Each session resolves **one ticket**: the answer is recorded on the ticket, the ticket is closed, newly visible questions become new tickets, fog that just became specifiable graduates, and the resolution is filed into the slice it will ship in (next section). The map is complete when no tickets remain, the fog is empty, and every decision is filed — every implementation-relevant decision recorded, and its place in the delivery order known.

### 3. Slice the map — the delivery partition

A map's decisions are ordered by what you had to *learn*; implementation is ordered by what *ships together*, and those two orders rarely coincide. So the map partitions its own decisions into **slices** — each a demoable outcome that becomes its own spec, its own tickets, its own ship run. A slice is a child issue of the map (labelled `wayfinder:slice`, never a ticket) whose body lists only *links* to the decisions it claims; the gists stay on the map and the resolutions stay on their tickets, so nothing here can go stale. Blocking edges between slices carry the ship order, and the resolutions that bind everything — error model, vocabulary, cross-cutting contracts — go to a **Map-wide decisions** bucket every slice's spec kernel inherits.

Slices are **fog-shaped**: you chart one only when you can state what it ships and what it needs first, which is usually well after charting starts, because ship order shows up in the resolutions ("the read path can land before the schema change") and never in the question order. Until then the decisions it will claim sit unfiled, which is normal, not a gap.

A **sealed** slice is one declared safe to spec while the rest of the map is still foggy — closing the slice issue is the seal, and it is what lets shipping start before charting finishes. Sealing is never derived: fog is prose, and no query proves a fog patch can't land in a slice, so when a resolution closes a slice's last ticket the session drafts the case — what the slice ships, and why none of the remaining fog lands in it — and the human gives the verdict. A sealed slice that is later **breached** by a new decision reopens if it hasn't shipped, and takes a follow-up ticket against its spec if it has. Small efforts skip all of this: an unsliced map completes as one unit and specs as one spec.

### 4. Review the map — `/map-review`

A complete map is a mechanical fact — frontier empty, fog gone — not a semantic one: its decisions were made in separate sessions, and no single context ever held all the resolutions at once. Before a spec is written, one session reads **every resolution in full, together**, hunting only what no per-ticket session could see: contradictions, early calls superseded by later context, gaps where the decisions don't compose into a clear route, undecided seams, misfilings, scope leaks, and drifted index gists. It runs at two altitudes: on each **sealed slice** just before that slice becomes a spec (the gate that actually protects a spec, marking it `slice-reviewed`), and once on the **whole map** when charting finishes — the only read that ever holds every slice at once, and so the only one that can catch two slices deciding the same question differently. By then some slices have shipped, so the whole-map pass's findings land as amendments and follow-up tickets rather than repairs; that is the price of shipping early, paid knowingly at the seal. Findings run the shared finding pipeline (`finding-pipeline`): adversarially validated, provably derivable repairs auto-applied to the map under an audit digest, and only genuine tensions escalated — durably, at a gate you can answer now or in a later session — with fixes landing as edits to the map and its tickets, never a separate artifact. A coherent slice or map is marked `slice-reviewed` or `map-reviewed`; reopened decisions send the effort back to charting, and reopening a ticket a slice claims unseals that slice. It never re-litigates a settled decision's merits — cheap by default is what keeps it run rather than skipped.

### 5. Distill the spec — `/specify`

A sealed slice — the decisions it claims, plus the map-wide ones — is synthesized into a **spec issue**. No interview, no new decisions: `/specify` only writes down what the map already settled, and the slice is what bounds which decisions reach this spec at all. (An unsliced map specs whole, as one issue.) The map stays open until its last slice has a spec, so later slices are specced *after* earlier ones ship, against a codebase that has moved. Design-ticket resolutions carry their interface stubs and seams into the spec, so implementation inherits agreed contracts and a Seams-under-test list.

### 6. Review the spec — `/spec-review`

The spec is the last artifact before code, and everything downstream trusts it absolutely: `/tickets` routes its decisions without questioning them, and a `/ship` agent handed a decision that doesn't decide will invent the missing half. One session reads the spec **whole** — kernel plus every decision — and **grounds it against the codebase it claims to describe**, which is the check no other stage performs: decisions that name a question without settling it, claims about modules and prior art that stopped being true, behaviour no listed seam can observe, acceptance criteria no test can pass or fail, stories nothing serves and decisions nothing needs, contradictions and scope leaks. Findings run the same finding pipeline: derivable repairs (drift, stale links, disproven claims about the code, a body paragraph the spec's own decisions already settle) auto-apply under an audit digest. Stale counts and figures are derivable too — recounted against the tree and propagated through every figure and sentence that quoted them — because asking which of two numbers is authoritative when one of them is the code spends you on work the pipeline had already done. Every escalated defect arrives at a durable gate with a **drafted repair** — the amended line, the missing seam row — so you give a verdict on concrete text rather than answer an open question. Fixes are edits to the spec itself, never a review document, and a clean spec is marked `spec-reviewed`. It matters most for the specs that skipped the map entirely: on those, no gate has run at all.

### 7. Break it down — `/tickets`

The spec is broken into **implementation tickets** — vertical tracer-bullet slices, each sized to one fresh agent session, with blocking edges forming a DAG cut for parallelism: shallow waves, and same-wave tickets claiming disjoint file territories so parallel agents don't collide at merge time. An adversarial **DAG critic** re-tests every edge and greps the territory claims before any human sees the breakdown. Then the approval gate: you review the breakdown in a quiz (under `/next auto`, a critic-passed breakdown is auto-approved instead). After this gate, downstream stages make no product decisions.

### 8. Ship — `/ship`

Each **wave** of unblocked tickets runs as one dynamic workflow: a planner per ticket maps the approach against the branch as it stands, a fresh agent per ticket implements in an isolated git worktree, worktrees merge serially with the change's scoped tests after each merge (never merge on red), and the wave's integrated diff is verified along two axes that are never merged into one list — **Spec** (did the tickets deliver their acceptance criteria?) and **Standards** (does the code break a documented rule — canonically `CONVENTIONS.md`, with per-directory files scoping a monorepo's apps?). Findings are adversarially validated; survivors with uncontested fixes auto-apply (one revertable commit each) or become tickets riding the next wave. Only questions about *intent* reach you — the spec is silent on a case, two fixes compete, a pattern is repo-wide — put one at a time in domain language as a position you accept or push back on, the way a coworker would put it, and an unanswered spec question gates the next wave. When an agent hits a decision the spec doesn't hold, it parks the ticket and reports the gap on the spec issue; the run continues around it. (`/implement` is the manual alternative: one frontier ticket at a time, same discipline.)

### 9. Close the run

When no tickets remain, a closing pass re-reads the **whole branch diff** — hunting the cross-wave composition drift no single wave could see, checking every spec requirement landed somewhere — and raises everything deferred along the way. Answers and remaining findings become tickets that re-open the frontier, so shipping loops until a closing pass comes back clean; every outcome is recorded on the spec issue as adjudication memory, so no finding is ever re-litigated and the loop converges. Then the PR that closes the spec issue is offered. (`/diff-review` is the standalone review for any branch, PR, or diff outside the run — the same two axes and auto-resolve routing, plus the full Fowler smell baseline on its Standards axis.)

## Driving it: `/next`

You don't memorize the chain. Start an effort with `/wayfinder <idea>`; after that, invoke **`/next`** each session. Because all state lives on the tracker, `/next` queries where the effort stands, announces the stage, and runs that stage's skill — exactly one unit of work per invocation, then it stops and says `/next` again. While the map is live it also drains the AFK frontier in the background while you sit in a HITL ticket, and it folds in any results a previous session didn't.

**`/next auto <effort> [merge]`** conducts instead: from the first sealed slice onward it rolls map-review → spec → spec-review → tickets → ship → closing end to end — one slice at a time, in ship order — pausing only where a gate genuinely needs you — every pause posted durably to the tracker and push-notified, answerable in that session or any later one. The conductor delegates all heavy lifting (workflow fills, synthesis stages) to fresh subagents and holds only routing state, so one session can conduct an arbitrarily long run. Include the word `merge` and a clean closing pass ends with the PR squash-merged; without it, the run ends by offering the PR. A clean effort goes from sealed slice to merged spec with a handful of batched questions.

You can also enter partway: `/specify` with no argument specs the current conversation — and `/spec-review` is what catches the defects that skipping the map would otherwise leave in it. `/tickets` can break down any plan, and `/diff-review` reviews any branch or diff since a fixed point.

## The opinions

**The tracker is the memory, not the chat.** A big effort outlives any one context window, so all durable state — the map, decisions, the spec, tickets, blocking edges, claims — lives on the issue tracker. Any session (or any teammate) can pick up from the tracker alone; conversations are disposable. Claims are just an `in-progress` label, so concurrent sessions don't collide, and blocking uses the tracker's native dependency links so the frontier is visible in the tracker's own UI.

**Planning produces decisions, never deliverables.** Wayfinder tickets resolve *decisions*; implementation tickets never belong on a map. When resolving a question surfaces "now build X", that's the fog clearing — record the decision that makes X buildable and leave the building to `/ship`. The pull to just start coding is treated as the signal that planning is done.

**Don't chart what you can't see.** A question becomes a ticket only when it can be *stated* precisely (not answered — stated); everything dimmer stays in the fog and graduates as resolutions sharpen it. Scope is fixed by naming the destination first, and anything beyond it is ruled out of scope explicitly rather than left ambient.

**The map is high-level; the specs are not the map.** A map is organized by what you had to learn, a spec by what ships together, and forcing one map into one spec is what makes specs too big to hold and shaped like the investigation rather than the rollout. Slices are the seam between the two altitudes: the map partitions itself into shippable outcomes as the delivery order becomes visible in the resolutions, and each slice specs, breaks down, and ships on its own schedule. Sealing a slice is always the human's call — no query can prove the remaining fog won't land in it.

**Everything is sized to a context window.** Each ticket — planning or implementation — is sized to one fresh agent session. Wayfinder resolves at most one ticket per invocation; ship never gives two tickets to one agent. Fresh context per unit of work is the point, not an inconvenience.

**Human time goes only where a human is needed.** Every planning ticket is typed HITL or AFK. `/drain` runs the AFK frontier in parallel background agents while the human sits only in the live conversations — and an agent must never stand in for the human's side of a HITL ticket. A grilling agent that answers its own questions has broken the workflow.

**HITL questions speak the domain language.** A human engages with capabilities and concepts — the project's ubiquitous language (`CONTEXT.md`) — not with file paths; prose dense with code references pushes them out of the decision instead of into it. Reading the code is the agent's job; the human gets the digest. When they ask to see the source, it arrives as verified `path:line` references they can open in their editor.

**Approval gates are explicit, and downstream stages don't improvise.** The human approves the implementation breakdown — in the `/tickets` quiz, or by delegating that approval to the DAG critic when `/next auto` conducts; after that, `/ship` makes no product decisions. When an agent hits a decision the spec doesn't hold, it parks the ticket and reports the gap rather than guessing.

**Implementation is vertical slices, in parallel, merged serially.** Tickets are tracer bullets — narrow but complete paths through every layer, demoable alone — not horizontal layers. (Wide mechanical refactors are the one exception, sequenced as expand–contract.) Fresh agent per ticket in an isolated worktree, one merge at a time, tests after each merge. Never merge on red.

**Review runs on two axes that are never merged.** Standards and Spec are reviewed by separate sub-agents and reported side by side — code can pass one axis and fail the other, and a single ranked list lets one axis mask the other. Every outcome is recorded on the spec as adjudication memory, so no finding is re-asked across waves or review rounds.

**Standards live in `CONVENTIONS.md`, and the loop sharpens it.** Reviewable coding standards get one canonical home — `CONVENTIONS.md` at the repo root, with per-directory files as deltas in monorepos, nearest scope winning (the `conventions` skill holds the convention; repos without one fall back to whatever standards docs exist). Adopted pervasive-pattern findings append their rediscovered rule there, so judgement calls review keeps re-finding become documented standards the next round enforces — the standards doc gets sharper every lap. `CLAUDE.md` points at it, never duplicates it.

**Tests live at pre-agreed seams.** `/tdd` is red–green at seams agreed up front — with the user live, or inherited from the spec's Seams-under-test list (fed by design tickets) when agents run AFK — behavior over implementation details, one test → one implementation, never a bulk test suite written ahead of the code.

## The assumptions

What must be true of your project and working style for this workflow to fit:

- **You have an issue tracker with labels, sub-issues, and blocking links.** GitHub issues by default (via `gh`); a local-markdown fallback exists for repos without a remote. The `issue-tracker` skill defines the tracker contract every skill speaks; a repo can swap in its own tracker with a `.claude/issue-tracker.md` implementing that contract — fully, or as a delta over the default ("as GitHub, except…").
- **The effort is bigger than one context window.** That's what the map is for. If charting surfaces no fog — the whole journey fits one session — wayfinder tells you to skip the map and just do the work.
- **A human is actually available.** Grilling, prototypes, design decisions, spec-gap resolutions, and gate verdicts are all HITL by design — `/next auto` batches them at durable gates rather than removing them. This workflow reduces where human attention goes; it does not remove it.
- **You work in a git repo with a test suite you trust.** Ship implements in isolated worktrees and gates every serial merge on green tests; without meaningful tests, "never merge on red" protects nothing. A `TESTING.md` (the `testing` skill holds the convention) tells agents which slice of the suite a change has to pass, so a wave runs its crates' tests, not the world's.
- **Fan-outs never inherit the session's model by accident.** Every spawned agent runs on a tier — executors (implementers, merges, fixes, mechanics) default to Sonnet; deciders (reviewers, validators, planners, drain and research agents) and auditors (the few run-once reads whose misses nothing catches: labeling, the spec grounding read, the map cross-read, the closing pass) default to the session's model unless a policy file pins them. Put `decider: opus` and `auditor: fable` in `~/.claude/model-policy.md` and a session on any model reviews on Opus and audits on Fable.
- **Sessions are disposable; only the tracker is durable.** Anything worth keeping must land on an issue before context clears. The flip side: any session — yours, a teammate's, a background agent's — can pick up the effort cold.
- **Concurrency is normal.** Background drain agents and parallel sessions edit the tracker at the same time; claims (`in-progress`), a single map-writer per session, and reconcile-before-routing in `/next` are what keep them from colliding.

## Standalone skills

Used by the chain, and useful on their own:

- **grilling** — you lay out your picture first, then it holds a position on one decision at a time until the design holds; facts get looked up, never asked
- **wait-what** — stop and re-pitch the last message in plain language, using the project's ubiquitous language
- **domain-modeling** — build and sharpen the project's domain model (`CONTEXT.md`, ADRs)
- **design** — decide the shape of code before it's built — module boundaries, interfaces, data shapes, and the seams tests will live at — captured as contract snippets that flow into the spec
- **codebase-design** — shared vocabulary for deep modules: module, interface, depth, seam, adapter, leverage, locality
- **prototype** — throwaway code that answers a design question (a shareable single-file HTML logic demo, or switchable UI variants)
- **wizard** — generate an interactive bash wizard that walks a human through steps only they can perform (credentials, provisioning, cutovers)
- **research** — background-agent research against primary sources, captured as a cited markdown file in the repo
- **tdd** — the red–green loop, seams, mocking guidance, and test anti-patterns
- **writing-for-agents** — reference for writing documents agents consume: skills, `AGENTS.md`/`CLAUDE.md`, and the docs they point at
- **cold-read** — repair a document many agent sessions have edited so it reads to someone holding only the doc and what it points at: ghosts, broken pointers, changelog prose, aliases, undefined terms, residue, stale caches, contradictions — every repair proved by a lookup, only the rest asked
- **diff-review** — review any branch, PR, or diff since a fixed point; works outside the chain with any issue as the Spec source
- **finding-pipeline** — the find → validate → propose → validate → route contract every review gate above runs; consult it when authoring or resuming one
- **hitl-questions** — the presentation contract for every question put to the human: the opening where the human states their design before the agent proposes anything, facts vs decisions, cold-reader blocks, one topic per block, domain language, recommendations, escape hatches
- **issue-tracker** — the tracker contract every workflow skill speaks, with GitHub and local-markdown implementations and a per-repo override
- **model-policy** — which model every spawned agent runs on: three tiers (executor, decider, auditor) resolved from `.claude/model-policy.md`, then `~/.claude/model-policy.md`, then defaults — so a session on an expensive model never fans it out by accident
- **conventions** — where a repo's reviewable coding standards live (`CONVENTIONS.md`, per-directory deltas, nearest scope wins) and how reviewers find them
- **testing** — where a repo's test recipes live (`TESTING.md`, per-directory deltas, nearest scope wins) and how implementing and shipping agents scope a test run to the change instead of running everything

## Output styles

The plugin ships one output style, selectable with `/output-style`:

- **Simple** — short plain prose a cold reader can follow: lead with the answer, no bullet walls, no headers, no preamble

## Install

```
claude plugin marketplace add scottlivingston/claude-skills
claude plugin install scott-skills@claude-skills
```

Update after pushing changes:

```
claude plugin marketplace update claude-skills
```
