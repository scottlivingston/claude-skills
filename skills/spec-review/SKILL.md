---
name: spec-review
description: Read a published spec in full — kernel, every decision, seams — and ground it against the codebase before /tickets breaks it down. Hunts decisions that don't decide, stale claims about the code, seam gaps, unfalsifiable acceptance, contradictions and scope leaks through the finding pipeline — derivable repairs auto-applied to the spec, every escalated defect arriving with drafted repair text at a durable gate — and a clean spec is marked spec-reviewed. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

A spec is the last artifact before code. Everything downstream trusts it absolutely: `/tickets` routes its decisions without questioning them, and a `/ship` agent handed a decision that doesn't decide will simply invent the missing half. This skill is the one session that reads the spec **whole** — kernel plus every decision, in index order — and holds it against the codebase it claims to describe.

It is the spec-side mirror of `/map-review`: that skill checks whether the map's decisions compose; this one checks whether the spec they became is **implementable as written**. Both run the pipeline in `/finding-pipeline` — the invariants (adversarial validation, routing, gate markers, question mechanics) live there; what's here is what a spec defect is and what repairing one touches.

For tracker operations, invoke `/issue-tracker`. The spec's own structure — the kernel's sections, the Decision Index, and the decision units it addresses — is defined in `/specify`.

## Precondition

The argument is a `spec` issue (URL or number), and it has no `impl` sub-issues yet — the breakdown hasn't run. Tickets already exist means this stage is past; say so and point at `/next`.

## Two modes

The spec's origin decides how much to hunt:

- **Fidelity mode** — the spec carries a map link and its map was `map-reviewed`. The decisions' merits are settled and already cross-read; the only question is whether the synthesis survived the trip. Zoom the map's resolutions and check each landed as a decision that says the same thing, with its Origin link intact. Ground against the codebase, sweep for the defects below, and stop.
- **Full mode** — the spec came straight from a conversation. No gate has run on this material at all, so every defect below is live and the codebase grounding carries the most weight.

## Defects

- **Underdetermined decision** — the `Decided:` line names the question but not the verdict, so an implementer must choose. The sharpest test: could two competent agents read this and build incompatible things?
- **Stale ground truth** — the spec asserts something about the codebase that isn't true: a module that moved, prior art that was refactored away, a boundary that no longer exists. Only reachable by reading the code, which is why this stage reads it.
- **Stale cache** — a count, figure, or ordered list the spec restates from something that can change underneath it: how many tests a suite holds, how many migrations apply, which call sites read a variable. The spec is *allowed* these — a criterion needs a number to be falsifiable and a ticket agent needs to know what to hit — so the number's existence is never the defect. The defect is the number disagreeing with the tree today, a measurement sitting undated as though it were a live claim, or a second copy of a list the spec already links the owner of. All three repair per the contract's *striking outranks correcting*, and none of them is a question.
- **Seam gap** — a decision introduces behaviour that no seam in **Seams under test** can observe, or a listed seam sits below the highest one available. `/tdd` tests at the listed seams and no others, so both stall a ship agent mid-wave.
- **Unfalsifiable acceptance** — a user story or decision written so no test can decide pass from fail. `/ship` verifies against these; a fuzzy one makes that verification theatre.
- **Uncovered story** — a numbered user story that no decision, and nothing in Solution, serves.
- **Orphan decision** — a decision no story or problem statement needs. Scope creep hides exactly here. (`/tickets` checks decisions against *tickets*; nothing else checks them against *stories*.)
- **Contradiction** — kernel against a decision, or two decisions that can't both hold.
- **Scope leak** — a decision ruling on ground the spec's Out of Scope excludes.
- **Index drift** — a Decision Index gist that no longer says what its decision unit decided.

## Process

1. **Read the spec in full**: the body plus every decision, in index order, per the tracker doc. All of them — the whole read is the point of this stage. (A spec with no Decision Index is just its body; the defects still apply, read against its prose.)
2. **Run the pipeline** per `/finding-pipeline`, as one dynamic workflow. The find stage is two readers, the grounding read on the **auditor tier** per `/model-policy` (a run-once read whose misses nothing downstream catches): the **grounding read** explores the areas the spec touches and checks every claim it makes about what exists today — the named seams, the prior art, the modules, the boundaries, the project's domain glossary and any ADRs in the area (per `/domain-modeling`) — and the **defect sweep** holds the spec whole against the list above. Findings (IDs `SR-<i>`, per-run) carry what they hold the claim against as the contract's source fields — for a decision, its title, its Decision Index gist, and the quoted `Decided:` line or spec sentence; for code, the quoted snippet and its file; dedup runs against prior `<!-- spec-review summary -->` comments. Every survivor's proposal is a **drafted repair** — the amended `Decided:` line, the missing seam row, the corrected claim, the decision to strike — validated adversarially like the finding itself.
3. **Route** by the contract's escalation test — **the defect's kind never decides this**; the list above says what to hunt. Derivable here, and so auto-applied:
   - **Index drift** — the decision unit's own text is the proof. A stale link, likewise.
   - **Stale ground truth and stale caches** — the tree is the proof of what exists, so recounting is arithmetic, and **so is propagating the recount**: every figure derived from the corrected one, every sibling sentence quoting it, and the dating of anything that records a measurement rather than a live claim. Where the cached fact has an owner the spec already links, striking the copy is the repair per the contract's *striking outranks correcting* — and striking a cached fact is not the same act as striking a decision, which is always a verdict.
   - **Anything the spec's own record settles outright** — most often a body paragraph contradicting the decision that owns its question: the decision rules, the paragraph is a restatement that drifted, and correcting it is arithmetic rather than a verdict.

   The one escape from the recount rule is narrow, and it is about **verdicts, not mentions**: escalate only where the corrected figure crosses a threshold a decision actually turned on, so that decision now comes out the other way. A decision that merely quotes the figure and reaches the same conclusion — more strongly, even — gets its number fixed and its argument annotated, and never costs a turn. Asking the human which of two counts is authoritative when one of them is the tree is the purest form of spending them on the pipeline's own work.

   Everything that adds a decision, strikes a decision, or picks among readings of one **escalates, with its drafted repair attached**, so the ask is a verdict on concrete text: underdetermined decisions, seam gaps, unfalsifiable acceptance, uncovered stories, orphans, scope leaks, and the contradictions whose halves both genuinely stand.
4. **The gate.** Escalations post as `<!-- spec-review pending-questions -->` on the spec (the workflow's final stage), notify, and end the turn per the contract. The question loop — here or in a later session — walks the defects one per turn per the contract's question mechanics: each put as a position — the drafted text you'd land and the reason that carries it — the user accepts, redirects, or argues. Verdicts act as:
   - **Amend** — edit the decision's text in place, and its index gist with it.
   - **Add** — a genuine gap: publish a new decision unit at the end of the index and extend the Decision Index. Existing IDs never renumber; downstream citations depend on them.
   - **Strike** — a scope leak or dead decision: remove it, note the removal in the summary, and leave the ID retired rather than reused.
5. **Record and mark.** Post `<!-- spec-review summary -->` on the spec — every finding ID with its terminal outcome, auto-applied edits included, per the contract — then mark the spec `spec-reviewed` and point at `/tickets <spec>`.

All repairs land **as edits to the spec** — the body and its decision units, never a separate artifact. `/tickets` and `/ship` just receive a truer spec.

## When a defect isn't answerable on the spot

An underdetermined decision sometimes turns out to be genuinely undecided — nobody ever made the call. That's a grilling, not a review verdict: when its turn comes in the question loop, run `/grilling` on it right there, grounded in the domain model, and record the outcome as an amended or new decision. The spec is the canonical home for decisions, so the effort stays in this stage rather than routing backward.

The exception is a spec whose *destination* is wrong — the problem statement itself is off. Stop, say so, and point at `/wayfinder`; no amount of spec editing fixes that.

## Rules

- **One invocation, one review.** Marking `spec-reviewed` and running `/tickets` never share an invocation (`/next auto` chains invocations; the boundary it respects is the gate, not the session).
- **Defects speak per `/hitl-questions`** — the domain language, cold-reader blocks, recommendations included. The one place paths are welcome is a stale-ground-truth finding, which is *about* the code: anchor it with its `path:line`.
- **Merits are the human's to reopen, never yours to re-litigate.** Review whether the spec is implementable, not whether its decisions were the right ones. This binds the *repairs* as much as the findings: a prohibition, a constraint, an authoring rule, or a new decision unit that no defect forces is drafting policy under cover of a correction, and the contract's fix validator refuses it. Where a correction and an addition arrive together, the correction lands and the addition is dropped — recorded in the digest, so the human can ask for it if they want it.
- **Cheap by default.** The read, the grounding, and validation are agent work; the human is spent only on real defects, and only on drafted text. A clean spec costs one pass, an audit digest, and a one-line report — say so, mark, and stop. Cheap-by-default is what keeps this stage run rather than skipped, which matters most for the small specs that skipped the map entirely.
