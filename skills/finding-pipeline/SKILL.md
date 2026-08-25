---
name: finding-pipeline
description: The find → validate → propose → validate → route contract every review gate runs — adversarial validation in chunked chains, schema-typed verdicts, edge-field routing, durable gate markers, question mechanics. Consult when running a review stage (/diff-review, /ship, /map-review, /spec-review), authoring or porting one, or resuming one from a pending-questions comment.
---

Every review gate in the chain — code gates (`/ship`'s wave verification, `/diff-review`) and document gates (`/map-review`, `/spec-review`) — runs the same pipeline. This skill states the invariants **once**; each gate skill defines only what is local to it: what a finding *is* (its axes or defect list), what applying a fix touches, its question classes and their option shapes, its model policy, and any workflow template it bundles. When a gate skill and this contract disagree on an invariant, this contract wins — fix the skill.

**The policy: escalate questions about intent, auto-resolve questions the record can answer.** The user is the intent authority, not a reviewer of the pipeline's work — a gate must never require them to hold the material in their head. Everything validated and uncontested resolves itself; what reaches the user is exactly the set of questions the pipeline *cannot* answer, because they are questions about what was meant. **The escalation test is the answer, not the wording: a question reaches the user only when their answer would change what gets built.** Source silence is not by itself a question — silence with exactly one defensible repair is a code question the pipeline answers itself; a block whose own recommendation admits every alternative is strictly worse has failed this test.

## The stages

Stage order is enforced by script, never discipline: run the pipeline as one dynamic `Workflow` (the gate skill invoking this contract is your authorization), so a proposer can never see a finding its validator refuted.

1. **Find.** Axis reviewers report findings. Each finding carries a per-run, axis-prefixed ID, a location anchor, a one-line description, and the **cited source** — the rule, spec line, decision, or resolution it holds the material against, carried as quoted text with its ID, never the ID alone (the cold-reader assembler at the end of the pipeline has only these fields to write from). A claim with no citable source is not a finding. Axes are never merged or reranked against each other.
2. **Dedup — against the adjudication memory.** Match conservatively against every prior summary comment (see *The gate*) and any open finding tickets: already adjudicated → out, one line in the summary; a new instance of a known pattern → stays in; uncertain → stays in, marked. A visible duplicate is recoverable; a silent suppression isn't. The memory is what makes repeated gates converge — no finding is ever re-litigated. The memory cuts a second way: **an answer the user gave at an earlier gate — a recorded verdict, the amendment it posted — is binding source text**, carried into the pipeline as classification input; a new finding that answer directly governs is not a new question — it classifies as divergence from the answer (cite it) and resolves like any code finding. Re-asking an answered question is the failure this stage exists to prevent.
3. **Validate the finding — adversarially, before any fix exists.** Validation by the finding's author is theater, and validating a finding only *through* its fix conflates two questions. Fresh validators that did not author the findings are prompted to **refute the finding itself** — one validator per chunk of ~5 findings, chunks in parallel, each chunk riding its own validate → propose → validate-fix chain with no cross-chunk barrier. Verdict: `finding-refuted` (with reason — leaves the pipeline, recorded so dedup remembers) or `finding-validated`.
4. **Propose a repair per survivor.** One proposer per chunk — chunk-mates share context, so overlapping repairs get drafted coherently. The smallest concrete repair, anchored by a short quoted snippet of what changes (never a bare line number — lines drift), sized `quick-fix` or `needs-a-session`. Where the finding admits more than one reading, a sketch per plausible reading — the user's answer picks one.
5. **Validate the repair — adversarially, independently.** Fresh validators again — not the proposers, not stage 3's validators — prompted to **refute the fix**: does it resolve the finding, is it proportionate, does it break the other axis? Verdict as an enum, never prose: `validated`, `fix-rejected` (reason), or `needs-human` (a genuine trade-off). The finding's reality is settled — doubt goes inside the `fix-rejected` reason, and the finding still escalates. This stage has the last word on any contested flag — and a flag that widens a finding beyond the material under review counts only instances the cited source actually governs: the rule's own scope and grandfather clauses bound the count, never the raw grep. It fills two **edge fields** as schema fields, never prose: `dependsOn: [IDs]` and `invalidatedBy: [IDs]`.
6. **Route — plain script logic over the schema fields; no agent decides this.** Escalate when any of the gate skill's intent conditions hold; otherwise auto-apply `validated` + `quick-fix`; otherwise auto-ticket. One narrowing of the intent conditions is contractual for code gates: a `validated` `quick-fix` marked **doc-only** — the repair touches comments, docs, or headers alone, no executable behaviour — auto-applies even where the finding's classification would otherwise escalate; when the only defensible change is to the record, there is no intent question left to ask, and the audit digest lists it one revert away like any auto-apply. Edges route together: a repair whose `dependsOn` target escalated joins that escalation as context; one `invalidatedBy` an applied sibling gets its stale premise re-grounded before applying.

**The auto-apply bar is the gate's net.** Code gates apply under the test-suite net — a serial fix agent, one revertible commit per finding ID, full suite at the end, breakers reverted and re-escalated as *no working fix*. Document gates (map, spec) have no suite, so they auto-apply only the **provably derivable** repair — the record already contains the answer: an explicit later ruling, the cited ticket's own text, the code the claim is about — and every auto-edit is listed in the audit digest the next gate's orientation opens with, *before* anything builds on it. A repair that adds, removes, or picks among readings of a decision is never derivable — it escalates.

## The gate

All gate state lives as comments on the issue the stage operates on, each opening with a machine-findable marker named for the skill (scoped where the skill runs repeatedly, as ship's `wave-<n>` is):

- `<!-- <skill> pending-questions -->` — posted by the **workflow's final stage**, not the manager, so the queue is durable even if the session dies the moment the workflow returns. Carries the full question blocks plus the audit digest of auto-actions.
- `<!-- <skill> summary -->` — posted after adjudication: **every** finding ID with its terminal outcome — auto-applied, auto-ticketed, refuted (one-line reason), answered (verdict and what it triggered), reverted, left as-is, unanswered. Completeness here is what makes the loop converge; an outcome not recorded will be re-found and re-asked.

**A pending-questions comment with no matching summary is a resume point**: any session — this one or a later `/next` — bootstraps onto it and runs the question loop from the comment alone, never by re-running the pipeline.

When escalations exist, the gate goes **AFK**: send a push notification (load via `ToolSearch("select:PushNotification")`; skip silently if unavailable) and end the turn — the user answers here or in a fresh session, identically. No escalations → post the summary and the stage completes without a pause.

## Question mechanics

**Open with the orientation summary** — the audit digest first, stated as *done*, not proposed: found → refuted → auto-applied (IDs + SHAs or edits) → auto-ticketed (#s). The user overrides any of it by free text (`revert W2-STD-7`) and the manager reverts that commit, edit, or ticket. Then the escalation count by question class — never the question blocks themselves.

**Every block obeys the presentation contract in `/hitl-questions`** — the cold-reader rules, the domain language, the recommendation, the `AskUserQuestion` mechanics, the escape hatches. Every artifact in this chain is agent-written and the question loop is often the user's first contact with the material, so the contract's cold-reader test bites hardest here: someone who joined the project today must be able to pick an option from the block alone.

**One question per turn**, in the order later work most likely builds on. Per escalation, print its block (anchors and excerpts arrive on request, via `explain`):

```
### <ID> — <question class> — <i> of <n>
- **The situation:** <1–2 sentences of orientation, assuming nothing>
- **The question:** <one line, in the domain's terms>
- **What the source says:** <what the cited line governs, then the quote — never a bare ID; or "the source is silent here">
- **What the material does today:** <one line>
- **Why it needs you:** <the gate skill's question class>
- **Options:** <each as an outcome, with its consequence and what it triggers>
- **Recommendation:** <the option you'd pick and the one-line why>
```

— then ask with `AskUserQuestion` per the contract. The contract's escape hatches bind here as: `explain` gets its answer, then the same ID is re-asked; batched verdicts are taken as given; "stop" records every untouched ID as `unanswered` and goes to the wrap-up.

**Act on the collected answers after the loop, none mid-loop**: post the source amendments the verdicts chose, run one serial fix agent for repairs the answers unlocked (re-grounding each proposal against the current state by its quoted snippet), file the tickets called for, revert what the audit overrode. Then post the summary comment.

## Workflow authoring invariants

- Every stage gets a `schema` — verdicts, classifications, flags, and edges come back as typed fields, never prose the manager interprets; the routing step depends on it.
- **Fill, don't thread.** Nothing goes through `args` — it has arrived as a JSON *string*, turning interpolations into the literal `undefined` without failing loudly. Bake inputs into the script at fill time, prose as JSON string literals (double-quoted, `\n`-escaped), which no code span or apostrophe can terminate.
- Chunks ride independent `pipeline` chains; the only deliberate barriers are the routing step, the serial fix agent, and the ledger post.
- The pending-questions post is the workflow's final stage (durability before any answer, per *The gate*), authored by a **fresh assembler agent** handed only the findings' structured fields — never the spec, map, or diff. An agent that doesn't hold the context can't lean on it: anything it can't explain to a cold reader it must expand from the cited source text the finding carries. This is what enforces the cold-reader invariant structurally — which in turn means find and validate schemas must carry the source *text*, not just its ID.
- **The fill may be delegated.** A gate's fill inputs are all tracker-sourced, so a fresh **fill agent** can read them, write the filled script to a file, and return the path plus a one-line manifest — the manager launches with `Workflow({scriptPath})` and its context never holds the fill. Under `/next auto` this is the rule, not an option.
