---
name: wayfinder
description: Plan a huge chunk of work — more than one agent session can hold — as a shared map of decision tickets on your issue tracker that agents resolve on their own against the human's destination, principles, and high-level design, reconsidering earlier decisions when later ones strain against them. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

A loose idea has arrived — too big for one agent session, and wrapped in fog: the way from here to the **destination** isn't visible yet. This skill charts the way as a **shared map** on the repo's issue tracker and lets agents find it. The human gives three things at charting — the destination, the principles, and the high-level design — and agents make every decision in between, citing which of those settled it (per `/deciding`). The human is pulled back only by an escalation.

Autonomy makes one failure likely: decisions **compounding** — a call made early and confidently that later calls quietly bend around until the route is built on it. The map is built to catch that: every decision records what it rests on, every strain on an earlier decision is reported, and accumulated strain triggers a **reconsideration** that plans the correction from what has since been learned.

The destination is a **decision state, never the built thing**: building belongs to `/ship`, once a slice of the map's decisions is sealed (see [Slices](#slices) and [Completion and handoff](#completion-and-handoff)).

## Plan, don't do

Each deciding ticket resolves a decision, each evidence ticket gathers what a decision needs, and the map is done when nothing is left to decide before someone builds the thing. Produce decisions, not deliverables.

**Implementation tickets never belong on the map.** When resolving a ticket surfaces "now build X", that's fog clearing — record the decision that makes X buildable and leave the building to `/ship`. The one exception is the Task type below, which earns its place strictly by unblocking a *decision*.

## Refer by name

In everything a human reads — narration, the map's Decisions so far, escalations — refer to a map, slice, or ticket by its title, wrapping its link, never by a bare id, number, or slug.

## The Map

The map is a single issue on this repo's issue tracker, labelled `wayfinder:map` — the canonical artifact. Its tickets are child issues of the map, and so are its [slices](#slices).

The map is an **index**, not a store. It lists the decisions made and points at the tickets that hold their records; a decision lives in exactly one place — its ticket.

**Where the map, its child tickets, blocking, and frontier queries physically live is tracker-specific.** Invoke `/issue-tracker` — its "Which tracker?" section resolves which implementation this repo uses, and each implementation carries its wayfinding specifics.

### The map body

The whole map at low resolution, loaded once per session. Open tickets are **not** listed — they are open child issues, found by query.

```markdown
## Destination

<what reaching the end of this map looks like — one or two lines; every session orients to it>

## Principles

<!-- map-specific principles, as deltas over PRINCIPLES.md per /principles; "none beyond the repo's" is a valid entry -->

## Design

<the high-level design the human agreed at charting: the major parts, how they relate, the flows that matter. Decisions serve it; only a human answer changes it>

## Notes

<domain; the repo areas whose scoped PRINCIPLES.md files bind this map; skills every session should consult; checkpoint cadence if not the default>

## Decisions so far

<!-- the index — one line per closed deciding ticket; a superseding decision replaces the line it supersedes -->

- [<closed ticket title>](link) — <one-line gist of the answer>

## Slices

- [<slice name>](link) — <what it ships> (sealed | open)

## Map-wide decisions

- [<closed ticket title>](link)

## Not yet specified

<!-- the fog: in-scope questions you can't ticket yet -->

## Out of scope

<!-- work ruled beyond the destination; closed, never graduates -->
```

### Tickets

Each ticket is a **child issue** of the map; its body is the question, sized to one agent session:

```markdown
## Question

<the decision this ticket resolves, or the question of fact it answers>
```

Each ticket carries a `wayfinder:<type>` label (see [Ticket types](#ticket-types)) and a mode label: `afk` for every ticket an agent works, `hitl` only for a ticket escalated to the human or a task only the human can do.

A session **claims** a ticket by labelling it `in-progress`, **first**, before any work. Blocking uses the tracker's dependency relationship (per `/issue-tracker`). A ticket is **unblocked** when every ticket blocking it is closed; the **frontier** is the open, unblocked, unclaimed ticket children.

Blocking edges do two jobs here. Charted before a ticket is worked, they are question order; added when a decision is recorded, they are its **rests-on** edges (per `/deciding`). Either way, the tickets a decision blocks are the ones that would have to be re-checked if it changed — its **dependents**.

## Ticket types

- **Decision** (`afk`): the default. A product or behaviour question, decided per `/deciding`.
- **Design** (`afk`): "what structure should power this" — modules, interfaces, data shapes, the seams tests will live at — decided per `/deciding` using `/design`'s method; the record carries the contract snippets and seams that flow into the spec.
- **Prototype** (`afk`): a question only seeing it run can answer; the agent builds a throwaway per `/prototype`, judges it against the grounds, links it, and records the decision.
- **Research** (`afk`): a question of *fact* — what an API supports, how comparable systems solve it, what a service costs. Resolves as cited **findings** per `/research`, plus the options they leave open; never a choice. Chart it blocking the decision it feeds, so evidence has a consumer.
- **Task** (`afk` or `hitl`): work that must happen before a decision can be made — provisioning access, moving data so its shape can be seen. `hitl` when only the human can do it, with a precise checklist.
- **Reconsider** (`afk`): opened only by the [reconsideration](#reconsideration) trigger, never charted by hand.

Decision, design, prototype, and reconsider tickets are **deciding** tickets; research and task tickets are **evidence**. A deciding ticket escalates only in `/deciding`'s three cases.

## Fog of war

The map is _deliberately_ incomplete: don't chart what you can't yet see. The **Not yet specified** section holds the dim view — the suspected question, the area to revisit — everything in scope, not sharp enough to ticket.

**Fog or ticket?** The test is whether you can state the question precisely now — _not_ whether you can answer it now. Ticket a sharp question even if it's blocked; leave a fuzzy one in the fog, unsliced, until a resolution sharpens it.

## Slices

A map's decisions are ordered by what had to be *learned*; implementation is ordered by what *ships together*. So the map partitions its decisions into **slices**: each a demoable outcome that becomes its own spec, its own tickets, its own ship run.

A slice is a **child issue of the map** labelled `wayfinder:slice` — never a ticket. Its body:

```markdown
## Ships

<the demoable outcome this slice delivers — one or two lines>

## Decisions

- [<closed ticket title>](link)
```

**Blocking edges between slices are the ship order.** **Slices are fog-shaped**: chart one only when you can state what it ships and what it needs first — ship order shows up in the resolutions, never in the question order.

An open ticket whose answer will land in a known slice carries a `Slice: <slice name>` line in its body, set when it is charted or proposed. That line is what tells a slice is still waiting on work.

**Every closed deciding ticket of record ends up in exactly one place** — a slice's Decisions list, **Map-wide decisions** (the resolutions that bind every slice: the error model, the vocabulary, cross-cutting contracts), or unfiled while the partition is still dim. Filing is a **link, never a copy**. Evidence tickets are never filed; they reach the spec through the decisions that cite them. Neither are two kinds of closed deciding ticket that are not decisions of record: a `superseded` ticket, and a reconsider ticket whose plan was Stands or Amend — it is linked from the decision it reconsidered, never indexed or filed.

### Sealing a slice

A **sealed** slice is one declared safe to spec while the rest of the map is still foggy — closing the slice issue is the seal. A slice is **ready to seal** when it claims at least one decision, no open ticket names it on a `Slice:` line, and no open reconsideration touches a decision it claims. When a fold leaves a slice ready, the coordinator drafts the seal case: what the slice ships, and each remaining **Not yet specified** patch in one line with why it doesn't land here. An independent agent on the **decider tier** (per `/model-policy`) tries to refute the case; a case it can't refute seals the slice, with the case posted on it. A refuted case leaves the slice open with the reason, and the patch that broke it becomes the next thing charted.

A sealed slice that a later decision turns out to belong to is **breached**; a breach is routed exactly as a reconsideration routes a changed decision, by how far the slice has gone (see [Applying a correction](#applying-a-correction)). **Unsealing** a slice means reopening its issue and removing `slice-reviewed`, so it is sealed and reviewed again before it specs.

## Out of scope

The destination fixes the scope. When a ticket turns out to sit past it, **close it** and leave one line in **Out of scope**: the gist, why, and the link. Out-of-scope work never graduates; it returns only as a fresh effort if the destination is redrawn.

## Folding a resolution

The map body has **one writer**: the **coordinator** — the session running `/drain`, or `/next` when no drain is running. The coordinator claims the map (`in-progress`) for as long as it runs. Every other writer proposes instead: a ticket agent ends its resolution with a `## Map changes proposed` section, and any other stage that would change the map body while it is claimed — `/map-review`'s repairs, another session's reconcile — posts the change as a `## Map changes proposed` comment on the map. Proposals cover new questions now statable (each with its `Slice:` line where known), fog graduated, tickets out of scope or invalidated, the filing of a decision, a new slice now statable (its Ships line and the decisions it claims), and edits to gists. The coordinator **folds** each closed ticket, and each proposal comment on the map, serially:

1. **Index it**: a deciding ticket of record gets its line in Decisions so far (per `/issue-tracker`'s Resolve). Evidence tickets, and reconsider tickets that ended Stands or Amend, are never indexed.
2. **Apply the proposals** that still hold against the map as it now stands — create the new tickets (every issue first, then the links), clear graduated fog, rule out of scope, file the decision. A proposal a sibling fold already overtook is dropped with a line on the ticket.
3. **Count toward the checkpoint** and check the [reconsideration trigger](#reconsideration) for every decision that gained friction.
4. **Seal** any slice this fold left ready (above), and note completion if the map is now complete.

When the frontier holds nothing takeable but **Not yet specified** isn't empty, the coordinator makes a **charting pass**: graduate every patch the record now makes sharp; for one still fuzzy, chart a research ticket whose findings would sharpen it; a patch still fuzzy after its research becomes a decision ticket escalated per `/deciding` — the human is asked what they meant.

## Reconsideration

Friction notes (per `/deciding`) accumulate on decisions. A decision is **reconsidered** when it carries any friction from code — a ship park or review finding that traces to it — or a note saying it breaks a principle, or two notes from anything else — counting only notes posted since its last reconsideration. The coordinator opens a **reconsider** ticket (`wayfinder:reconsider`, `afk`) naming the decision, makes it block every **open** dependent so nothing new is decided on a base under question, and clears the `friction` marker so the same notes never trigger twice.

The reconsider agent reads the decision's record, every friction note on it, the dependents (the tickets it blocks, followed transitively), and whatever has been learned since it was made, and returns a **correction plan** as its record:

- **Stands** — the decision holds; say why each strain is acceptable or belongs to the dependent that reported it, and post a pointer on each strained dependent.
- **Amend** — a clarification that changes no dependent's call: the amendment text, posted on the decision's ticket.
- **Supersede** — a replacement decision, with full grounds, plus a line per dependent: unaffected (and why) or re-decide.

The plan is attacked before it applies: a fresh decider-tier agent that didn't write it tries to refute it against the grounds and the dependents' records. A refuted plan gets one revision round with the refutation attached; refuted again, it escalates. A plan escalates anyway when it falls in one of `/deciding`'s three cases — superseding a one-way decision, or one that would change the principles or the design.

### Applying a correction

A superseding plan applies like any fold: the reconsider ticket becomes the decision of record — its line **replaces** the superseded one in Decisions so far and in whatever slice or map-wide list held it, and the old ticket gets the `superseded` marker and a link to its replacement (its record stays, for the audit trail). The slice holding the superseded decision, and each re-decide dependent, is routed by how far that slice has gone:

- **Not yet specced**: reopen the dependent ticket with a comment linking the plan, so it is re-decided on the frontier (the superseded decision itself needs nothing more — its replacement is already filed). A sealed slice touched this way is unsealed.
- **Specced, not yet shipping** (the spec has no `impl` sub-issues yet): amend the spec with the new decision and remove `spec-reviewed`, so it goes back through `/spec-review`.
- **Shipping or shipped**: leave the slice sealed and publish the change as an `impl` ticket on its spec, so it lands as follow-up work; note it on the slice.

## Checkpoints

Friction catches the strains a decider notices; a **checkpoint** catches the ones nobody did. After every six folded decisions (or the cadence the map's Notes set), and whenever a slice's spec closes, the coordinator routes `/map-review <map> checkpoint`, which cross-reads the decisions since the last checkpoint against everything they rest on and turns each tension into friction or a reconsideration.

## Completion and handoff

Handoff is **per slice**, and it starts before the map is done — that is what sealing buys. When a slice is sealed:

1. `/map-review <slice>` — cross-read that slice's decisions with the map-wide ones; a coherent slice is marked `slice-reviewed`.
2. `/specify <slice>` — distill them into a spec issue.
3. `/spec-review <spec>` — read the spec whole and ground it against the codebase; a clean spec is marked `spec-reviewed`.
4. `/tickets <spec>` — break it into implementation tickets.
5. `/ship <spec>` — implement the ticket DAG wave by wave; its closing pass offers the PR.

The **map** is complete when no tickets remain open, **Not yet specified** is empty, every closed deciding ticket of record is filed, and every slice is sealed. Then `/map-review <map>` runs once more over the whole map — the only read that holds every slice at once. The map closes once every slice has a published spec.

**A map with no slices still works**: it completes as one unit, and `/map-review <map>` then `/specify <map>` treat it as a single slice.

`/next <map>` routes to whichever step the tracker says is current; `/next auto <map>` conducts all of them, pausing only for escalations.

## Invocation

### Chart the map

User invokes with a loose idea. This is the one session that is the human's by design: everything agents decide later stands on what is settled here. Load `/grilling` and `/domain-modeling`.

1. **Name the destination.** Grill until what this map is finding its way to is one or two confirmed lines.
2. **Settle the principles.** Load `/principles` and read the governing `PRINCIPLES.md` files. If the repo has none, or they say nothing about the questions this effort raises, draft the missing principles and reference solutions with the human, and write them to the repo file (or the map's Principles section, where they hold for this effort only). Work by asking which way the human leans on the trade-offs the effort will hit; the test of done is that you can predict their call on the hardest decisions you can foresee.
3. **Agree the high-level design** — the major parts, how they relate, the flows that matter — at the altitude the human holds it, not down to interfaces.
4. **Map the frontier, breadth-first**: the open questions across the whole space and the first ones takeable now, each typed. **If this surfaces no fog** — the whole journey fits one session — you don't need a map. Stop and say so.
5. **Create the map** (label `wayfinder:map`; run the tracker doc's bootstrap first): Destination, Principles, Design, and Notes filled in, the fog sketched into **Not yet specified**. Then create the tickets you can state now as child issues, and add the blocking edges in a second pass. Chart any slice you can already state the same way; most maps can't name one yet.
6. Stop, and point at `/next auto <map>` — charting is one session's work.

### Work through the map

User invokes with a map (URL or number), optionally a ticket. Working one ticket by hand follows the same rules an agent does:

1. Load the map body. If the map is already complete, say so and point at [Completion and handoff](#completion-and-handoff).
2. Choose the ticket — the one named, or the first frontier ticket — and **claim it**.
3. Resolve it: an evidence ticket per `/drain`'s brief; a deciding ticket per `/deciding`, ending in its record with the proposed map changes; a reconsider ticket per [Reconsideration](#reconsideration).
4. Close it and **fold** it (above).

An escalated (`hitl`) ticket worked with the human: load `/grilling` and `/hitl-questions`, open from the escalation's draft, and record the human's verdict as the decision record before folding.

To work the whole agent frontier in parallel, run `/drain <map>` instead. Expect other sessions and background agents to be editing the tracker concurrently.
