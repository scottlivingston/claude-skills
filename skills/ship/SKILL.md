---
name: ship
description: Implement a spec's ticket DAG wave by wave — parallel agents in isolated worktrees, serial merges, each wave's merged diff verified on the Spec and Standards axes through the finding pipeline, only intent questions escalated at a durable gate. Re-entrant from the spec issue's ledger; ends by offering the PR that closes the spec. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

Ship turns an approved ticket DAG into committed, verified code, with verification running inside the run. Each wave's merged diff is checked against two things only: **did the tickets deliver their acceptance criteria** (spec axis) and **does the code break a documented standard** (standards axis). This is a verification gate, not a taste review — no reviewer opinions, no style crop.

**The policy: escalate questions about intent, auto-resolve questions about code.** The user is the spec authority, not a code reviewer — the run must never require them to hold the code in their head. Every validated finding with an uncontested fix resolves itself: applied and committed, or ticketed onto the next wave. What reaches the user is exactly the set of questions the pipeline *cannot* answer, because they are questions about what was meant — the five question classes of `/finding-pipeline`'s code gates: spec unclear, competing fixes, genuine trade-off, no working fix, pervasive pattern.

Unanswered **spec-axis** questions close a gate: the next wave does not launch until the user answers them, so wave 2 never builds on a misread of the spec. A wave with no such questions posts its ledger and rolls straight into the next — a clean run stays AFK end to end.

The verification pipeline is the contract in `/finding-pipeline` — stages, adversarial discipline, routing, gate markers, question mechanics, and the code-gate specifics live there once, for this skill, `/diff-review`, and the document gates alike. What's local here is the wave machinery and what the contract delegates (see *What is local to this gate*).

The user invokes with a **spec** (issue URL/number) whose implementation tickets already exist as its sub-issues. Load `/finding-pipeline` and `/issue-tracker` now, `/conventions` for standards sources, and `/testing` for test recipes.

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

Finding IDs are wave-scoped and never reused: `W<n>-STD-<i>` / `W<n>-SPEC-<i>` for wave *n*, `C<k>-STD-<i>` / `C<k>-SPEC-<i>` for closing pass *k*. Every later wave's dedup stage reads the prior summaries, so no finding is ever re-litigated.

## Process

### 1. Bootstrap — any session, idempotent

Every invocation starts the same way, whether it's the first session or a resume:

1. Read the spec in full — kernel plus addressable decisions per the tracker doc — including Testing Decisions, the **Seams under test** list, and the Decision Index.
   - Collect the repo's `TESTING.md` files per `/testing`, each with the scope it binds — or none.
2. List the spec's sub-issue tickets with states, blocking edges, claims, and the decision IDs each cites.
3. Read the spec issue's comments and collect the ledger: prior wave/closing summaries, any pending-questions comment, the answer record (the answered entries in prior summaries, and the spec comments their verdicts posted), open `review-finding` tickets.
4. Find or create the ship branch (`spec-<number>-<slug>`); check it out. Record the run's base: its merge-base with the default branch.
5. Pick the resume point:
   - A **pending-questions comment with no matching summary** → resume at **the question loop** (step 4 below) from that comment. Do not re-run the wave's pipeline.
   - Otherwise compute the frontier. **Non-empty** → next wave (step 2), numbered one past the highest ledger wave. **Empty** → closing pass (step 5) — unless the latest closing summary is clean, in which case the run is done (step 6).
6. Report the resume point and the wave structure (what's frontier now, what unblocks when) before launching anything.

### 2. The wave workflow

Each wave runs as **one dynamic `Workflow`** (this skill is your authorization to use it). **Start from [workflow.template.js](workflow.template.js) — fill it, don't author from scratch.** Fill every `FILL` slot per the template's header and slot comments (the workflow has no conversation context); everything below its FIXED marker is the same every run — edit it only when this run genuinely deviates. The template owns every stage's prompt; what each stage is for:

1. **Claim** — claim every frontier ticket and verify the claims before any implementer spawns. Claims gate implementers, not planners, so planning runs alongside.
2. **Plan** — one planner per ticket explores the ship branch as it stands now and posts the ticket's implementation plan as a ticket comment opening `<!-- ship wave-<n> plan -->`. Plans are wave-stamped and never reused: a ticket that parks and rides a later wave is planned again, and resume never reads plan comments — they are audit trail, not run state. A ticket that can't be built as written — a decision the spec doesn't hold, work no listed seam covers — **parks** here. When all plans are in (skipped for a one-ticket wave), a **collision check** reconciles plans that reshape the same seam differently, amending the losing plan where one shape serves both; what it can't reconcile rides into the merge brief — the merge agent inherits the tension, never the human.
3. **Parallel implement** — one fresh agent per ticket, each in an **isolated worktree**, never two tickets in one agent, building its ticket from the kernel, the decisions it cites, and its plan under `/implement` + `/tdd`. Before reporting done it runs the **unit** invocations of the *Scoping to a change* set for the files it touched, per `/testing`. If the code contradicts the plan, it follows the code and notes the deviation on the ticket. A decision the spec holds nowhere, or work no listed seam covers, **parks** the ticket: unclaim, comment what's missing on the ticket, comment the gap on the spec issue.
4. **Serial merge, in completion order** — branches merge into the ship branch one at a time, each as soon as its implementer finishes — never a wait-for-all barrier; in-wave tickets are dependency-free, so completion order is safe. After each merge, the **integration** invocations of the scoped set for the merged files, per `/testing`. **Never merge on red** — a branch that can't come green is parked like any other. On green — the scoped set, not the *Green* set, which runs only at the end (step 6) — close the ticket with a comment linking its commits and remove `in-progress`.
5. **Verification pipeline** over the wave's combined merged diff — per `/finding-pipeline`, with what *What is local to this gate* adds, ending in the routing that auto-applies, auto-tickets, or escalates every survivor.
6. **Ledger post** — the workflow's final stage posts the pending-questions comment when escalations exist (see the gate), then returns the full routed queue: every finding with its route, question class, applied SHA or ticket number. That return value is all the manager sees of the pipeline.

A parked ticket doesn't stop the run unless it blocks everything — later frontiers exclude tickets whose blockers didn't land, and the run continues around them.

### 3. The gate

When the workflow returns, read the escalation queue — the findings routed to a human, each carrying its question class.

- **Any spec-axis escalation** (including any cross-axis pair — the pair's spec member closes the gate for both) → **the gate is closed.** Send a push notification if one is available, then go to the question loop (step 4).
- **No spec-axis escalation** → **the gate is open.** Standards-axis escalations (a pervasive pattern, a standards trade-off) are **not** raised now: record each as `deferred-to-close` (full question block) in the wave summary. Post the wave summary and launch the next wave immediately — no pause, no question. Auto-applies and auto-tickets never hold the gate: they are the pipeline doing its job, listed in the ledger for audit, not approval.

Either way the wave summary comment gets posted before anything else happens — refutations, auto-applies, and auto-tickets included, so the next wave's dedup remembers them.

### 4. The question loop at a closed gate

Runs in the manager session — this one, or any later session that bootstraps onto the pending-questions comment. Walk the **whole** escalation queue, standards escalations included (the user is warm; cold questions at the end are the expensive version), per `/finding-pipeline`'s question mechanics (load it if this session hasn't): orientation summary first, then one finding per turn as a position the user accepts or pushes back on, then act on the answers (spec comments, fix agent, tickets, reverts), then post the wave summary recording every outcome.

Then **checkpoint**: state is fully durable, so end the turn with the choice stated plainly — continue with the next wave here, or run `/ship <spec>` in a fresh session; both resume identically from the tracker. Don't launch the next wave unprompted after a question loop: the checkpoint is the session-boundary the gate exists to offer.

Tickets filed by answers (and by auto-ticketing) are spec children — the next frontier computation picks them up, so review rework rides the very next wave.

### 5. The closing pass

When the frontier is empty, run one last workflow over the **whole branch diff** since the run base — the same template, with its `CLOSING` slot set (the claim/plan/implement/merge stages skip; the finding sources change as below; IDs become `C<k>-…`). Per-wave verification is a partition in time, and it is blind to seams *between* waves — parallel agents that never saw each other's code, in different waves, converging on the same shapes. The closing pass restores the whole-diff view and drains the deferred queue:

- **Cross-wave sweeper** — one agent reads the whole diff at low resolution (file list and hunk headers, reading closer only where suspicious), hunting only the four cross-file composition seams no single wave could see: Duplicated Code, Repeated Switches, Shotgun Surgery, Divergent Change (Fowler, _Refactoring_ ch.3). This is the one place the pipeline looks beyond written rules — the target is parallel-implementation drift, not style, and its findings route like any other: mechanical consolidations auto-resolve, only genuine trade-offs escalate.
- **Requirements-union check** — one agent reads the spec kernel with its full Decision Index against the whole diff's file list and checks every requirement is implemented *somewhere*, fetching decisions by ID as needed. Absent from the changed files ≠ unimplemented — it may pre-exist; each suspect goes to a small checker agent before becoming a finding.
- New findings (`C<k>-…` IDs) run through the same validate → propose → validate → route stages as a wave's, with the same dedup against all prior summaries.
- The **deferred queue** — every `deferred-to-close` block from the ledger — joins the escalation queue as-is (already validated, already proposed; don't re-run their stages).

Everything escalated at the closing pass gets asked — there is no spec-only gate here; this is the run's last look. Notify, ask, act, post the closing summary.

- Closing answers and auto-tickets create spec children → the frontier is non-empty again → **loop back to step 2**. The run keeps going until a closing pass comes back clean.
- **Convergence guard**: a wave or closing round that fails to shrink — as many new findings as the last, or repeat escalations of the same class — is a signal, not a lap to repeat: recurring `spec-suspect` means the spec is under-specified in a systematic way; recurring pervasive patterns mean a standard is waiting to be written. Say so plainly; the next move is sharpening those documents.

### 6. Done

A closing pass whose escalations are all answered and whose auto-tickets are all landed ends the run. Push notification, then the report: per ticket — commits; per wave — the audit trail (auto-applies with SHAs, auto-tickets, refutations) and the questions asked with their answers; parked tickets and exactly what each needs. Then run the *Green* set per `/testing` once more and offer the PR whose body `Closes #<spec>`. **Suppress the offer while the spec has open children** — including parked tickets; offer a plain PR (no `Closes`) instead. Only open either if the user says yes. If the user then asks to merge it, **squash-merge** — the spec lands as one commit on the default branch, not its ticket-by-ticket history. Under `/next auto` with a live merge authorization (its auto-config comment), the conductor *is* the explicit ask: open the `Closes` PR and squash-merge without a fresh prompt — the suppression rule and the authorization's void condition (per `/next`) still hold.

## What is local to this gate

The pipeline itself — stages, chunking, adversarial validation, edge fields, routing, the fix and ticket agents, gate markers, question mechanics, the five question classes and their option shapes — is `/finding-pipeline`, code-gate section included, and none of it is restated here. What follows is only what the contract delegates to ship.

Finding IDs and gate markers are as in *The ledger*; the pending-questions comment goes on the spec issue.

**Fill rules that change behaviour.** If `/conventions` finds nothing scoped to the touched files, fill `STANDARDS_SOURCES` with `[]` — that idles the standards axis, and the ledger notes "no documented standards — standards axis idle". If the repo has no `TESTING.md`, fill `TEST_NOTES` with `""`, and the wave summary carries "no TESTING.md — agents discovered test commands".

**Reviewers — one per axis**, over the integrated wave so they see how parallel tickets compose:

- **Standards reviewer** (only when documented standards exist) — every place the diff breaks a written rule, each citing the rule; no taste.
- **Spec reviewer** — this wave's tickets' acceptance criteria missing or partial, behaviour not asked for, and requirements implemented wrong; spec silence is a question only when another owner could defensibly want different behaviour.

**Partition.** A wave too wide for one reader per axis (soft heuristic: >~15 files or ~1,500 changed lines) partitions exactly as `/diff-review` does. Most waves won't need this — findings scale with reviewer count.

**Scope, wave-shaped.** The contract's *The diff is the material* binds unchanged. One thing is local: the spec axis's missing-requirement carve-out covers only **this wave's tickets**, not the whole spec — whole-spec coverage is the closing pass's requirements-union check.

**The gate is spec-axis only** (see *The gate* above): standards-axis escalations at an open gate record as `deferred-to-close` and the closing pass raises them. The contract's `stop` hatch therefore records untouched IDs as `unanswered` and re-raises them at the closing pass.

**Orientation summary** — one addition to the contract's: when the standards axis was idle, one line saying so — *"No documented standards; the standards axis checked nothing this wave. It activates when rules are written."*

## Authoring notes for the wave workflow

- **Model tiers, per `/model-policy`**, filled into the template's model slots; the template's stage calls assign each stage its tier. Executors carry out fully specified briefs under a net (tests, never-merge-on-red, the wave verification); deciders hold the stages whose judgment is the product — planning, reviewing, validating, proposing; auditors take the labeling stages and the closing pass's sweeper and requirements union. The post-answer fix agent the manager spawns after a question loop runs on the executor tier, at normal effort.
- Filling, schemas, chunked chains, the fresh assembler, and fill delegation follow the contract's *Workflow authoring invariants*.

## Relation to /diff-review

Both are code gates on the same contract; the differences are scope, not philosophy. `/diff-review`'s standards axis carries the full Fowler smell baseline on top of documented rules; this gate reviews written rules only, and the closing sweeper keeps just its four composition smells, aimed at parallel-implementation drift. Waves, the ledger, the spec-axis gate, and cross-session resumability belong to ship; `/diff-review` is a standalone, single-session review of any diff since a fixed point — branch, PR, or work-in-progress, spec or no spec.
