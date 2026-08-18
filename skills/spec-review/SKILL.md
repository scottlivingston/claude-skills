---
name: spec-review
description: Read a published spec in full — kernel, every decision, seams — and ground it against the codebase before /tickets breaks it down. Hunts decisions that don't decide, stale claims about the code, seam gaps, unfalsifiable acceptance, contradictions and scope leaks; each defect arrives with a drafted repair, fixes land as edits to the spec, and a clean spec is marked spec-reviewed. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

A spec is the last artifact before code. Everything downstream trusts it absolutely: `/tickets` routes its decisions without questioning them, and a `/ship` agent handed a decision that doesn't decide will simply invent the missing half. This skill is the one session that reads the spec **whole** — kernel plus every decision, in index order — and holds it against the codebase it claims to describe.

It is the spec-side mirror of `/map-review`: that skill checks whether the map's decisions compose; this one checks whether the spec they became is **implementable as written**.

For tracker operations, invoke `/issue-tracker`.

## Precondition

The argument is a `spec` issue (URL or number), and it has no `impl` sub-issues yet — the breakdown hasn't run. Tickets already exist means this stage is past; say so and point at `/next`.

## Two modes

The spec's origin decides how much to hunt:

- **Fidelity mode** — the spec carries a map link and its map was `map-reviewed`. The decisions' merits are settled and already cross-read; the only question is whether the synthesis survived the trip. Zoom the map's resolutions and check each landed as a decision that says the same thing, with its Origin link intact. Ground against the codebase, sweep for the defects below, and stop.
- **Full mode** — the spec came straight from a conversation. No gate has run on this material at all, so every defect below is live and the codebase grounding carries the most weight.

## Defects

- **Underdetermined decision** — the `Decided:` line names the question but not the verdict, so an implementer must choose. The sharpest test: could two competent agents read this and build incompatible things?
- **Stale ground truth** — the spec asserts something about the codebase that isn't true: a module that moved, prior art that was refactored away, a boundary that no longer exists. Only reachable by reading the code, which is why this stage reads it.
- **Seam gap** — a decision introduces behaviour that no seam in **Seams under test** can observe, or a listed seam sits below the highest one available. `/tdd` tests at the listed seams and no others, so both stall a ship agent mid-wave.
- **Unfalsifiable acceptance** — a user story or decision written so no test can decide pass from fail. `/ship` verifies against these; a fuzzy one makes that verification theatre.
- **Uncovered story** — a numbered user story that no decision, and nothing in Solution, serves.
- **Orphan decision** — a decision no story or problem statement needs. Scope creep hides exactly here. (`/tickets` checks decisions against *tickets*; nothing else checks them against *stories*.)
- **Contradiction** — kernel against a decision, or two decisions that can't both hold.
- **Scope leak** — a decision ruling on ground the spec's Out of Scope excludes.
- **Index drift** — a Decision Index gist that no longer says what its decision unit decided.

## Process

1. **Read the spec in full**: the body plus every decision, in index order, per the tracker doc. All of them — the whole read is the point of this stage. (An older spec with no Decision Index is just its body; the defects below still apply, read against its prose.)
2. **Ground against the codebase.** Explore the areas the spec touches, and check every claim it makes about what exists today: the named seams, the prior art, the modules, the boundaries. Check the project's domain glossary and any ADRs in the area, too — a spec that has drifted from the ubiquitous language ships code that drifts with it.
3. **Sweep the defect list** against the spec held whole.
4. **Triage each finding**:
   - **Mechanical** (index drift, a stale link, a gist to re-word): fix now, silently, as spec edits. Not worth human time.
   - **Substantive** (everything else): escalate to the human **one at a time**, and **arrive with a drafted repair** — the amended `Decided:` line, the missing seam row, the decision to strike — so the ask is a verdict on concrete text, not an open question. State what's wrong, show the proposed text, recommend. Get the verdict, apply it, then raise the next.
5. **Apply verdicts as edits to the spec** — the spec body and its decision units, never a separate artifact. `/tickets` and `/ship` just receive a truer spec.
   - **Amend** — edit the decision's text in place, and its index gist with it.
   - **Add** — a genuine gap: publish a new decision unit at the end of the index and extend the Decision Index. Existing IDs never renumber; downstream citations depend on them.
   - **Strike** — a scope leak or dead decision: remove it, note the removal in the review summary, and leave the ID retired rather than reused.
6. **Record and mark.** Comment a review summary on the spec — defects found, verdicts, what was amended — then mark the spec `spec-reviewed` and point at `/tickets <spec>`.

## When a defect isn't answerable on the spot

An underdetermined decision sometimes turns out to be genuinely undecided — nobody ever made the call. That's a grilling, not a review finding: run `/grilling` on it right there, grounded in the domain model, and record the outcome as an amended or new decision. The spec is the canonical home for decisions, so the effort stays in this stage rather than routing backward.

The exception is a spec whose *destination* is wrong — the problem statement itself is off. Stop, say so, and point at `/wayfinder`; no amount of spec editing fixes that.

## Rules

- **One invocation, one review.** Marking `spec-reviewed` and running `/tickets` never share a session.
- **Defects speak the domain language** — capabilities and concepts, never file paths; `/domain-expansion` when a question lands on unfamiliar terrain. The one place paths are welcome is a stale-ground-truth finding, which is *about* the code: anchor it per `/code-anchors`.
- **Merits are the human's to reopen, never yours to re-litigate.** Review whether the spec is implementable, not whether its decisions were the right ones.
- **Cheap by default.** The read and the grounding are agent work; the human is spent only on real defects, and only on drafted text. A clean spec costs one pass and a one-line report — say so, mark, and stop. Cheap-by-default is what keeps this stage run rather than skipped, which matters most for the small specs that skipped the map entirely.
