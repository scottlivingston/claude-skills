---
name: ship
description: Implement a spec's ticket DAG wave by wave — parallel agents in isolated worktrees, serial merges, each wave's merged diff verified on the Spec and Standards axes through the finding pipeline, only intent questions escalated at a durable gate. Re-entrant from the spec issue's ledger; ends by offering the PR that closes the spec. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

Ship turns an approved ticket DAG into committed, verified code, with verification running inside the run. Each wave's merged diff is checked against two things only: **did the tickets deliver their acceptance criteria** (spec axis) and **does the code break a documented standard** (standards axis). This is a verification gate, not a taste review — no reviewer opinions, no style crop.

**The policy: escalate questions about intent, auto-resolve questions about code.** The user is the spec authority, not a code reviewer — the run must never require them to hold the code in their head. Every validated finding with an uncontested fix resolves itself: applied and committed, or ticketed onto the next wave. What reaches the user is exactly the set of questions the pipeline *cannot* answer, because they are questions about what was meant — the five question classes of `/finding-pipeline`'s code gates: spec unclear, competing fixes, genuine trade-off, no working fix, pervasive pattern.

Unanswered **spec-axis** questions close a gate: the next wave does not launch until the user answers them, so wave 2 never builds on a misread of the spec. A wave with no such questions posts its ledger and rolls straight into the next — a clean run stays AFK end to end.

The verification pipeline is the contract in `/finding-pipeline` — stages, adversarial discipline, routing, gate markers, question mechanics, and the code-gate specifics live there once, for this skill, `/diff-review`, and the document gates alike. What's local here is the wave machinery and the reviewer briefs (see *What is local to this gate*); when an invariant needs changing, change the contract, not this skill.

The user invokes with a **spec** (issue URL/number) whose implementation tickets already exist as its sub-issues. For the issue tracker, invoke `/issue-tracker`; for standards sources, `/conventions`.

## Guardrails

- **Wrong entry point?** Redirect, don't improvise: a spec with no tickets → run `/tickets <spec>` (HITL) first. A wayfinder map → `/specify <map>` first.
- **Branch discipline**: if on the default branch, create `spec-<number>-<slug>` and work there. The whole run lands on one branch; one PR closes the spec at the end.
- Never merge to shared branches, push, or open PRs unless the user asked explicitly.
- **The manager orchestrates and asks — nothing else.** Implementation, merging, review, fixes, ticket filing, and tracker updates all happen inside workflow agents. The manager's own work is authoring workflows, reading their returns, running the question loop, and posting ledger comments.
- **Waves are derived, never stored.** The durable truth is the ticket DAG plus the spec issue's ledger comments. The frontier — open tickets with no open blocker and no claim — is recomputed from the tracker at every wave boundary, so parked tickets drop out and mid-run review tickets join in automatically.
- **No taste findings.** The standards axis reports breaches of written rules only. If `/conventions` finds nothing scoped to the touched files, the axis is idle and the ledger says so plainly — the axis activates when rules get written, not before. Style and design review belong to `/diff-review` and `/simplify`, run deliberately, not to this gate.

## The ledger

All run state a future session needs lives as comments on the **spec issue**, each opening with a machine-findable marker (these are process comments — never the tracker doc's spec-decision marker):

- `<!-- ship wave-<n> pending-questions -->` — posted by the wave workflow's **final stage** when the gate closes: the full question blocks for every escalation awaiting an answer, plus the audit digest of the wave's auto-actions (applied SHAs, filed ticket numbers, refutations). Durable *before* any answer happens, so the question loop can run in a different session than the one that launched the workflow.
- `<!-- ship wave-<n> summary -->` — the round summary, posted by the manager after the wave is settled: **every** finding ID with its terminal outcome — auto-applied (SHA), auto-ticketed (#N), refuted by a validator (one-line reason), answered (the verdict and what it triggered — spec comment posted, fix applied, ticket #N, rule ticket #N, left as-is), reverted on audit, or **`deferred-to-close`** (standards-axis escalations at an open gate). Deferred entries carry their full question block, not a one-liner — the closing pass raises them cold from this comment alone. Also: tickets landed, tickets parked, next-wave notes.
- `<!-- ship closing-<k> pending-questions -->` / `<!-- ship closing-<k> summary -->` — the closing pass's equivalents.

Finding IDs are wave-scoped and never reused: `W<n>-STD-<i>` / `W<n>-SPEC-<i>` for wave *n*, `C<k>-STD-<i>` / `C<k>-SPEC-<i>` for closing pass *k*. The summaries are the run's **adjudication memory**: every later wave's dedup stage reads them, so no finding is ever re-litigated — that is what makes the run converge.

## Process

### 1. Bootstrap — any session, idempotent

Every invocation starts the same way, whether it's the first session or a resume:

1. Read the spec in full — kernel plus addressable decisions per the tracker doc — including Testing Decisions, the **Seams under test** list, and the Decision Index.
2. List the spec's sub-issue tickets with states, blocking edges, claims, and the decision IDs each cites.
3. Read the spec issue's comments and collect the ledger: prior wave/closing summaries (adjudication memory), any pending-questions comment, the answer record (the answered entries in prior summaries, and the spec comments their verdicts posted), open `review-finding` tickets.
4. Find or create the ship branch (`spec-<number>-<slug>`); check it out. Record the run's base: `git merge-base <default-branch> HEAD`.
5. Pick the resume point:
   - A **pending-questions comment with no matching summary** → resume at **the question loop** (step 4 below) from that comment. Do not re-run the wave's pipeline.
   - Otherwise compute the frontier. **Non-empty** → next wave (step 2), numbered one past the highest ledger wave. **Empty** → closing pass (step 5) — unless the latest closing summary is clean, in which case the run is done (step 6).
6. Report the resume point and the wave structure (what's frontier now, what unblocks when) before launching anything.

### 2. The wave workflow

Each wave runs as **one dynamic `Workflow`** (this skill is your authorization to use it). **Start from [workflow.template.js](workflow.template.js) — fill it, don't author from scratch.** Read the template and fill every `FILL` slot in its data block with the wave's tickets, decisions, and dedup inputs; everything below its FIXED marker — schemas, prompt builders, stage order, the merge chain, the routing — is the same every run; edit it only when this run genuinely deviates. An unfilled slot throws `FILL is not defined` at launch — loud, before any agent spawns. Fill prose slots as JSON string literals (double-quoted, `\n`-escaped), which no code span or apostrophe can terminate. The stage briefs below and the reviewer briefs in *What is local to this gate* are the prompts the template embeds — keep the two in sync when either changes. The stages:

1. **Claim** — an executor-tier agent at low reasoning effort claims every frontier ticket (tracker doc's claim operation; bootstrap the markers first if needed) and verifies the claim check passes before any implementer spawns. Claims gate **implementers**, not planners — the plan stage launches alongside this agent, not after it.
2. **Plan** — one planner per frontier ticket, in parallel with each other and with the claim agent, on the **decider tier** (see the model tiers in the authoring notes). Each explores the ship branch as it stands *now* and writes the ticket's implementation plan: where the work lands, the approach, the seams it will touch, the files it expects to change, and where the red tests go first. It gets exactly what its implementer will get — kernel, cited decisions in full, ticket body — and posts the plan as a **ticket comment** opening `<!-- ship wave-<n> plan -->`. Plans are wave-stamped and never reused: a ticket that parks and rides a later wave is planned again against that wave's HEAD, and resume never reads plan comments — they are audit trail, not run state. A planner that discovers the ticket can't be built as written — a decision the spec doesn't hold, work no listed seam covers — **parks it here**, before an implementer burns a session finding out. When all plans are in (a deliberate barrier, skipped when the wave has one ticket), a **collision check** stage reads the set and reconciles pairs that plan to reshape the same seam differently: where one shape can serve both, it amends the losing plan (a follow-up comment) so both implementers build against the shared shape; what it can't reconcile mechanically becomes a note baked into the merge stage's brief — the merge agent inherits the tension, never the human, and the verification pipeline reads the merged result regardless.
3. **Parallel implement** — one fresh agent per ticket, each in an **isolated worktree**, spawned on the **executor tier** (see the model tiers in the authoring notes). Each gets the spec **kernel** (Testing Decisions and Seams under test verbatim, Decision Index included), the **full text of the decisions its ticket cites** — never the whole decision log — its ticket body, **its wave-stamped plan**, and the `/implement` + `/tdd` discipline: red–green at the spec's seams, typecheck regularly, run single test files regularly, commit in its worktree. First action: confirm the ticket carries `in-progress`. Never two tickets in one agent. The plan is a map, not a contract: an implementer that finds the code contradicts the plan deviates and notes the deviation in a ticket comment — the map was drawn minutes ago, but the territory wins. An agent needing an uncited decision checks the Decision Index, fetches it by ID, and notes the missed routing in a ticket comment. A decision the spec doesn't hold anywhere, or work no listed seam covers, **parks** the ticket: unclaim, comment what's missing on the ticket, comment the gap on the spec issue.
4. **Serial merge, in completion order** — worktree branches merge into the ship branch **one at a time, starting as each implementer finishes**: chain every branch's merge onto a shared promise rather than waiting for the whole implement stage, so the first-finished branch merges and tests while the slowest ticket is still implementing. Merges stay strictly serialized (merge and conflict agents run on the executor tier — serialized, so model speed compounds with wave width); within a wave, tickets are dependency-free by construction, so completion order is safe. Affected tests after each merge (full suite if cheap). Any unreconciled collision notes from the plan stage ride in the merge brief. On conflict, a merge agent resolves preserving both tickets' intent, then re-tests. **Never merge on red** — a branch that can't come green is parked like any other. On green, close the ticket with a comment linking its commits and remove `in-progress`.
5. **Verification pipeline** over the wave's combined merged diff — per `/finding-pipeline`, with the inputs and reviewer briefs in *What is local to this gate*, ending in the routing that auto-applies, auto-tickets, or escalates every survivor.
6. **Ledger post** — the workflow's final stage posts the pending-questions comment when escalations exist (see the gate), then returns the full routed queue: every finding with its route, question class, applied SHA or ticket number. That return value is all the manager sees of the pipeline.

A parked ticket doesn't stop the run unless it blocks everything — later frontiers exclude tickets whose blockers didn't land, and the run continues around them.

### 3. The gate

When the workflow returns, read the escalation queue — the findings routed to a human, each carrying its question class.

- **Any spec-axis escalation** (including any cross-axis pair — the pair's spec member closes the gate for both) → **the gate is closed.** Send a push notification (load via `ToolSearch("select:PushNotification")`; skip silently if unavailable), then go to the question loop (step 4).
- **No spec-axis escalation** → **the gate is open.** Standards-axis escalations (a pervasive pattern, a standards trade-off) are **not** raised now: record each as `deferred-to-close` (full question block) in the wave summary. Post the wave summary and launch the next wave immediately — no pause, no question. Auto-applies and auto-tickets never hold the gate: they are the pipeline doing its job, listed in the ledger for audit, not approval.

Either way the wave summary comment gets posted before anything else happens — refutations, auto-applies, and auto-tickets included, so the next wave's dedup remembers them.

### 4. The question loop at a closed gate

Runs in the manager session — this one, or any later session that bootstraps onto the pending-questions comment. Walk the **whole** escalation queue, standards escalations included (the user is warm; cold questions at the end are the expensive version), per `/finding-pipeline`'s question mechanics: orientation summary first, then one question per turn, then act on the answers (spec comments, fix agent, tickets, reverts), then post the wave summary recording every outcome.

Then **checkpoint**: state is fully durable, so end the turn with the choice stated plainly — continue with the next wave here, or run `/ship <spec>` in a fresh session; both resume identically from the tracker. Don't launch the next wave unprompted after a question loop: the checkpoint is the session-boundary the gate exists to offer.

Tickets filed by answers (and by auto-ticketing) are spec children — the next frontier computation picks them up, so review rework rides the very next wave.

### 5. The closing pass

When the frontier is empty, run one last workflow over the **whole branch diff** (`git diff <run-base>...HEAD`) — the same template, with its `CLOSING` slot set (the claim/plan/implement/merge stages skip; the finding sources change as below; IDs become `C<k>-…`). Per-wave verification is a partition in time, and it is blind to seams *between* waves — parallel agents that never saw each other's code, in different waves, converging on the same shapes. The closing pass restores the whole-diff view and drains the deferred queue:

- **Cross-wave sweeper** — one agent reads the whole diff at low resolution (file list and hunk headers, reading closer only where suspicious), hunting only the four cross-file composition seams no single wave could see: Duplicated Code, Repeated Switches, Shotgun Surgery, Divergent Change (Fowler, _Refactoring_ ch.3). This is the one place the pipeline looks beyond written rules — the target is parallel-implementation drift, not style, and its findings route like any other: mechanical consolidations auto-resolve, only genuine trade-offs escalate.
- **Requirements-union check** — one agent reads the spec kernel with its full Decision Index against the whole diff's file list and checks every requirement is implemented *somewhere*, fetching decisions by ID as needed. Absent from the changed files ≠ unimplemented — it may pre-exist; each suspect goes to a small checker agent before becoming a finding.
- New findings (`C<k>-…` IDs) run through the same validate → propose → validate → route stages as a wave's, with the same dedup against the full adjudication memory.
- The **deferred queue** — every `deferred-to-close` block from the ledger — joins the escalation queue as-is (already validated, already proposed; don't re-run their stages).

Everything escalated at the closing pass gets asked — there is no spec-only gate here; this is the run's last look. Notify, ask, act, post the closing summary.

- Closing answers and auto-tickets create spec children → the frontier is non-empty again → **loop back to step 2**. The run keeps going until a closing pass comes back clean.
- **Convergence guard**: a wave or closing round that fails to shrink — as many new findings as the last, or repeat escalations of the same class — is a signal, not a lap to repeat: recurring `spec-suspect` means the spec is under-specified in a systematic way; recurring pervasive patterns mean a standard is waiting to be written. Say so plainly; the next move is sharpening those documents.

### 6. Done

A closing pass whose escalations are all answered and whose auto-tickets are all landed ends the run. Push notification, then the report: per ticket — commits; per wave — the audit trail (auto-applies with SHAs, auto-tickets, refutations) and the questions asked with their answers; parked tickets and exactly what each needs. Then run the full test suite once more and offer the PR whose body `Closes #<spec>`. **Suppress the offer while the spec has open children** — including parked tickets; offer a plain PR (no `Closes`) instead. Only open either if the user says yes. If the user then asks to merge it, **squash-merge** (`gh pr merge --squash`) — the spec lands as one commit on the default branch, not its ticket-by-ticket history. Under `/next auto` with a live merge authorization (its auto-config comment), the conductor *is* the explicit ask: open the `Closes` PR and squash-merge without a fresh prompt — the suppression rule and the authorization's void condition (per `/next`) still hold.

## What is local to this gate

The pipeline itself — stages, chunking, adversarial validation, edge fields, routing, the fix and ticket agents, gate markers, question mechanics, the five question classes and their option shapes — is `/finding-pipeline`, code-gate section included, and none of it is restated here. What follows is only what the contract delegates to ship.

**Finding IDs** are wave-scoped and never reused: `W<n>-STD-<i>` / `W<n>-SPEC-<i>` for wave *n*, `C<k>-STD-<i>` / `C<k>-SPEC-<i>` for closing pass *k*. The gate markers are `<!-- ship wave-<n> … -->` and `<!-- ship closing-<k> … -->` (see *The ledger*), and the pending-questions comment goes on the spec issue.

**Inputs the fill bakes in** — the template's `FILL` slots (the workflow has no conversation context): the wave diff command — `git diff <pre-wave-SHA>...HEAD` where `<pre-wave-SHA>` is the ship branch at launch, before this wave's first merge (the wave's commits are created *inside* the run, so agents fetch the commit log themselves); the spec **kernel** plus the full text of the union of decisions the wave's tickets cite (Decision Index included, so reviewers can fetch unrouted decisions by ID); the standards sources per `/conventions` with the directory scope each binds — **and if `/conventions` finds nothing scoped to the touched files, the standards reviewer stage is omitted from the script entirely** and the ledger notes "no documented standards — standards axis idle"; the dedup inputs — open `review-finding` tickets and all prior ledger summaries, fetched pre-launch; and the run's **answer record** — every prior `w<n>-answer` comment and the spec comments verdicts posted — fetched pre-launch and passed as binding spec text.

Both reviewers, and every other review-side stage, also carry the contract's scope rule (*The diff is the material*) — the template holds it once, in its `SCOPE_RULE` const, and folds it into the block they all share; the briefs below don't restate it.

**Reviewers — one per axis.**

- **Standards reviewer** (only when documented standards exist): gets the diff command, commit list, and the standards sources with their scopes (nearest scope wins; scoped files read as deltas over root). Brief: "Report — per file/hunk where relevant — every place the diff violates a **written rule**: cite the standard (file + rule) for each. If no written rule covers something, it is not a finding — do not report taste, smells, or conventions you would personally prefer. A finding that looks like a pattern with a statable grep signature: grep outside the diff and flag `repo-wide` only with the grep and both counts attached. Skip anything tooling enforces. Under 300 words."
- **Spec reviewer**: gets the diff command, commit list, and the kernel-plus-cited-decisions. Brief: "Report: (a) acceptance criteria of **this wave's tickets** that are missing or partial — a requirement no ticket in this wave carries is a later wave's work, not a finding; (b) behaviour not asked for (scope creep); (c) requirements implemented wrong. Treat decision snippets — state machines, schemas, contracts — as requirements; divergence from one is a finding. Where the spec is **silent** on a case the diff had to decide, that is not a violation — report it as a spec question only when a different owner could defensibly want a different behaviour; silence plus one defensible choice is not a question. State the case and the choice the code made. Quote the spec line, with its decision ID where it has one, per finding. Under 400 words." Reviewing the integrated wave rather than each ticket alone is deliberate: it sees how parallel tickets compose.

**Partition.** A wave too wide for one reader per axis (soft heuristic: >~15 files or ~1,500 changed lines) partitions exactly as `/diff-review` does: one cheap partition stage clusters files into subsystem groups aligned with scoped-standards boundaries and routes cited decisions to groups; both axes share the partition; one in-wave cross-cutting sweeper and a requirements-union over the chunks restore what partitioning breaks. Most waves won't need this. Findings scale with reviewer count, so don't partition a wave that doesn't need it.

**Scope, wave-shaped.** The contract's *The diff is the material* binds here unchanged — the material is the wave diff, and the finding validator's typed `scope` field is what enforces it. One thing is local: the spec axis's "missing requirement" carve-out is bounded to **this wave's tickets**, not the whole spec. A wave implements a slice of the DAG, so every requirement later waves will build is trivially absent from its diff; treating that absence as a finding would make wave 1 of a three-wave spec report most of the spec as missing. Whole-spec coverage is the closing pass's requirements-union check, which runs once, over the whole run diff, when the frontier is empty.

**The gate is spec-axis only** (see *The gate* above): standards-axis escalations at an open gate record as `deferred-to-close` and the closing pass raises them. The contract's `stop` hatch therefore records untouched IDs as `unanswered` and re-raises them at the closing pass.

**Orientation summary** — one addition to the contract's: when the standards axis was idle, one line saying so — *"No documented standards; the standards axis checked nothing this wave. It activates when rules are written."*

## Authoring notes for the wave workflow

- **Model tiers, per `/model-policy`.** Which model each tier runs on is resolved there and filled into the template's `EXECUTOR_MODEL` / `DECIDER_MODEL` / `AUDITOR_MODEL` slots; what is local here is which stage sits on which tier. **Executors** — agents that carry out a fully specified brief under a net: the claim agent (pure tracker mechanics), the implementers (the wall-clock bottleneck — routinely 30+ min per wave on a bigger model — working from fully specified tickets plus a wave-fresh plan), the merge/conflict agents (serialized, so speed compounds; netted by never-merge-on-red and the wave verification reading the merged diff), the auto-ticket agent, and both fix agents (sketches already validated; netted by the test suite, per-finding revertible commits, and the audit-revert loop). **Deciders** — agents whose judgment is the product: **the planners and the collision check** (choosing the approach is the decide half of implementing — the plan stage exists to move it off the executor tier, so the executor only executes the map), the partition stage, both reviewers, both validator passes, the proposers, and the ledger assembler. **Auditors** — the run-once find-side reads: the closing-pass cross-wave sweeper, the requirements union, and both labeling stages; wave reviewers stay deciders because they repeat every wave and the validators net them. Every executor stage sits under at least one net; the planners are the one decider stage on the wall-clock critical path, and they're cheap there — minutes of exploration ahead of a 30-minute implement leg.
- Pure-mechanics executor stages (claim, auto-ticket) also pass `effort: 'low'`; the fix agents don't — multi-file edits plus a suite run and reverts are not low-effort work.
- The pre-wave SHA slot is the ship branch's HEAD at launch — the workflow's own merges land after it, so it is the wave diff's fixed point.
- Merges chain onto a shared promise in implementer-completion order — serialized, never a wait-for-all barrier.
- Filling, schemas, chunked chains, the fresh assembler, and fill delegation follow the contract's *Workflow authoring invariants*.

## Relation to /diff-review

Both are code gates on the same contract; the differences are scope, not philosophy. `/diff-review`'s standards axis carries the full Fowler smell baseline on top of documented rules; this gate reviews written rules only, and the closing sweeper keeps just its four composition smells, aimed at parallel-implementation drift. Waves, the ledger, the spec-axis gate, and cross-session resumability belong to ship; `/diff-review` is a standalone, single-session review of any diff since a fixed point — branch, PR, or work-in-progress, spec or no spec.
