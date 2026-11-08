---
name: wayfinder
description: Build something too big for one agent session, on its own, from the destination, principles, and design the human sets at the start — agents plan it as a graph of pieces, prove only the risks that could sink it, build every ready piece in parallel, make the detailed calls as they go, and review their own decisions each round so a bad call is corrected before more is built on it. `/wayfinder <idea>` starts an effort; `/wayfinder <plan>` resumes one. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

The human gives an effort its **destination** — the working thing, what they will run when it's done — its principles, and its high-level design, in one setup session. From then on agents take it to running code without the human: one **conductor** session runs rounds, each building every piece that is ready, until the destination runs. The human is pulled back only for `/deciding`'s three escalation cases and for work only they can do, and the run carries on around both while it waits.

**Running code is the measure.** A round that lands nothing is a problem to diagnose, not a lap to repeat. Plans, decisions, and reviews exist only to get the right code built; none of them is output.

## Refer by name

In everything a human reads, refer to the plan, a piece, or a risk by its title, wrapping its link — never by a bare id, number, or slug.

## The plan

The plan is a **spec issue** (per `/issue-tracker`, labelled `spec` and `wayfinder:plan`), so `/ship` builds from it unchanged. Its body is `/specify`'s spec kernel, with three sections of its own first:

```markdown
## Destination

<the working thing — one or two lines — and the check that shows it runs>

## Design

<the high-level design the human agreed at setup: the major parts, how they relate, the flows that matter. Only a human answer changes it>

## Where it stands

<rewritten every round: what runs now, what the last round landed and learned, what is next>
```

The effort's own principles go in the kernel's Further Notes as deltas over `PRINCIPLES.md` (per `/principles`), with the merge authorization and the machines and services the run may use. The kernel's **Seams under test** start with what the design names and grow as foundation pieces land.

The plan has three kinds of work:

- **Pieces** — the plan's `impl` children: a chunk of code sized to one agent session, with acceptance criteria an agent can check, the `D<n>` decisions it builds on, and blocking edges to the pieces whose code it needs. `/ship`'s frontier is the ready pieces.
- **Risks** — issues labelled `wayfinder:risk`, linked from the plan but never its children, so `/ship` never sees them. Each blocks the pieces that rest on its answer, and nothing else.
- **Human tasks** — issues labelled `wayfinder:task` and `hitl`, linked the same way: a precise checklist of something only the human can do (a run on hardware the agents can't reach, a credential, an account). Pieces that need the result are blocked on it; everything else builds.

**Decisions live where they are used.** A call only one piece needs is made by the agent building it and recorded on that piece, per `/deciding`. A call two or more pieces need is published as a plan decision `D<n>` (per `/issue-tracker`'s spec decisions) before the pieces that cite it are built, and its record follows `/deciding`'s format.

## Prove what could sink it, guess the rest

A question becomes a **risk** only when building on a wrong guess would waste real work — the design might not hold up, the platform might not do what the design needs, or the answer would change the shape of many pieces. Everything else is decided by best guess: the call the principles and design most plainly imply, made by whichever agent needs it, recorded, and corrected later by the code if it was wrong.

A risk is answered by one **spike** — a throwaway prototype per `/prototype`, or a lookup per `/research` — that stops the moment the question is answered, and its answer is recorded as a decision. The failure this prevents is proving things forever: a second prototype to measure a path the first already showed works, a ticket for what a reboot should do, a benchmark nobody's call depends on. A follow-up a spike suggests is a new risk only if it passes the test above on its own; otherwise it is a best guess for the piece that needs it.

The same test applies whenever an agent is tempted to open a question instead of deciding: at setup, at every replan, and in every piece's build. A piece agent never stops to ask about a detail; it decides per `/deciding` and carries on.

## Ordering for speed

The graph should be **wide**. Cut pieces along the design's seams, so most pieces need only the foundations and never each other, and every piece whose blockers have landed builds in the same round.

A **foundation** is a piece other pieces build on — a skeleton that runs end to end, the shared types, an interface two parts meet at. Foundations go first because their dependents need their code, not because they are first in some plan order, and they land as real code, not documents. An edge between two pieces exists only where one truly needs the other's code; two pieces that only touch the same files have no edge, since `/ship`'s collision check and serial merges handle that.

Plan only as far as you can see clearly. The first plan holds the foundations, the pieces visible from the design, and the risks; each replan adds the pieces the landed code makes visible.

## The round

The conductor runs rounds until no piece, risk, or human task is open. It never asks the human whether to go on, and announces each round in one line: what's building, what's being proved, what's waiting on the human.

1. **Reconcile.** Read the plan in full, its open pieces, risks, and human tasks, and the ledger `/ship` keeps on it. A piece or risk claimed by a session that is gone is unclaimed.
2. **Build and prove, side by side.** Run one `/ship` wave over the ready pieces — its steps 2–3, starting on its bootstrap's branch, with the gate answered per `/deciding` and only what that escalates waiting on the human. Beside it, one background agent per open, unblocked risk works its spike on the **decider tier** (per `/model-policy`). A round with no ready piece still proves its risks; a round with neither waits on the human, reports the queue, and ends the turn.
3. **Check it runs.** On the merged branch, run the destination's check as far as the code now reaches, and the *Green* set per `/testing`. A red result becomes the first piece of the next round.
4. **Replan.** One decider subagent reads the wave's ledger, its parked pieces, the spikes' answers, and the code, and updates the plan: rewrites **Where it stands**; records each spike's answer as a decision and closes the risk; fills each parked piece's gap per `/deciding` and unparks it; publishes the `D<n>` decisions the next pieces need; adds, splits, or drops pieces; adds the seams that landed.
5. **Review.** Launch the plan review per [REVIEW.md](REVIEW.md) in the background over the decisions made since the last one. It runs beside the next round, so building never waits on it; what it finds lands in a later round as corrections (below).
6. **Progress check.** A round must land a piece or retire a risk. A round that does neither is a **stall**: post a stall report on the plan — what was attempted, what blocked it, what's needed — notify, and escalate. A transient failure (an agent died, a flaky suite) gets one retry first.

When nothing is open, run `/ship`'s closing pass and its done step over the whole branch, then merge or offer the PR per the merge authorization: with it, squash-merge on a clean closing pass; without it, offer the PR. Report the destination's check result and how to run the thing.

## Correcting a decision

Friction notes (per `/deciding`) and the plan review's tensions accumulate on decisions. A decision is **reconsidered** when it carries any friction from code — a parked piece or review finding that traces to it — a tension from the plan review, or two notes from anything else, counting only notes since its last reconsideration.

A reconsideration is one decider agent that reads the decision, its friction, the pieces and decisions that rest on it, and what has been learned since, and returns a plan — **stands** (with why each strain is acceptable), **amend** (a clarification no dependent's code changes over), or **supersede** (a replacement, with every dependent marked unaffected or reworked). A fresh decider agent tries to refute the plan before it applies; a plan refuted twice escalates, and so does one that falls in `/deciding`'s three cases.

A superseding plan amends the plan decision (or the piece's record) and turns each reworked dependent into a piece: code not yet built takes the new decision as written, and code already built gets a **rework piece** that blocks whatever would build further on it. That bounds a bad call's cost to the code built in the rounds before it was caught.

## Setup

This is the one session that is the human's. Load `/grilling`, `/domain-modeling`, and `/hitl-questions`.

1. **Name the destination**: what the human will run when it's done, and the check that shows it runs — confirmed in one or two lines.
2. **Settle the principles.** Load `/principles` and read the governing `PRINCIPLES.md` files; draft what's missing with the human, asking which way they lean on the trade-offs this effort will hit. Done when you can predict their call on the hardest decisions you can foresee.
3. **Agree the high-level design** — the major parts, how they relate, the flows that matter — at the altitude the human holds it.
4. **Settle the run's limits**: whether it may merge to the default branch on a clean closing pass, which machines and services agents may use, and the human tasks they will need to do.
5. **Plan the first round**: the foundations, the pieces visible from the design, and the risks, each per the rules above. **If the whole effort fits one agent session**, it needs no plan: say so, and stop.
6. **Create the plan** (run the tracker's bootstrap first): the spec issue with its body, then its pieces, risks, and human tasks, then the blocking edges in a second pass.
7. **Hand off.** Load `/multiplexer` and hand off to a session of its own: the repo root, the plan's title as the label, and `/wayfinder <plan>` as the prompt; tell the human the label and stop. With no multiplexer, point at `/wayfinder <plan>` and stop.

## Conducting

`/wayfinder <plan>` from any session resumes as conductor at step 1 of the round: all state is on the tracker. The human cancels or redirects by saying so; record it as a comment on the plan so a later session sees it.

The conductor's context holds the run, not its substance. It loads this skill, `/deciding`, `/issue-tracker`, `/model-policy`, and `/finding-pipeline`, and delegates everything heavier, each subagent on its tier per `/model-policy`:

- **Fill agents** (executor tier) fill each workflow — the ship wave, the plan review — from the tracker, and the conductor launches it and reads only its typed return.
- **The replan** and every reconsideration are decider subagents that return one line.
- **Escalations** are posted durably on the issue they concern, opening `<!-- escalation -->`, and push-notified, per `/deciding`. The conductor routes around them; the human's answer, in any session, is recorded as a decision and the run picks it up next round.

Re-read the plan from the tracker at every round boundary, so a long run is safe to summarize mid-session.
