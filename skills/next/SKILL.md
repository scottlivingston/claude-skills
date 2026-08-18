---
name: next
description: Advance an effort by exactly one unit of work. Reads the issue tracker to find where the effort stands — charting, working the map, map review, spec, spec review, tickets, shipping — then routes to the right stage skill. Start an effort with /wayfinder; after that, just keep invoking /next. `/next auto <effort> [merge]` conducts every remaining stage end to end, pausing only at gates.
disable-model-invocation: true
---

One command for the whole wayfinder → map-review → specify → spec-review → tickets → ship chain. The tracker is the memory, so the current stage is never remembered — it is **queried**: this skill reads the effort's state off the tracker, announces the stage, and runs that stage's skill. Each invocation does **one stage's unit of work**, sized to this session, then stops and says `/next` again — unless **auto mode** (below) is conducting, in which case it routes onward and pauses only at gates.

`/next` is a router, not a stage. Everything below routes *into* an existing skill — read that skill and follow it; never improvise a stage inline. For tracker operations, invoke `/issue-tracker` — its "Which tracker?" section resolves which implementation this repo uses.

## Find the effort

The argument, if given, is a **map** or **spec** issue (URL or number). Without one, discover: query open issues labelled `wayfinder:map` and open issues labelled `spec`.

- Exactly one live effort → use it.
- Several → ask the user which (by name, per wayfinder's refer-by-name rule).
- None → `/next` has nothing to advance. Charting needs the loose idea, which lives in the human's head, not the tracker — point at `/wayfinder <idea>` and stop.

A **closed map** isn't a dead end: `/specify` comments the spec's link on the map before closing it. Follow that link and route on the spec. Likewise a spec's stage depends on its `impl` sub-issues, fetched fresh each invocation.

## Reconcile before routing

Background agents and parallel sessions may have finished work no one folded in. Before choosing anything, heal the record:

- **Map**: any closed child ticket missing from Decisions-so-far → fold it now (append the pointer, graduate fog it made specifiable, rule out-of-scope what it exposed), per the wayfinder skill. This session is the map's single writer.
- **Stale claims**: an open ticket labelled `in-progress` may be live in another session — never steal it silently. If the user says it's abandoned, unclaim it.

## Route

First state that matches, top to bottom:

| Tracker state | Stage | Do |
| --- | --- | --- |
| Map open, open child tickets exist | Working the map | See [Working the map](#working-the-map) below |
| Map open, no open children, Not-yet-specified non-empty | Still charting | A wayfinder session: graduate what's now specifiable into tickets (create-then-wire), then stop |
| Map open, `<!-- map-review pending-questions -->` comment with no matching summary | Map review gated | Resume `/map-review`'s question loop from the comment (per `/finding-pipeline`) — never re-run its pipeline |
| Map open, no open children, Not-yet-specified empty, no `map-reviewed` marker | Map complete, unreviewed | `/map-review <map>` — the pipeline is agent work; tensions escalate at its gate |
| Map open, no open children, Not-yet-specified empty, `map-reviewed` marker | Map reviewed | `/specify <map>` |
| Spec open, no `impl` sub-issues, `<!-- spec-review pending-questions -->` comment with no matching summary | Spec review gated | Resume `/spec-review`'s question loop from the comment (per `/finding-pipeline`) — never re-run its pipeline |
| Spec open, no `impl` sub-issues, no `spec-reviewed` marker | Spec unreviewed | `/spec-review <spec>` — the pipeline is agent work; defects escalate at its gate |
| Spec open, no `impl` sub-issues, `<!-- tickets pending-questions -->` comment with no matching summary | Breakdown gated | Resume `/tickets`' gate questions from the comment |
| Spec open, no `impl` sub-issues, `spec-reviewed` marker | Needs breakdown | `/tickets <spec>` — HITL; the quiz is the human's approval gate (skipped in auto mode, per that skill) |
| Spec open, `impl` sub-issues with spec-gap comments on parked tickets | Spec gap | Sit with the human on the gap (grill, grounded in the domain model); record the decision on the spec — as a new indexed decision cited by the ticket, when the spec has a Decision Index (per `/specify` and the tracker doc) — and unpark the ticket |
| Spec open, open `impl` sub-issues | Shipping | `/ship <spec>` (or `/implement` for one frontier ticket, if the user prefers stepping) |
| Spec open, all `impl` sub-issues closed | Closing | `/ship <spec>` — its bootstrap finds the frontier empty and runs the closing pass over the whole branch (or, if the last closing summary is clean, offers the PR that `Closes #<spec>`) |
| Spec closed | Done | Say so. There is no next. |

## Working the map

The one stage `/next` composes rather than delegates whole, because the frontier splits by mode:

1. **Query the frontier**: open, unblocked, unclaimed children.
2. **Drain the AFK frontier in the background.** Claim every frontier ticket labelled `afk`, then spawn one background agent per ticket, exactly per the `/drain` skill (its selection, claiming, and agent-brief rules apply verbatim). Fire and forget — the agents post resolutions and close their tickets; do not wait on them.
3. **Sit in the first HITL frontier ticket.** Claim it, then resolve it with the human per the wayfinder skill — one ticket, this invocation, never more. If the frontier has no HITL ticket, this session is the drain coordinator instead: fold results as agents finish, loop the AFK frontier until it's dry, then report the HITL queue.
4. **Fold as you go.** When a drain agent finishes mid-conversation, fold its result into the map between questions — a single map writer beats a parallel drain session racing this one. Results still pending when the session ends are caught by the next invocation's reconcile step.

## Auto mode

`/next auto <map-or-spec> [merge]` **conducts** the chain instead of stopping after one stage: route, announce the stage in one line, run that stage as its own invocation, and when it completes, route again — until the spec closes or a gate needs the human. The word `merge` in the invocation (the literal word, or an equivalent as unambiguous — a vague "finish it" grants nothing) is the **merge authorization**: when ship's closing pass comes back clean and the spec has no open children, open the PR whose body `Closes #<spec>` and squash-merge it without a fresh prompt.

- **Auto-config is durable.** First act: post `<!-- next-auto config -->` on the effort's head issue — auto mode active, merge authorization yes or no. When `/specify` creates the spec, re-post it there. Any `/next` invocation that finds an active auto-config resumes conducting after clearing whatever gate it lands on; the user cancels by saying so, recorded as a follow-up auto-config comment. The merge authorization is **void** if any closing-pass spec-axis question was answered "leave as-is" — merge-on-clean means clean — and a void or absent authorization falls back to offering the PR.
- **Coverage starts at map-complete.** Routed to *Working the map*, auto mode declines: charting is a conversation, not a conveyor. Say so, drain the AFK frontier per that section, and stop.
- **Gates are the only pauses.** Each stage's own gate (per `/finding-pipeline`) posts its pending-questions durably, notifies, and ends the turn; `/tickets` skips its quiz per that skill. A clean stage rolls into the next with nothing but the one-line announcement.
- **The conductor conducts — stage substance never enters its context.** For the whole run it holds this skill, `/finding-pipeline`, and `/issue-tracker`; everything heavier is delegated:
  - **Fill agents.** Every workflow fill — ship waves, closing passes, review pipelines — runs in a fresh subagent that reads its inputs off the tracker (they are all tracker-sourced by construction), writes the filled script to a file, and returns only the path plus a one-line manifest (stage, wave, agent count). The conductor launches with `Workflow({scriptPath})` and reads the typed return.
  - **Whole-stage subagents** for the conversation-free stages: `/specify`, and `/tickets` through critic and publish, each run entirely inside a subagent that invokes the stage skill and returns one line. The conductor never loads those skills.
  - **Question loops run lean.** Any gate's loop runs in the conductor from the pending-questions comment plus `/finding-pipeline`'s mechanics — the blocks are pre-drafted there for exactly this — never by loading the stage skill that produced them.
  - Ticket bodies, finding queues, and spec text are re-read from the tracker at each boundary, exactly the reconcile discipline above. That, plus delegation, is what makes an arbitrarily long roll safe to summarize mid-session.
- **Stalls are gates too.** A structural signal — ship's convergence guard, a second DAG-critic failure, repeat escalations of one class — escalates immediately, carrying its diagnosis (recurring `spec-suspect` means the spec is systematically under-specified; a recurring pattern means a standard is waiting to be written). A transient mechanical failure — an agent died, a flaky suite — gets exactly one retry. Either way the stop is durable before the turn ends: a stall report comment on the effort's head issue — the stage, what was attempted, the signal, what's needed to resume — then notify.

## Rules

- **One stage per invocation.** Never compress two stages into one session — finishing `/specify` does not mean starting `/tickets`. The sizing is the point; end by saying `/next`. (Auto mode is the sanctioned exception: it chains invocations, one stage each, and pauses only at gates.)
- **Re-invocation in a live session is fine — make the budget call out loud.** One ticket per invocation is the unit; one ticket per *context window* is not a rule. When the human says `/next` again in the same session, don't balk and don't re-read skill files already in context — just route again. After each ticket, state the posture: a light ticket with plenty of room → invite another `/next` here; a heavy one → say so and recommend `/clear` first.
- **Never jump a gate.** Route *into* the `/tickets` quiz, never past it; never resolve a HITL ticket without the human; never auto-approve on the human's behalf.
- **Announce the stage before acting** — "the map has 4 open tickets, 2 AFK; draining those and sitting with you on <ticket name>" — so the human always knows where the effort stands without reading the tracker.
