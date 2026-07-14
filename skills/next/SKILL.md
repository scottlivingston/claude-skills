---
name: next
description: Advance an effort by exactly one unit of work. Reads the issue tracker to find where the effort stands — charting, working the map, spec, tickets, shipping, review — then routes to the right stage skill. Start an effort with /wayfinder; after that, just keep invoking /next.
disable-model-invocation: true
---

One command for the whole wayfinder → to-spec → to-tickets → ship → review chain. The tracker is the memory, so the current stage is never remembered — it is **queried**: this skill reads the effort's state off the tracker, announces the stage, and runs that stage's skill. Each invocation does **one stage's unit of work**, sized to this session, then stops and says `/next` again.

`/next` is a router, not a stage. Everything below routes *into* an existing skill — read that skill and follow it; never improvise a stage inline. For tracker operations, read `issue-tracker.md` in this plugin's `skills/` directory, one level up from this SKILL.md (a repo-level tracker doc overrides it).

## Find the effort

The argument, if given, is a **map** or **spec** issue (URL or number). Without one, discover: query open issues labelled `wayfinder:map` and open issues labelled `spec`.

- Exactly one live effort → use it.
- Several → ask the user which (by name, per wayfinder's refer-by-name rule).
- None → `/next` has nothing to advance. Charting needs the loose idea, which lives in the human's head, not the tracker — point at `/wayfinder <idea>` and stop.

A **closed map** isn't a dead end: `/to-spec` comments the spec's link on the map before closing it. Follow that link and route on the spec. Likewise a spec's stage depends on its `impl` sub-issues, fetched fresh each invocation.

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
| Map open, no open children, Not-yet-specified empty | Map complete | `/to-spec <map>` |
| Spec open, no `impl` sub-issues | Needs breakdown | `/to-tickets <spec>` — HITL; the quiz is the human's approval gate |
| Spec open, `impl` sub-issues with spec-gap comments on parked tickets | Spec gap | Sit with the human on the gap (grill, anchored in code); record the decision on the spec, unpark the ticket |
| Spec open, open `impl` sub-issues | Shipping | `/ship <spec>` (or `/implement` for one frontier ticket, if the user prefers stepping) |
| Spec open, all `impl` sub-issues closed | Ready for review | `/two-axis-review` against the merge-base, spec issue as the Spec source; then the PR that `Closes #<spec>` |
| Spec closed | Done | Say so. There is no next. |

## Working the map

The one stage `/next` composes rather than delegates whole, because the frontier splits by mode:

1. **Query the frontier**: open, unblocked, unclaimed children.
2. **Drain the AFK frontier in the background.** Claim every frontier ticket labelled `afk`, then spawn one background agent per ticket, exactly per the `/drain` skill (its selection, claiming, and agent-brief rules apply verbatim). Fire and forget — the agents post resolutions and close their tickets; do not wait on them.
3. **Sit in the first HITL frontier ticket.** Claim it, then resolve it with the human per the wayfinder skill — one ticket, this invocation, never more. If the frontier has no HITL ticket, this session is the drain coordinator instead: fold results as agents finish, loop the AFK frontier until it's dry, then report the HITL queue.
4. **Fold as you go.** When a drain agent finishes mid-conversation, fold its result into the map between questions — a single map writer beats a parallel drain session racing this one. Results still pending when the session ends are caught by the next invocation's reconcile step.

## Rules

- **One stage per invocation.** Never compress two stages into one session — finishing to-spec does not mean starting to-tickets. The sizing is the point; end by saying `/next`.
- **Re-invocation in a live session is fine — make the budget call out loud.** One ticket per invocation is the unit; one ticket per *context window* is not a rule. When the human says `/next` again in the same session, don't balk and don't re-read skill files already in context — just route again. After each ticket, state the posture: a light ticket with plenty of room → invite another `/next` here; a heavy one → say so and recommend `/clear` first.
- **Never jump a gate.** Route *into* the to-tickets quiz, never past it; never resolve a HITL ticket without the human; never auto-approve on the human's behalf.
- **Announce the stage before acting** — "the map has 4 open tickets, 2 AFK; draining those and sitting with you on <ticket name>" — so the human always knows where the effort stands without reading the tracker.
