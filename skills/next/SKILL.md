---
name: next
description: Advance an effort by exactly one unit of work — read the tracker, announce the stage, run that stage's skill. `/next auto <spec> [merge]` conducts every remaining stage end to end, to a merged PR, pausing only for escalations.
disable-model-invocation: true
---

One command for the specify → spec-review → tickets → ship chain. The tracker is the memory, so the current stage is never remembered — it is **queried**: this skill reads the effort's state off the tracker, announces the stage, and runs that stage's skill. Each invocation does **one stage's unit of work**, sized to this session, then stops and says `/next` again — unless **auto mode** (below) is conducting, in which case it routes onward and pauses only at gates.

`/next` is a router, not a stage. Everything below routes *into* an existing skill — read that skill and follow it; never improvise a stage inline. For tracker operations, invoke `/issue-tracker` — its "Which tracker?" section resolves which implementation this repo uses.

## Find the effort

The argument, if given, is a **spec** issue (URL or number). Without one, discover: query open issues labelled `spec`.

A spec labelled `wayfinder:plan` is a `/wayfinder` effort, which conducts itself: route it to `/wayfinder <plan>` and stop.

- Exactly one live effort → use it.
- Several → ask the user which (by name — the title wrapping its link).
- None → `/next` has nothing to advance — point at `/specify` for a conversation worth speccing, or `/wayfinder <idea>` for an effort to build on its own, and stop.

A spec's stage depends on its `impl` sub-issues, fetched fresh each invocation.

## Reconcile before routing

Before choosing anything, heal the record:

- **Stale claims**: an open ticket labelled `in-progress` may be live in another session — never steal it silently. If the user says it's abandoned, unclaim it.

## Route

First state that matches, top to bottom:

**Gates first.** Each issue's gate is checked before that issue's other rows: when a spec carries a `<!-- <stage> pending-questions -->` comment with no matching summary (`spec-review`, `tickets`, `diff-review`, `ship wave-<n>`, `ship closing-<k>`), that stage is gated: never re-run its pipeline or wave — resume its question loop per `/finding-pipeline`, which says who answers it.

**Escalations next.** A gate block an agent escalated waits for the human. With the human present (outside auto mode, or when nothing else can move), sit with them on the first one — one per invocation; otherwise route past it.

| Tracker state | Stage | Do |
| --- | --- | --- |
| Spec open, no `impl` sub-issues, no `spec-reviewed` marker | Spec unreviewed | `/spec-review <spec>` — the pipeline is agent work; defects escalate at its gate |
| Spec open, no `impl` sub-issues, `spec-reviewed` marker | Needs breakdown | `/tickets <spec>` — HITL; the quiz is the human's approval gate (skipped in auto mode, per that skill) |
| Spec open, a parked `impl` sub-issue with its gap commented on the spec | Spec gap | Sit with the human on it (load `/grilling` and `/domain-modeling`). Record the decision on the spec — as a new indexed decision cited by the ticket, when the spec has a Decision Index (per `/specify` and the tracker doc) — and unpark the ticket |
| Spec open, open `impl` sub-issues | Shipping | `/ship <spec>` (or `/implement` for one frontier ticket, if the user prefers stepping) |
| Spec open, all `impl` sub-issues closed | Closing | `/ship <spec>` — its bootstrap finds the frontier empty and runs the closing pass over the whole branch (or, if the last closing summary is clean, offers the PR that `Closes #<spec>`) |
| Spec closed, nothing outstanding | Done | Say so. There is no next. |

## Auto mode

`/next auto <spec> [merge]` **conducts** the chain instead of stopping after one stage: route, announce the stage in one line, run that stage as its own invocation, and when it completes, route again — until the spec closes or only escalations remain. The word `merge` in the invocation (the literal word, or an equivalent as unambiguous — a vague "finish it" grants nothing) is the **merge authorization**: when ship's closing pass comes back clean and the spec has no open children, open the PR whose body `Closes #<spec>` and squash-merge it without a fresh prompt.

- **Auto-config is durable.** First act: post `<!-- next-auto config -->` on the spec — auto mode active, merge authorization yes or no. Any `/next` invocation that finds an active auto-config resumes conducting after clearing whatever gate it lands on; the user cancels by saying so, recorded as a follow-up auto-config comment. The merge authorization is **void** if any closing-pass spec-axis question was answered "leave as-is" — merge-on-clean means clean — and a void or absent authorization falls back to offering the PR.
- **Escalations don't stop the run.** An escalation is durable on its ticket or gate and notified when raised; the conductor routes around it and stops only when nothing else can move — then it reports the escalation queue and ends the turn. The human's answer, in any session, resumes the run.
- **Gates are answered, not waited on.** Each stage's own gate posts its pending-questions durably and is answered per `/finding-pipeline`; only escalations wait. `/tickets` skips its quiz per that skill. A clean stage rolls into the next with nothing but the one-line announcement.
- **The conductor conducts — stage substance never enters its context.** It loads at the start of the run, and holds for its whole length, this skill, `/finding-pipeline`, `/deciding`, `/hitl-questions`, `/issue-tracker`, and `/model-policy`; everything heavier is delegated, each subagent on its tier per `/model-policy` — fill agents are executors, whole-stage subagents are deciders:
  - **Fill agents.** Every workflow fill — ship waves, closing passes, review pipelines — runs in a fresh subagent that reads its inputs off the tracker; the filled script and its inputs never enter the conductor's context, which launches the workflow and reads only its typed return.
  - **Whole-stage subagents** for the conversation-free stages that launch no workflow: `/specify`, and `/tickets` through critic and publish, each run entirely inside a subagent that invokes the stage skill and returns one line. The conductor never loads those skills.
  - **Question loops run lean.** A gate the agent answers runs in a decider subagent handed the pending-questions comment and `/deciding`. A loop with the human runs in the conductor from the pending-questions comment plus `/finding-pipeline`'s gate mechanics and `/hitl-questions` — the blocks are pre-drafted there as the notes the loop talks from — never by loading the stage skill that produced them.
  - Ticket bodies, finding queues, and spec text are re-read from the tracker at each boundary, exactly the reconcile discipline above, so a long roll is safe to summarize mid-session.
- **Stalls are gates too.** A structural signal — ship's convergence guard, a second DAG-critic failure, repeat escalations of one class — escalates immediately, carrying its diagnosis (recurring `spec-suspect` means the spec is systematically under-specified; a recurring pattern means a standard is waiting to be written). A transient mechanical failure — an agent died, a flaky suite — gets exactly one retry. Either way the stop is durable before the turn ends: a stall report comment on the spec — the stage, what was attempted, the signal, what's needed to resume — then notify.

## Rules

- **One stage per invocation.** Never compress two stages into one session — finishing `/specify` does not mean starting `/tickets`. The sizing is the point; end by saying `/next`. (Auto mode is the sanctioned exception: it chains invocations, one stage each, and pauses only for escalations.)
- **Re-invocation in a live session is fine — make the budget call out loud.** One ticket per invocation is the unit; one ticket per *context window* is not a rule. When the human says `/next` again in the same session, don't balk and don't re-read skill files already in context — just route again. After each ticket, state the posture: a light ticket with plenty of room → invite another `/next` here; a heavy one → say so and recommend `/clear` first.
- **Never jump an escalation.** An escalated ticket or gate block is resolved only with the human. Outside auto mode, route *into* the `/tickets` quiz, never past it — auto mode's skipped quiz is an approval the human delegated by asking for it.
- **Announce the stage before acting** — "the spec has 6 open tickets, 4 on the frontier; shipping those, and one escalation is waiting on you: <ticket name>" — so the human always knows where the effort stands without reading the tracker.
