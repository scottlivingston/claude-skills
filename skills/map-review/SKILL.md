---
name: map-review
description: Cross-read a completed wayfinder map — every resolution in full, as one body of decisions — before /specify turns it into a spec. Hunts contradictions, superseded calls, route gaps, undecided seams, and drifted gists through the finding pipeline — derivable repairs auto-applied to the map, only genuine tensions escalated at a durable gate — and a coherent map is marked map-reviewed. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

A map is **complete** when its frontier is empty — but complete is a mechanical fact, not a semantic one. The map's decisions were made in separate sessions, possibly weeks apart, possibly in parallel; no single context has ever held all the resolutions at once. And the next stage, `/specify`, is forbidden to interview: handed a contradiction, it papers over it by silently picking a side. This skill is the one session that reads **every resolution in full, together, before the spec exists** — the cross-decision view no charting session had.

It is the planning-side mirror of `/diff-review`: that skill reviews what came out of ship; this one reviews what feeds the spec. Both run the pipeline in `/finding-pipeline` — the invariants (adversarial validation, routing, gate markers, question mechanics) live there; what's here is what a map finding is and what repairing one touches.

For tracker operations, invoke `/issue-tracker`.

## Precondition

The argument is a `wayfinder:map` issue (URL or number), and the map must be complete: no open child tickets, **Not yet specified** empty. Anything still open means charting isn't done — stop, say so, and point at `/next`.

## Not a second grilling

Every decision on the map already survived its own HITL session. Its **merits are settled** — this skill never re-litigates whether a decision was right, only whether the decisions **compose**. The findings hunted here are exactly the ones no per-ticket session could see:

- **Contradiction** — two resolutions that can't both hold.
- **Superseded decision** — an early call made without context a later resolution established, and never revisited.
- **Route gap** — the decisions don't add up to a clear way to the destination; something between two of them was never actually decided. Frontier-empty is not way-clear.
- **Undecided seam** — the map settles behaviour but leaves the seams genuinely open, which `/specify` would otherwise discover mid-synthesis.
- **Scope leak** — a resolution that quietly decided something past the destination, or ruled on ground the map's Out-of-scope section already excluded.
- **Index drift** — a Decisions-so-far gist that no longer says what its ticket actually resolved (mechanical: the spec is synthesized from the zoomed tickets, but humans navigate by the gists).

If the human, shown a tension, decides an underlying decision was simply wrong — reopening on merits is their call, and it routes back to charting. This skill never initiates a merits fight.

## Process

1. **Load the map, then zoom everything**: fetch every closed child ticket's body and resolution comments — all of them, not a sample. The full read is the entire point of this stage. On a large map, batch by area and carry a running digest of decided facts and suspected tensions between batches, but never skip a ticket.
2. **Run the pipeline** per `/finding-pipeline`, as one dynamic workflow. The find stage is the **cross-read**: hold each resolution against the others, the destination, and Out-of-scope, hunting the findings list above; each finding cites the resolutions it holds in tension (IDs `MR-<i>`, per-run). Dedup against prior `<!-- map-review summary -->` comments — a re-review after reopened tickets is incremental by construction: already-adjudicated tensions leave the queue there. Survivors get a **drafted repair** — the amendment text, the ticket to reopen, the portion to strike — validated adversarially like any finding.
3. **Route.** Auto-apply is the document bar — **provably derivable only**: index drift (the ticket's own text is the proof), a dead link, a superseded call whose later resolution *explicitly* revisits and settles the same question. Everything else — contradictions, route gaps, undecided seams, scope leaks, supersessions that require picking a winner — is a **tension**, and tensions escalate; the pipeline never adjudicates one alone.
4. **The gate.** Escalations post as `<!-- map-review pending-questions -->` on the map (the workflow's final stage), notify, and end the turn per the contract. The question loop — here or in a later session — walks the tensions one per turn per `/hitl-questions`: tickets referred to by name, what each side says, why they can't both stand, the drafted repair, and a recommendation. Verdicts act as:
   - **Amend** — the tension dissolves with a clarification: comment the amendment on the winning ticket(s) — it rides the same ticket, so `/specify`'s zoom picks it up — and correct the gist(s).
   - **Reopen** — something needs actual re-deciding: reopen the ticket, or create a fresh one (create-then-wire, per wayfinder), and update the map. The map is back in charting.
   - **Rule out of scope** — a scope leak: strike the leaked portion per wayfinder's Out-of-scope rules.
5. **Record and mark.** Post `<!-- map-review summary -->` on the map — every finding ID with its terminal outcome, auto-applied edits included, per the contract. Then:
   - **No open tickets remain** (clean review, or every tension resolved by amendment): mark the map `map-reviewed` and point at `/specify <map>`.
   - **Tickets were reopened or created**: do **not** mark. Say what went back into charting and point at `/next`. When those tickets close and `/next` routes back here, the summary comment is what scopes the re-review to the changed decisions and their interactions with the rest.

All repairs land **as edits to the map and its tickets** — never a separate artifact. The map stays canonical: `/specify`'s input model doesn't change; it just gets a truer map.

## Rules

- **One invocation, one review.** Marking `map-reviewed` and running `/specify` never share an invocation (`/next auto` chains invocations; the boundary it respects is the gate, not the session).
- **Tensions speak per `/hitl-questions`** — the domain language, cold-reader blocks, recommendations included.
- **Cheap by default.** The cross-read and validation are agent work; the human is spent only on real tensions. A coherent map costs one pass, an audit digest, and a one-line report — if nothing escalates, say so, mark, and stop. Cheap-by-default is what keeps this stage run rather than skipped.
