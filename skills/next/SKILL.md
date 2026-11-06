---
name: next
description: Advance an effort by exactly one unit of work — read the tracker, announce the stage, run that stage's skill. `/next auto <effort> [merge]` conducts every remaining stage end to end, from a freshly charted map to a merged PR, pausing only for escalations.
disable-model-invocation: true
---

One command for the whole wayfinder → map-review → specify → spec-review → tickets → ship chain. The tracker is the memory, so the current stage is never remembered — it is **queried**: this skill reads the effort's state off the tracker, announces the stage, and runs that stage's skill. Each invocation does **one stage's unit of work**, sized to this session, then stops and says `/next` again — unless **auto mode** (below) is conducting, in which case it routes onward and pauses only at gates.

`/next` is a router, not a stage. Everything below routes *into* an existing skill — read that skill and follow it; never improvise a stage inline. For tracker operations, invoke `/issue-tracker` — its "Which tracker?" section resolves which implementation this repo uses.

## Find the effort

The argument, if given, is a **map**, **slice**, or **spec** issue (URL or number). Without one, discover: query open issues labelled `wayfinder:map` and open issues labelled `spec`.

- Exactly one live effort → use it.
- Several → ask the user which (by name, per wayfinder's refer-by-name rule).
- None → `/next` has nothing to advance. Charting needs the loose idea, which lives in the human's head, not the tracker — point at `/wayfinder <idea>` and stop.

A **closed map** isn't a dead end: follow the map's or slices' spec links and route on the specs. Likewise a spec's stage depends on its `impl` sub-issues, fetched fresh each invocation.

**A sliced map has more than one live spec**, one per slice, in different stages at once. Load the map's `wayfinder:slice` children and take them **in ship order** (the blocking edges between them); the first slice with outstanding work is the one this invocation advances. A slice whose spec is closed is done and skipped. When two slices are genuinely takeable, say which you took and what else was available — the human may want the other.

## Reconcile before routing

Background agents and parallel sessions may have finished work no one folded in. Before choosing anything, heal the record:

- **Map**: any closed ticket not yet folded — a deciding ticket of record missing from Decisions so far (per `/wayfinder`; superseded tickets and Stands/Amend reconsiderations never are), or a `## Map changes proposed` section never applied → fold it now, per `/wayfinder`'s folding rule. While a drain coordinator holds the map's claim, leave folding to it.
- **Friction**: any decision carrying the `friction` marker that meets `/wayfinder`'s reconsideration trigger → open its reconsider ticket now.
- **Stale claims**: an open ticket labelled `in-progress` may be live in another session — never steal it silently. If the user says it's abandoned, unclaim it.

## Route

First state that matches, top to bottom:

Sealed slices are checked **before** the map rows: delivering committed work outranks more charting, and a sealed slice's spec only goes stale while it waits. "Open children" below always means open **ticket** children — slices are children too and never count (per `/issue-tracker`'s frontier query).

**Gates first.** Each issue's gate is checked before that issue's other rows: when a sealed slice, the map, or a spec carries a `<!-- <stage> pending-questions -->` comment with no matching summary (`map-review`, `spec-review`, `tickets`, `diff-review`, `ship wave-<n>`, `ship closing-<k>`), that stage is gated: never re-run its pipeline or wave — resume its question loop per `/finding-pipeline`, which says who answers it.

**Escalations next.** An open ticket labelled `hitl` carrying an `<!-- escalation -->` comment, or a gate block an agent escalated, waits for the human. With the human present (outside auto mode, or when nothing else can move), sit with them on the first one per `/wayfinder` — one per invocation; otherwise route past it.

| Tracker state | Stage | Do |
| --- | --- | --- |
| Sealed slice, no `slice-reviewed` marker | Slice unreviewed | `/map-review <slice>` — the pipeline is agent work; tensions escalate at its gate |
| Sealed slice, `slice-reviewed` marker, no spec linked | Slice ready to spec | `/specify <slice>` |
| Sealed slice with a spec | Slice in delivery | Route on that spec, using the spec rows below |
| Map open, a checkpoint due per `/wayfinder` | Checkpoint | `/map-review <map> checkpoint` |
| Map open, `afk` frontier tickets exist | Working the map | `/drain <map>` |
| Map open, open tickets but none takeable (all blocked, claimed, or escalated) | Waiting | Say what each is waiting on — a running agent, an escalation — and stop |
| Map open, no open children, Not yet specified non-empty | Still charting | `/wayfinder`'s charting pass, as coordinator |
| Map open, no open children, Not yet specified empty, closed tickets unfiled or a slice unsealed | Charting done, partition open | A coordinator pass: file the remaining resolutions, then seal each unsealed slice per `/wayfinder`'s sealing rule |
| Map complete per `/wayfinder`, no `map-reviewed` marker | Map complete, unreviewed | `/map-review <map>` — the whole-map pass |
| Map open, complete, `map-reviewed` marker, unsliced | Map reviewed | `/specify <map>` |
| Spec open, no `impl` sub-issues, no `spec-reviewed` marker | Spec unreviewed | `/spec-review <spec>` — the pipeline is agent work; defects escalate at its gate |
| Spec open, no `impl` sub-issues, `spec-reviewed` marker | Needs breakdown | `/tickets <spec>` — HITL; the quiz is the human's approval gate (skipped in auto mode, per that skill) |
| Spec open, a parked `impl` sub-issue with its gap commented on the spec | Spec gap | On a spec descending from a map, a decider agent fills the gap per `/deciding` — escalating only in its three cases — and posts friction on any map decision the gap traces to; on any other spec, sit with the human on it (load `/grilling` and `/domain-modeling`). Record the decision on the spec — as a new indexed decision cited by the ticket, when the spec has a Decision Index (per `/specify` and the tracker doc) — and unpark the ticket |
| Spec open, open `impl` sub-issues | Shipping | `/ship <spec>` (or `/implement` for one frontier ticket, if the user prefers stepping) |
| Spec open, all `impl` sub-issues closed | Closing | `/ship <spec>` — its bootstrap finds the frontier empty and runs the closing pass over the whole branch (or, if the last closing summary is clean, offers the PR that `Closes #<spec>`) |
| Spec closed, other slices outstanding | Slice done | Say so, then route on the next slice in ship order |
| Spec closed, nothing outstanding | Done | Say so. There is no next. |

## Auto mode

`/next auto <effort> [merge]` **conducts** the chain instead of stopping after one stage: route, announce the stage in one line, run that stage as its own invocation, and when it completes, route again — until the last spec closes or only escalations remain. The word `merge` in the invocation (the literal word, or an equivalent as unambiguous — a vague "finish it" grants nothing) is the **merge authorization**: when ship's closing pass comes back clean and the spec has no open children, open the PR whose body `Closes #<spec>` and squash-merge it without a fresh prompt.

- **Auto-config is durable.** First act: post `<!-- next-auto config -->` on the effort's head issue — auto mode active, merge authorization yes or no. When `/specify` creates the spec, re-post it there. Any `/next` invocation that finds an active auto-config resumes conducting after clearing whatever gate it lands on; the user cancels by saying so, recorded as a follow-up auto-config comment. The merge authorization is **void** if any closing-pass spec-axis question was answered "leave as-is" — merge-on-clean means clean — and a void or absent authorization falls back to offering the PR.
- **Coverage starts at a charted map.** Charting is the human's session (per `/wayfinder`); from the map's creation onward auto mode conducts everything — draining, folding, checkpoints, reconsiderations, sealing, and every slice's delivery. Sealed slices are delivered **one at a time, in ship order**, while the map keeps draining: the drain coordinator runs as its own background subagent beside delivery, so the sealed-slice rows' precedence never starves charting; re-post the auto-config on each new spec as it is created.
- **Escalations don't stop the run.** An escalation is durable on its ticket or gate and notified when raised; the conductor routes around it and stops only when nothing else can move — then it reports the escalation queue and ends the turn. The human's answer, in any session, resumes the run.
- **Gates are answered, not waited on.** Each stage's own gate posts its pending-questions durably and is answered per `/finding-pipeline`; only escalations wait. `/tickets` skips its quiz per that skill. A clean stage rolls into the next with nothing but the one-line announcement.
- **The conductor conducts — stage substance never enters its context.** It loads at the start of the run, and holds for its whole length, this skill, `/finding-pipeline`, `/deciding`, `/hitl-questions`, `/issue-tracker`, and `/model-policy`; everything heavier is delegated, each subagent on its tier per `/model-policy` — fill agents are executors, whole-stage subagents are deciders:
  - **Fill agents.** Every workflow fill — ship waves, closing passes, review pipelines — runs in a fresh subagent that reads its inputs off the tracker; the filled script and its inputs never enter the conductor's context, which launches the workflow and reads only its typed return.
  - **Whole-stage subagents** for the conversation-free stages: `/drain` coordination, `/specify`, and `/tickets` through critic and publish, each run entirely inside a subagent that invokes the stage skill and returns one line. The conductor never loads those skills.
  - **Question loops run lean.** A gate the agent answers runs in a decider subagent handed the pending-questions comment and `/deciding`. A loop with the human runs in the conductor from the pending-questions comment plus `/finding-pipeline`'s gate mechanics and `/hitl-questions` — the blocks are pre-drafted there as the notes the loop talks from — never by loading the stage skill that produced them.
  - Ticket bodies, finding queues, and spec text are re-read from the tracker at each boundary, exactly the reconcile discipline above, so a long roll is safe to summarize mid-session.
- **Stalls are gates too.** A structural signal — ship's convergence guard, a second DAG-critic failure, repeat escalations of one class, the same decision reconsidered twice — escalates immediately, carrying its diagnosis (recurring `spec-suspect` means the spec is systematically under-specified; a recurring pattern means a standard is waiting to be written; a decision that keeps being reconsidered means the principles or design underneath it don't settle it). A transient mechanical failure — an agent died, a flaky suite — gets exactly one retry. Either way the stop is durable before the turn ends: a stall report comment on the effort's head issue — the stage, what was attempted, the signal, what's needed to resume — then notify.

## Rules

- **One stage per invocation.** Never compress two stages into one session — finishing `/specify` does not mean starting `/tickets`. The sizing is the point; end by saying `/next`. (Auto mode is the sanctioned exception: it chains invocations, one stage each, and pauses only for escalations.)
- **Re-invocation in a live session is fine — make the budget call out loud.** One ticket per invocation is the unit; one ticket per *context window* is not a rule. When the human says `/next` again in the same session, don't balk and don't re-read skill files already in context — just route again. After each ticket, state the posture: a light ticket with plenty of room → invite another `/next` here; a heavy one → say so and recommend `/clear` first.
- **Never jump an escalation.** An escalated ticket or gate block is resolved only with the human. Outside auto mode, route *into* the `/tickets` quiz, never past it — auto mode's skipped quiz is an approval the human delegated by asking for it.
- **Announce the stage before acting** — "the map has 6 open tickets, 4 takeable; draining those, and one escalation is waiting on you: <ticket name>" — so the human always knows where the effort stands without reading the tracker.
