---
name: wayfinder
description: Plan a huge chunk of work — more than one agent session can hold — as a shared map of investigation tickets on your issue tracker, and resolve them one at a time until the way to the destination is clear. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

A loose idea has arrived — too big for one agent session, and wrapped in fog: the way from here to the **destination** isn't visible yet. Wayfinding is about finding that way, not charging at the destination. This skill charts the way as a **shared map** on the repo's issue tracker, then works its tickets one at a time until the route is clear.

The destination varies per effort, and naming it is the first act of charting — it shapes every ticket. It might be a spec to hand off and iterate on, or a decision to lock before planning starts. It is a **decision state, never the built thing**: building belongs to `/ship`, once a slice of the map's decisions is sealed (see [Slices](#slices) and [Completion and handoff](#completion-and-handoff)). The map is domain-agnostic — engineering work, course content, whatever fits the shape.

## Plan, don't do

Wayfinder is **planning**: each ticket resolves a decision, and the map is done when the way is clear — nothing left to decide before someone goes and does the thing. The pull to just do the work is usually the signal you've reached the edge of the map and it's time to hand off. Produce decisions, not deliverables.

**Implementation tickets never belong on the map.** When resolving a ticket surfaces "now build X", that's fog clearing, not a new ticket — record the decision that makes X buildable and leave the building to `/ship`. The one exception is the Task type below, and it earns its place strictly by unblocking a *decision*, never by delivering any part of the destination.

## Refer by name

Every map and ticket is an issue, so it has a **name** — its title. In everything the human reads — narration, the map's Decisions so far — refer to it by that name, never by a bare id, number, or slug. A wall of `#42, #43, #44` is illegible; names read at a glance. The id and URL don't vanish — a name wraps its link — but they ride *inside* the name, never stand in for it.

## The Map

The map is a single issue on this repo's issue tracker, labelled `wayfinder:map` — the canonical artifact. Its tickets are child issues of the map, and so are its [slices](#slices).

The map is an **index**, not a store. It lists the decisions made and points at the tickets that hold their detail; a decision lives in exactly one place — its ticket — so the map never restates it, only gists it and links.

**Where the map, its child tickets, blocking, and frontier queries physically live is tracker-specific.** Invoke `/issue-tracker` — its "Which tracker?" section resolves which implementation this repo uses, and each implementation carries its wayfinding specifics.

### The map body

The whole map at low resolution, loaded once per session. Open tickets are **not** listed — they are open child issues, found by query.

```markdown
## Destination

<what reaching the end of this map looks like — the spec, decision, or change this effort is finding its way to. One or two lines; every session orients to it before choosing a ticket.>

## Notes

<domain; skills every session should consult; standing preferences for this effort>

## Decisions so far

<!-- the index — one line per closed ticket: enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [<closed ticket title>](link) — <one-line gist of the answer>

## Slices

<!-- see "Slices": the delivery partition — one line per slice, in ship order -->

- [<slice name>](link) — <what it ships> (sealed | open)

## Map-wide decisions

<!-- see "Slices": the resolutions that bind every slice, inherited by every spec's kernel -->

- [<closed ticket title>](link)

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->
```

### Tickets

Each ticket is a **child issue** of the map; the tracker's issue id is its identity. Its body is the question, sized to one agent session:

```markdown
## Question

<the decision or investigation this ticket resolves>
```

Each ticket carries a `wayfinder:<type>` label — one of `research`, `prototype`, `grilling`, `design`, `task` — plus a mode label, `hitl` or `afk` (see [Ticket Types](#ticket-types)).

A session **claims** a ticket by labelling it `in-progress`, **first**, before any work, so concurrent sessions skip it. That label _is_ the claim: an open ticket without `in-progress` is unclaimed, and abandoning a ticket means removing the label.

Blocking uses the tracker's **native** dependency relationship — essential because it renders the frontier _visually_ in the tracker's own UI, so the human sees what's takeable without opening the map. Only a tracker that lacks native blocking falls back to a body convention. A ticket is **unblocked** when every ticket blocking it is closed; the **frontier** is the open, unblocked, unclaimed **ticket** children — the edge of the known. The map's other children are slices (below), which are never resolved and never on the frontier, so the frontier query filters on the `wayfinder:<type>` labels rather than on child-ness.

The answer isn't part of the body — it's recorded on resolution (see [Work through the map](#work-through-the-map)). Assets created while resolving a ticket are linked from the issue, not pasted in.

## Ticket Types

Every ticket is either **HITL** — human in the loop, worked *with* a human who speaks for themselves — or **AFK**, driven by the agent alone. The mode is recorded as a `hitl` or `afk` label at creation (research is always `afk`; prototype, grilling, and design always `hitl`; task is decided per ticket). A HITL ticket only resolves through that live exchange; the agent never stands in for the human's side of it (a grilling agent that answers its own questions has broken this). Every HITL exchange follows the presentation contract in `/hitl-questions` — the project's domain language, cold-reader questions, facts looked up rather than asked.

- **Research** (AFK): Reading documentation, third-party APIs, or local resources like knowledge bases. Creates a markdown summary as a linked asset. Use when knowledge outside the current working directory is required.
- **Prototype** (HITL): Raise the fidelity of the discussion by making a cheap, rough, concrete artifact to react to — an outline, a rough take, a stub, or UI/logic code via the /prototype skill. Links the prototype as an asset. Use when "how should it look" or "how should it behave" is the key question.
- **Grilling** (HITL): Conversation via the /grilling and /domain-modeling skills, worked one decision at a time. The default case.
- **Design** (HITL): Decide the shape of the code before it's built — module boundaries, interfaces and function signatures, data shapes, and the seams tests will live at — via the /design skill. Resolutions carry decision-encoding snippets (interface stubs, type shapes) that flow into the spec, and the agreed seams feed the spec's Seams-under-test list. Use when the question is "what structure should power this" rather than "what should it do".
- **Task** (HITL or AFK): Manual work that must happen before a *decision* can be made — nothing to decide, prototype, or research, but the discussion is blocked until it's done. Signing up for a service so its API can be judged, provisioning access, moving data so its shape can be seen. This is the one type that *does* rather than decides — and it earns its place by unblocking a decision, not by delivering the destination. The agent drives it alone where it can (AFK); otherwise it hands the human a precise checklist (HITL). Resolved when the work is done; the answer records what was done and any resulting facts (credentials location, new URLs, row counts) later tickets depend on.

## Fog of war

The map is _deliberately_ incomplete: don't chart what you can't yet see. Beyond the live tickets lies the **fog of war** — the dim view of decisions and investigations you can tell are coming but can't yet pin down, because they hang on questions still open. Resolving a ticket clears the fog ahead of it, graduating whatever's now specifiable into fresh tickets — one at a time, until the way to the destination is clear and no tickets remain.

The map's **Not yet specified** section is where that dim view is written down: the suspected question, the area to revisit later. It's the undiscovered frontier _toward_ the destination — everything here is in scope, just not sharp enough to ticket. Write as loosely or as fully as the view allows; it doubles as a signpost for collaborators reading where the effort is headed.

**Fog or ticket?** The test is whether you can state the question precisely now — _not_ whether you can answer it now.

- **Ticket when** the question is already sharp — even if it's blocked and you can't act on it yet.
- **Not yet specified when** you can't yet phrase it that sharply. Don't pre-slice the fog into ticket-sized pieces: it's coarser than a ticket, and one patch may graduate into several tickets, or none, once the frontier reaches it.

**Not yet specified** excludes what's already decided (Decisions so far), what's already a live ticket, and what's out of scope (the next section).

## Slices

A map's decisions are ordered by what you had to *learn* — question order, knowledge dependencies, fog clearing outward. Implementation is ordered by what *ships together*. Those two orders rarely coincide, so the map partitions its own decisions into **slices**: each a demoable outcome that becomes its own spec, its own tickets, its own ship run. Slicing is what keeps every downstream stage reading only the decisions that bind it.

A slice is a **child issue of the map** labelled `wayfinder:slice` — never a ticket, and never something an agent resolves. Its body:

```markdown
## Ships

<the demoable outcome this slice delivers — one or two lines>

## Decisions

<!-- links only; each decision's gist lives once, in the map's Decisions so far -->

- [<closed ticket title>](link)
```

**Blocking edges between slices are the ship order** — the same native relationship the tickets use, so the delivery DAG renders in the tracker's own UI beside the decision frontier.

**Slices are fog-shaped.** Chart one only when you can state what it ships and what it needs first — the same test the fog uses, one altitude up. Before that, the decisions it will claim sit unfiled, which is not a defect. Don't pre-slice the map into a partition you can't defend yet: ship order becomes visible in the *resolutions* ("the read path can land before the schema change"), never in the question order.

**Every closed ticket ends up in exactly one place** — a slice's Decisions list, the map's **Map-wide decisions** section, or unfiled while the partition is still dim. Map-wide is for the resolutions that bind every slice (the error model, the vocabulary, cross-cutting contracts); every spec's kernel inherits them, so they are never duplicated into slices. Filing is a **link, never a copy**: the gist stays in Decisions so far, the resolution stays on its ticket, and nothing here can go stale when a later ticket supersedes an earlier one.

### Sealing a slice

A **sealed** slice is one declared safe to spec while the rest of the map is still foggy — the payoff of slicing, because it lets shipping start before charting finishes. **Closing the slice issue is the seal.**

Sealing is not derivable: fog is prose, and no query proves a fog patch can't land in a slice. So it is the human's call, made on a drafted case, per `/hitl-questions`. When a resolution closes a slice's last open ticket, propose the seal in that same session — name what the slice ships, then walk the remaining **Not yet specified** patches one line each with why none of them lands here. On a yes, close the slice. On a no, say what it's waiting for and leave it open.

A sealed slice can still be **breached** — a later resolution turns out to belong to it. Route by how far the slice has gone:

- **Not yet shipping** (its spec exists, or doesn't yet): reopen the slice, file the decision into it, and send the spec back through `/spec-review` — or write it for the first time.
- **Already shipping or shipped**: leave the slice sealed and publish the decision as an `impl` ticket on its spec (create-then-wire), so ship's frontier picks it up as follow-up work. Note the breach on the slice.

## Out of scope

Fog only ever gathers _toward_ the destination. The destination fixes the scope, so work beyond it is **out of scope** — it isn't fog, and it doesn't belong in **Not yet specified**. It gets its own **Out of scope** section on the map: work you've consciously ruled out of _this_ effort. Scope, not sharpness, lands it here.

Out-of-scope work never graduates — the frontier stops at the destination — so it returns only if the destination is redrawn, and then as a fresh effort, not a resumption.

Ruling something out of scope is a scoping act, not a step on the route. When a ticket that already exists turns out to sit past the destination — mis-scoped in while charting, or exposed by a resolution — **close it** (a closed ticket is unambiguously off the frontier) and leave one line in the **Out of scope** section: the gist plus why it's out of scope, linking the closed ticket. It stays out of **Decisions so far**, which records the route actually walked — a scope boundary isn't a step on it.

## Completion and handoff

Handoff is **per slice**, and it starts before the map is done — that is what sealing buys. Each step is its own session, and each skill points at the next. When a slice is sealed:

1. `/map-review <slice>` — cross-read that slice's decisions together with the map-wide ones; a coherent slice is marked `slice-reviewed`.
2. `/specify <slice>` — distill the slice's claimed decisions, plus the map-wide ones, into a spec issue (no interview).
3. `/spec-review <spec>` — read the spec whole and ground it against the codebase; a clean spec is marked `spec-reviewed`.
4. `/tickets <spec>` — HITL: break the spec into sub-issue tickets; the quiz is where the human approves the breakdown.
5. `/ship <spec>` — implement the ticket DAG in parallel, fresh agent per ticket.
6. Ship's closing pass re-reads the whole branch and, once it comes back clean, offers the PR that closes the spec issue.

The **map** is complete when the frontier is empty, no tickets remain open, **Not yet specified** is empty, every closed ticket is filed, and every slice is sealed. Say so explicitly, then run `/map-review <map>` once more: the whole-map pass is the only read that holds every slice at once, and the only one that can catch partition-level drift — two slices that decided the same thing differently. By then some slices have shipped, so its findings land as amendments and follow-up tickets rather than repairs. That is the price of shipping early, paid knowingly. The map closes once every slice has a published spec.

**A map with no slices still works.** If the effort never grew big enough to partition — or the partition never became statable — the map completes as one unit and `/map-review <map>` then `/specify <map>` treat the whole thing as a single slice. Slicing is a pressure valve, not a required ceremony.

While charting is still underway, `/drain <map>` works the AFK frontier tickets (research, AFK tasks) in parallel background agents so the human only sits in HITL tickets.

`/next <map>` routes to whichever of these steps the tracker says is current — the human can drive the whole chain by invoking it each session.

## Invocation

Two modes. Either way, **resolve at most one ticket per invocation.** Fresh context per ticket is the default; light tickets may share a live session, but only across separate `/next` invocations — that skill owns the continue-or-clear call after each ticket.

### Chart the map

User invokes with a loose idea.

1. **Name the destination.** Run a `/grilling` and `/domain-modeling` session to pin down what this map is finding its way to — the spec, decision, or change. The destination fixes the scope, so it's settled first.
2. **Map the frontier.** Grill again, **breadth-first** this time: fan out across the whole space rather than deep on any one thread, surfacing the open decisions and the first steps takeable now. **If this surfaces no fog** — the way to the destination is already clear, the whole journey small enough for one session — you don't need a map. Stop and ask the user how they'd like to proceed.
3. **Create the map** (label `wayfinder:map`; run the tracker doc's bootstrap first so the markers exist): Destination and Notes filled in, Decisions so far empty, the fog sketched into **Not yet specified**.
4. **Create the tickets you can specify now** as child issues of the map — then wire blocking edges in a **second pass** — **create-then-wire**, because issues need ids before they can reference each other. Wiring sorts them into the frontier and the blocked; everything you can't yet specify stays in the fog — the **Not yet specified** section.

   Chart any **slice** you can already state the same way (create-then-wire; slices block each other in ship order). Most maps can't name one this early — the partition shows up in the resolutions, not the questions — and that is the normal case, not a gap.
5. Stop — charting the map is one session's work; do not also resolve tickets.

### Work through the map

User invokes with a map (URL or number). A ticket is **optional** — without one, you pick the next decision, not the user.

1. Load the **map** — the low-res view, not every ticket body. **If the map is already complete** (no open tickets, empty Not yet specified), don't hunt for work: say so and point at [Completion and handoff](#completion-and-handoff).
2. Choose the ticket. If the user named one, use it. Otherwise take the first frontier ticket in order. **Claim it**: label it `in-progress` before any work.
3. Resolve it — **zoom as needed**: fetch the full body of any related or closed ticket on demand; invoke the skills the `## Notes` block names. If in doubt, use `/grilling` and `/domain-modeling`.
4. Record the resolution: post the answer as a **resolution comment**, **close** the issue, and **append a context pointer** to the map's Decisions so far.
5. Add newly-surfaced tickets (create-then-wire); graduate any fog the answer has made specifiable, clearing each graduated patch from **Not yet specified** so it lives only as its new ticket. If the answer reveals a ticket — this one or another — sits beyond the destination, **rule it out of scope** rather than resolving it on the route. If the decision invalidates other parts of the map, update or delete those tickets.
6. **File the resolution** — into a slice's Decisions list, into **Map-wide decisions**, or leave it unfiled if the partition is still too dim to place it. If the answer made a new slice statable, chart it now (create-then-wire, ship order as blocking edges). See [Slices](#slices).
7. **If this closed a slice's last open ticket, propose the seal** — see [Sealing a slice](#sealing-a-slice). Don't start the sealed slice's handoff in this session.
8. If this resolution completed the map (see [Completion and handoff](#completion-and-handoff)), say so and point at the handoff — don't start it in this session.

The user may run unblocked tickets in parallel, so expect other sessions to be editing the tracker concurrently.
