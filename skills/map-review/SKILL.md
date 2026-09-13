---
name: map-review
description: Cross-read a sealed wayfinder slice — or a whole completed map — every resolution in full, as one body of decisions, before /specify turns it into a spec. Hunts contradictions, superseded calls, route gaps, undecided seams, misfilings, and drifted gists through the finding pipeline — derivable repairs auto-applied to the map, only genuine tensions escalated at a durable gate — and a coherent slice or map is marked slice-reviewed or map-reviewed. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

A map is **complete** when its frontier is empty — but complete is a mechanical fact, not a semantic one. The map's decisions were made in separate sessions, possibly weeks apart, possibly in parallel; no single context has ever held all the resolutions at once. And the next stage, `/specify`, is forbidden to interview: handed a contradiction, it papers over it by silently picking a side. This skill is the one session that reads **every resolution in full, together, before the spec exists** — the cross-decision view no charting session had.

It runs at **two altitudes**, because a map's decisions are delivered as slices (see `/wayfinder`) and each slice specs on its own schedule:

- **Slice mode** — the argument is a sealed slice. Cross-reads that slice's decisions together with the map-wide ones, immediately before that slice becomes a spec. This is the gate that actually protects a spec.
- **Map mode** — the argument is a completed map. The whole-map pass: the only read that ever holds every slice at once, and so the only one that can catch drift *between* slices.

An unsliced map has only map mode, and nothing below changes for it.

It is the planning-side mirror of `/diff-review`: that skill reviews what came out of ship; this one reviews what feeds the spec. Both run the pipeline in `/finding-pipeline` — the invariants (adversarial validation, routing, gate markers, question mechanics) live there; what's here is what a map finding is and what repairing one touches.

For tracker operations, invoke `/issue-tracker`.

## Precondition

The argument is a `wayfinder:slice` or `wayfinder:map` issue (URL or number).

- **Slice mode**: the slice must be **sealed** — closed, per wayfinder's sealing rule. An open slice means the human hasn't yet agreed that no remaining fog lands in it; stop, say so, and point at `/next`.
- **Map mode**: the map must be complete — no open child tickets, **Not yet specified** empty, every closed ticket filed, every slice sealed. Anything still open means charting isn't done — stop, say so, and point at `/next`.

## Not a second grilling

Every decision on the map already survived its own HITL session. Its **merits are settled** — this skill never re-litigates whether a decision was right, only whether the decisions **compose**. The findings hunted here are exactly the ones no per-ticket session could see:

- **Contradiction** — two resolutions that can't both hold.
- **Superseded decision** — an early call made without context a later resolution established, and never revisited.
- **Route gap** — the decisions don't add up to a clear way to the destination; something between two of them was never actually decided. Frontier-empty is not way-clear.
- **Undecided seam** — the map settles behaviour but leaves the seams genuinely open, which `/specify` would otherwise discover mid-synthesis.
- **Scope leak** — a resolution that quietly decided something past the destination, or ruled on ground the map's Out of scope section already excluded.
- **Index drift** — a Decisions-so-far gist that no longer says what its ticket actually resolved (mechanical: the spec is synthesized from the zoomed tickets, but humans navigate by the gists).
- **Misfiling** — a decision filed into this slice that no ticket of it needs, or one filed map-wide that only a single slice uses. The filing is what bounds every downstream agent's context, so a wrong file is a real defect, not bookkeeping.
- **Partition drift** (map mode only) — two slices that decided the same question differently, or a slice whose decisions don't add up to the demoable outcome its Ships line claims. This is the finding class the whole-map pass exists for; no slice-mode run can see it.

If the human, shown a tension, decides an underlying decision was simply wrong — reopening on merits is their call, and it routes back to charting. This skill never initiates a merits fight.

## Process

1. **Load the map, then zoom everything in scope** — fetch full bodies and resolution comments, never a sample. The full read is the entire point of this stage; batch by area on a large scope and carry a running digest of decided facts and suspected tensions between batches, but never skip a ticket. Scope is set by mode:
   - **Slice mode**: every ticket the slice claims, plus every **Map-wide decision**. Read the other slices at gist level only — Decisions-so-far is enough to notice an overlap — and zoom one only when a tension is suspected.
   - **Map mode**: every closed child ticket on the map, all of them.
2. **Run the pipeline** per `/finding-pipeline`, as one dynamic workflow. The find stage is the **cross-read**, on the **auditor tier** per `/model-policy` (a run-once read whose misses nothing downstream catches): hold each resolution against the others, the destination, and Out of scope, hunting the findings list above; each finding (IDs `MR-<i>`, per-run) carries every resolution it holds in tension as the ticket's title, its Decisions-so-far gist, and the quoted sentence of the resolution comment that conflicts — the source fields the contract's assembler writes from. Dedup against prior `<!-- map-review summary -->` comments — a re-review after reopened tickets is incremental by construction: already-adjudicated tensions leave the queue there. Survivors get a **drafted repair** — the amendment text, the ticket to reopen, the portion to strike — validated adversarially like any finding.
3. **Route** by the contract's escalation test — **the finding's kind never decides this**; the list above says what to hunt. Derivable here, and so auto-applied: index drift (the ticket's own text is the proof), a dead link, a superseded call whose later resolution *explicitly* revisits and settles the same question, and a misfiling no ticket in the slice cites the decision for. A contradiction joins them only where the record itself refutes one side outright — a later resolution that governs the question, or the code — and no other decision leans on the refuted side; the losing text is corrected, and the audit digest carries it. Where both sides genuinely stand, it is a **tension** and escalates. Route gaps, undecided seams, scope leaks, and supersessions that require picking a winner are tensions by construction: the pipeline never picks a winner between two live decisions alone.
4. **The gate.** Escalations post as `<!-- map-review pending-questions -->` on the issue under review — the slice in slice mode, the map in map mode (the workflow's final stage), notify, and end the turn per the contract. The question loop — here or in a later session — walks the tensions one per turn per `/hitl-questions`: each side named by what it decided (the ticket's name in passing — titles are agent-written too), what each says, why they can't both stand, the drafted repair, and a recommendation. Verdicts act as:
   - **Amend** — the tension dissolves with a clarification: comment the amendment on the winning ticket(s) — it rides the same ticket, so `/specify`'s zoom picks it up — and correct the gist(s).
   - **Reopen** — something needs actual re-deciding: reopen the ticket, or create a fresh one (create-then-wire, per wayfinder), and update the map. The map is back in charting.
   - **Rule out of scope** — a scope leak: strike the leaked portion per wayfinder's Out of scope rules.
   - **Refile** — a misfiling: move the link between a slice and Map-wide decisions, or between slices, per wayfinder's filing rule. If the receiving slice is already sealed, this is a **breach** and routes by wayfinder's breach rule, not by editing a shipped slice's spec silently.
5. **Record and mark.** Post `<!-- map-review summary -->` on the reviewed issue — every finding ID with its terminal outcome, auto-applied edits included, per the contract. Then:
   - **No open tickets remain** (clean review, or every tension resolved by amendment): mark `slice-reviewed` in slice mode, `map-reviewed` in map mode, and point at `/specify <slice-or-map>`.
   - **Tickets were reopened or created**: do **not** mark. In slice mode, reopening a ticket the slice claims also unseals the slice — reopen it, since the seal asserted the slice was done. Say what went back into charting and point at `/next`. When those tickets close and `/next` routes back here, the summary comment is what scopes the re-review to the changed decisions and their interactions with the rest.

**Map mode runs late, and that is by design.** By the time the whole-map pass runs, slices have already specced and some have already shipped, so a finding that lands on a shipped slice cannot be a repair — it routes as a follow-up per wayfinder's breach rule. Escalate it anyway: knowing two shipped slices disagree is worth a ticket. This is the cost of shipping before charting finished, and it was paid knowingly at the seal.

All repairs land **as edits to the map and its tickets** — never a separate artifact. The map stays canonical: `/specify`'s input model doesn't change; it just gets a truer map.

## Rules

- **One invocation, one review.** One slice or one map, and marking then running `/specify` never share an invocation (`/next auto` chains invocations; the boundary it respects is the gate, not the session).
- **Tensions speak per `/hitl-questions`** — the domain language, cold-reader blocks, recommendations included.
- **Cheap by default.** The cross-read and validation are agent work; the human is spent only on real tensions. A coherent map costs one pass, an audit digest, and a one-line report — if nothing escalates, say so, mark, and stop. Cheap-by-default is what keeps this stage run rather than skipped.
