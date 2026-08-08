---
name: map-review
description: Cross-read a completed wayfinder map — every resolution in full, as one body of decisions — before /to-spec turns it into a spec. Hunts contradictions, superseded calls, route gaps, undecided seams, and drifted gists; fixes land as edits to the map and its tickets, and a coherent map is marked map-reviewed. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

A map is **complete** when its frontier is empty — but complete is a mechanical fact, not a semantic one. The map's decisions were made in separate sessions, possibly weeks apart, possibly in parallel; no single context has ever held all the resolutions at once. And the next stage, `/to-spec`, is forbidden to interview: handed a contradiction, it papers over it by silently picking a side. This skill is the one session that reads **every resolution in full, together, before the spec exists** — the cross-decision view no charting session had.

It is the planning-side mirror of `/review`: that skill reviews what came out of ship; this one reviews what feeds the spec.

For tracker operations, invoke `/issue-tracker`.

## Precondition

The argument is a `wayfinder:map` issue (URL or number), and the map must be complete: no open child tickets, **Not yet specified** empty. Anything still open means charting isn't done — stop, say so, and point at `/next`.

## Not a second grilling

Every decision on the map already survived its own HITL session. Its **merits are settled** — this skill never re-litigates whether a decision was right, only whether the decisions **compose**. The findings hunted here are exactly the ones no per-ticket session could see:

- **Contradiction** — two resolutions that can't both hold.
- **Superseded decision** — an early call made without context a later resolution established, and never revisited.
- **Route gap** — the decisions don't add up to a clear way to the destination; something between two of them was never actually decided. Frontier-empty is not way-clear.
- **Undecided seam** — the map settles behaviour but leaves the seams genuinely open, which `/to-spec` would otherwise discover mid-synthesis.
- **Scope leak** — a resolution that quietly decided something past the destination, or ruled on ground the map's Out-of-scope section already excluded.
- **Index drift** — a Decisions-so-far gist that no longer says what its ticket actually resolved (mechanical: the spec is synthesized from the zoomed tickets, but humans navigate by the gists).

If the human, shown a tension, decides an underlying decision was simply wrong — reopening on merits is their call, and it routes back to charting. This skill never initiates a merits fight.

## Process

1. **Load the map, then zoom everything**: fetch every closed child ticket's body and resolution comments — all of them, not a sample. The full read is the entire point of this stage. On a large map, batch by area and carry a running digest of decided facts and suspected tensions between batches, but never skip a ticket.
2. **Cross-read** against the findings list above, holding each resolution against the others, the destination, and Out-of-scope.
3. **Triage findings by kind**:
   - **Mechanical** (index drift, a stale map section, a dead link): fix now, silently, as map edits. Not worth human time.
   - **Tension** (everything else): escalate to the human, **one at a time** — this is a HITL session, and the agent never adjudicates a tension alone. Present each per the wayfinder HITL rules — the project's domain language, tickets referred to by name: what each side says, why they can't both stand, and a recommendation. Get the verdict, act on it, then raise the next.
4. **Apply verdicts as edits to the map and its tickets** — never as a separate artifact. The map stays canonical: `/to-spec`'s input model doesn't change; it just gets a truer map.
   - **Amend** — the tension dissolves with a clarification: comment the amendment on the winning ticket(s) — it rides the same ticket, so `/to-spec`'s zoom picks it up — and correct the gist(s).
   - **Reopen** — something needs actual re-deciding: reopen the ticket, or create a fresh one (create-then-wire, per wayfinder), and update the map. The map is back in charting.
   - **Rule out of scope** — a scope leak: strike the leaked portion per wayfinder's Out-of-scope rules.
5. **Record and mark.** Comment a review summary on the map — findings, verdicts, what was amended — so the record lives on the tracker. Then:
   - **No open tickets remain** (clean review, or every finding resolved by amendment): mark the map `map-reviewed` and point at `/to-spec <map>`.
   - **Tickets were reopened or created**: do **not** mark. Say what went back into charting and point at `/next`. When those tickets close and `/next` routes back here, the re-review is incremental — the prior review comment scopes it to the changed decisions and their interactions with the rest.

## Rules

- **One invocation, one review.** Marking `map-reviewed` and running `/to-spec` never share a session.
- **Tensions speak the domain language** — capabilities and concepts, never file paths; `/domain-expansion` when the question lands on unfamiliar terrain.
- **Cheap by default.** The cross-read is agent work; the human is spent only on real tensions. A coherent map costs one pass and a one-line report — if nothing is flagged, say so, mark, and stop. Cheap-by-default is what keeps this stage run rather than skipped.
