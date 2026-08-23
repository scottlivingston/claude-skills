---
name: ship
description: Implement a spec's ticket DAG wave by wave — plan, implement, and merge each wave with parallel agents in isolated worktrees, then verify its merged diff against the tickets' acceptance criteria and the repo's documented standards. Validated findings resolve themselves — auto-applied or auto-ticketed onto the next wave — and only unanswerable intent questions (spec unclear, competing fixes, pervasive patterns) reach the user, phrased in domain language; a wave with none rolls straight into the next. Re-entrant across sessions — all run state lives on the spec issue, so any session can resume at a wave boundary or a pending question. Runs after /tickets; ends by offering the PR that closes the spec. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

Ship turns an approved ticket DAG into committed, verified code, with verification running inside the run. Each wave's merged diff is checked against two things only: **did the tickets deliver their acceptance criteria** (spec axis) and **does the code break a documented standard** (standards axis). This is a verification gate, not a taste review — no reviewer opinions, no style crop.

**The policy: escalate questions about intent, auto-resolve questions about code.** The user is the spec authority, not a code reviewer — the run must never require them to hold the code in their head. Every validated finding with an uncontested fix resolves itself: applied and committed, or ticketed onto the next wave. What reaches the user is exactly the set of questions the pipeline *cannot* answer, because they are questions about what was meant:

- **`spec-suspect`** — the spec is silent or ambiguous on a case the code had to decide.
- **Competing fixes** — both axes found the same defect and their validated fixes are incompatible.
- **Genuine trade-off** — a fix validator concluded the choice is a judgement only the owner can make (`needs-human`).
- **No working fix** — the finding is real but every proposed fix was rejected or broke the suite (`fix-rejected`).
- **Pervasive pattern** — the violation exists outside the diff too (`repo-wide`); fixing three of forty instances is a codebase-direction decision, and possibly a rule waiting to be written.

Unanswered **spec-axis** questions close a gate: the next wave does not launch until the user answers them, so wave 2 never builds on a misread of the spec. A wave with no such questions posts its ledger and rolls straight into the next — a clean run stays AFK end to end.

The verification pipeline implements the invariant contract in `/finding-pipeline` — stage order, adversarial discipline, gate markers, question mechanics live there once, for this skill, `/diff-review`, and the document gates alike. What's local here is the wave-scale tuning (see *Relation to /diff-review* at the end); when an invariant needs changing, change the contract, not a copy.

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

Runs started while this skill was named `ship-hitl` wrote `ship-hitl` markers; when collecting the ledger, treat the two prefixes as equivalent (and keep writing whichever prefix the run's existing comments use, so one run never mixes both).

Finding IDs are wave-scoped and never reused: `W<n>-STD-<i>` / `W<n>-SPEC-<i>` for wave *n*, `C<k>-STD-<i>` / `C<k>-SPEC-<i>` for closing pass *k*. The summaries are the run's **adjudication memory**: every later wave's dedup stage reads them, so no finding is ever re-litigated — that is what makes the run converge.

## Process

### 1. Bootstrap — any session, idempotent

Every invocation starts the same way, whether it's the first session or a resume:

1. Read the spec in full — kernel plus addressable decisions per the tracker doc — including Testing Decisions, the **Seams under test** list, and the Decision Index.
2. List the spec's sub-issue tickets with states, blocking edges, claims, and the decision IDs each cites.
3. Read the spec issue's comments and collect the ledger: prior wave/closing summaries (adjudication memory), any pending-questions comment, open `review-finding` tickets.
4. Find or create the ship branch (`spec-<number>-<slug>`); check it out. Record the run's base: `git merge-base <default-branch> HEAD`.
5. Pick the resume point:
   - A **pending-questions comment with no matching summary** → resume at **the question loop** (step 4 below) from that comment. Do not re-run the wave's pipeline.
   - Otherwise compute the frontier. **Non-empty** → next wave (step 2), numbered one past the highest ledger wave. **Empty** → closing pass (step 5) — unless the latest closing summary is clean, in which case the run is done (step 6).
6. Report the resume point and the wave structure (what's frontier now, what unblocks when) before launching anything.

### 2. The wave workflow

Each wave runs as **one dynamic `Workflow`** (this skill is your authorization to use it). **Start from [workflow.template.js](workflow.template.js) — fill it, don't author from scratch.** Read the template and fill every `FILL` slot in its data block with the wave's tickets, decisions, and dedup inputs; everything below its FIXED marker — schemas, prompt builders, stage order, the merge chain, the routing — is the same every run; edit it only when this run genuinely deviates. An unfilled slot throws `FILL is not defined` at launch — loud, before any agent spawns. Fill prose slots as JSON string literals (double-quoted, `\n`-escaped), which no code span or apostrophe can terminate. The stage briefs below are the prompts the template embeds — keep the two in sync when either changes. The stages:

1. **Claim** — a `model: 'sonnet'` agent at low reasoning effort claims every frontier ticket (tracker doc's claim operation; bootstrap the markers first if needed) and verifies the claim check passes before any implementer spawns. Claims gate **implementers**, not planners — the plan stage launches alongside this agent, not after it.
2. **Plan** — one planner per frontier ticket, in parallel with each other and with the claim agent, **inheriting the session model** (a decide stage — see the model policy). Each explores the ship branch as it stands *now* and writes the ticket's implementation plan: where the work lands, the approach, the seams it will touch, the files it expects to change, and where the red tests go first. It gets exactly what its implementer will get — kernel, cited decisions in full, ticket body — and posts the plan as a **ticket comment** opening `<!-- ship wave-<n> plan -->`. Plans are wave-stamped and never reused: a ticket that parks and rides a later wave is planned again against that wave's HEAD, and resume never reads plan comments — they are audit trail, not run state. A planner that discovers the ticket can't be built as written — a decision the spec doesn't hold, work no listed seam covers — **parks it here**, before an implementer burns a session finding out. When all plans are in (a deliberate barrier, skipped when the wave has one ticket), a **collision check** stage reads the set and reconciles pairs that plan to reshape the same seam differently: where one shape can serve both, it amends the losing plan (a follow-up comment) so both implementers build against the shared shape; what it can't reconcile mechanically becomes a note baked into the merge stage's brief — the merge agent inherits the tension, never the human, and the verification pipeline reads the merged result regardless.
3. **Parallel implement** — one fresh agent per ticket, each in an **isolated worktree**, spawned with `model: 'sonnet'` (see the model policy in the authoring notes). Each gets the spec **kernel** (Testing Decisions and Seams under test verbatim, Decision Index included), the **full text of the decisions its ticket cites** — never the whole decision log — its ticket body, **its wave-stamped plan**, and the `/implement` + `/tdd` discipline: red–green at the spec's seams, typecheck regularly, run single test files regularly, commit in its worktree. First action: confirm the ticket carries `in-progress`. Never two tickets in one agent. The plan is a map, not a contract: an implementer that finds the code contradicts the plan deviates and notes the deviation in a ticket comment — the map was drawn minutes ago, but the territory wins. An agent needing an uncited decision checks the Decision Index, fetches it by ID, and notes the missed routing in a ticket comment. A decision the spec doesn't hold anywhere, or work no listed seam covers, **parks** the ticket: unclaim, comment what's missing on the ticket, comment the gap on the spec issue.
4. **Serial merge, in completion order** — worktree branches merge into the ship branch **one at a time, starting as each implementer finishes**: chain every branch's merge onto a shared promise rather than waiting for the whole implement stage, so the first-finished branch merges and tests while the slowest ticket is still implementing. Merges stay strictly serialized (merge and conflict agents run `model: 'sonnet'` — serialized, so model speed compounds with wave width); within a wave, tickets are dependency-free by construction, so completion order is safe. Affected tests after each merge (full suite if cheap). Any unreconciled collision notes from the plan stage ride in the merge brief. On conflict, a merge agent resolves preserving both tickets' intent, then re-tests. **Never merge on red** — a branch that can't come green is parked like any other. On green, close the ticket with a comment linking its commits and remove `in-progress`.
5. **Verification pipeline** over the wave's combined merged diff — the stages in *The wave pipeline* below, ending in the routing that auto-applies, auto-tickets, or escalates every survivor.
6. **Ledger post** — the workflow's final stage posts the pending-questions comment when escalations exist (see the gate), then returns the full routed queue: every finding with its route, question class, applied SHA or ticket number. That return value is all the manager sees of the pipeline.

A parked ticket doesn't stop the run unless it blocks everything — later frontiers exclude tickets whose blockers didn't land, and the run continues around them.

### 3. The gate

When the workflow returns, read the escalation queue — the findings routed to a human, each carrying its question class.

- **Any spec-axis escalation** (including any cross-axis pair — the pair's spec member closes the gate for both) → **the gate is closed.** Send a push notification (load via `ToolSearch("select:PushNotification")`; skip silently if unavailable), then go to the question loop (step 4).
- **No spec-axis escalation** → **the gate is open.** Standards-axis escalations (a pervasive pattern, a standards trade-off) are **not** raised now: record each as `deferred-to-close` (full question block) in the wave summary. Post the wave summary and launch the next wave immediately — no pause, no question. Auto-applies and auto-tickets never hold the gate: they are the pipeline doing its job, listed in the ledger for audit, not approval.

Either way the wave summary comment gets posted before anything else happens — refutations, auto-applies, and auto-tickets included, so the next wave's dedup remembers them.

### 4. The question loop at a closed gate

Runs in the manager session — this one, or any later session that bootstraps onto the pending-questions comment. Walk the **whole** escalation queue, standards escalations included (the user is warm; cold questions at the end are the expensive version), per *Question mechanics* below: orientation summary first, then one question per turn, then act on the answers (spec comments, fix agent, tickets, reverts), then post the wave summary recording every outcome.

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

## The wave pipeline

The verification stages inside each wave workflow (and, with `C<k>` IDs, the closing pass). This is ship's own copy of `/diff-review`'s pipeline — tuned for wave scale, maintained here.

**Inputs the manager bakes into the script** — the template's `FILL` slots (the workflow has no conversation context): the wave diff command — `git diff <pre-wave-SHA>...HEAD` where `<pre-wave-SHA>` is the ship branch at launch, before this wave's first merge (the wave's commits are created *inside* the run, so agents fetch the commit log themselves — it can't be baked at fill time); the spec **kernel** plus the full text of the union of decisions the wave's tickets cite (Decision Index included, so reviewers can fetch unrouted decisions by ID); the standards sources per `/conventions` with the directory scope each binds — **and if `/conventions` finds nothing scoped to the touched files, the standards reviewer stage is omitted from the script entirely** and the ledger notes "no documented standards — standards axis idle"; the dedup inputs — open `review-finding` tickets and all prior ledger summaries, fetched pre-launch.

### Reviewers — one per axis

**Standards reviewer** (only when documented standards exist): gets the diff command, commit list, and the standards sources with their scopes (nearest scope wins; scoped files read as deltas over root). Brief: "Report — per file/hunk where relevant — every place the diff violates a **written rule**: cite the standard (file + rule) for each. If no written rule covers something, it is not a finding — do not report taste, smells, or conventions you would personally prefer. A finding that looks like a pattern with a statable grep signature: grep outside the diff and flag `repo-wide` only with the grep and both counts attached. Skip anything tooling enforces. Under 300 words."

**Spec reviewer**: gets the diff command, commit list, and the kernel-plus-cited-decisions. Brief: "Report: (a) acceptance criteria or requirements that are missing or partial; (b) behaviour not asked for (scope creep); (c) requirements implemented wrong. Treat decision snippets — state machines, schemas, contracts — as requirements; divergence from one is a finding. Where the spec is **silent** on a case the diff had to decide, that is not a violation — report it as a spec question only when the choice is consequential, stating the case and the choice the code made. Quote the spec line, with its decision ID where it has one, per finding. Under 400 words." Reviewing the integrated wave rather than each ticket alone is deliberate: it sees how parallel tickets compose.

A wave too wide for one reader per axis (soft heuristic: >~15 files or ~1,500 changed lines) partitions exactly as `/diff-review` does: one cheap partition stage clusters files into subsystem groups aligned with scoped-standards boundaries and routes cited decisions to groups; both axes share the partition; one in-wave cross-cutting sweeper and a requirements-union over the chunks restore what partitioning breaks. Most waves won't need this. Findings scale with reviewer count, so don't partition a wave that doesn't need it.

### Labeling and dedup

A labeling stage normalizes the reports into discrete findings — ID (`W<n>-STD-<i>` / `W<n>-SPEC-<i>`), `file:line`, one-line description, cited source (rule or spec line), `repo-wide` flag. Never merge or rerank across axes. Mark **cross-axis pairs** — a Standards and a Spec finding on the same file and overlapping lines are one defect wearing two labels; the pair stays two findings but routes as a unit.

Dedup, conservatively, against: **open `review-finding` tickets** — a finding predating this diff that matches → **already ticketed: #N**, out of the queue; a finding this diff introduces matching a ticketed pattern → **instance of open #N**, stays in; uncertain → **possibly duplicates #N**, stays in. And against **every prior ledger summary**: a finding already adjudicated in any earlier wave — auto-applied, auto-ticketed, answered, deferred, or refuted — → **already adjudicated (<outcome>)**, out of the queue, one line in the wave summary.

### Validate each finding — adversarially, before any fix exists

Fresh validator agents that did not author the findings, prompted to **refute the finding itself**, one per chunk of ~5 findings, chunks in parallel — each chunk rides its own validate → propose → validate-fix chain with no cross-chunk barrier. Each gets its findings, diff command, commit list with full messages, and both axes' inputs, and answers: is the finding real? Read the cited source and the actual hunk; does the claimed harm survive what tooling already guarantees?

Two calls belong here: **Spec classification** — `code-diverges` (spec unambiguous, code doesn't match, fix mechanical) vs `spec-suspect` (the *spec* may be silent, ambiguous, or wrong; check commit messages and tests for deliberate deviation; **any doubt → `spec-suspect`**). And a validator may raise `repo-wide` the reviewer missed, with the same grep-and-counts evidence.

Verdict: **`finding-refuted`** (with reason — leaves the pipeline, recorded in the wave summary so dedup remembers) or **`finding-validated`** (proceeds).

### Propose a fix per survivor

One proposer per chunk, in parallel, given its chunk's survivors with the validators' reasoning — chunk-mates share context, so overlapping fixes get drafted coherently. Brief: "For each finding, the smallest concrete fix: what to change, where — anchored by file plus a short quoted snippet, not a bare line number — and a sketch, not a patch. Size each: `quick-fix` or `needs-a-session`. Under 100 words each." A `spec-suspect` finding gets a fix sketch *per plausible reading* where that's cheap — the user's answer picks one.

### Validate each proposal — adversarially, independently

Fresh validators — not the proposers, not the finding validators — prompted to **refute the fix**, one per chunk in parallel, each also given the whole axis's finding roster (IDs, files, one-liners) so the edge fields can name findings outside its chunk. Checks: does it resolve the finding; is it proportionate; does it compile-plausibly; **cross-axis** — a Spec fix must not introduce a Standards violation and vice versa, and for a cross-axis pair this stage settles **`pairResolution: 'agreeing' | 'competing'`** as a schema field — agreeing means both proposals are compatible or identical in effect, competing means they cannot both land; **re-settle `repo-wide`** with counts as schema fields (`instancesInDiff`, `instancesOutsideDiff`; the flag holds only when `instancesOutsideDiff > 0`) — this stage has the last word on the flag.

Verdict: **`validated`**, **`fix-rejected`** (reason), or **`needs-human`** (a genuine trade-off). The finding's reality is settled — doubt goes in the `fix-rejected` reason, and the finding still escalates. The schema carries two edge fields, never prose: `dependsOn: [IDs]` and `invalidatedBy: [IDs]` — routing acts on them.

### Route every survivor

Plain script logic over the schema fields — no agent decides this:

1. **Escalate** — route to the human — when **any** hold: `spec-suspect`; `needs-human`; `fix-rejected`; member of a **competing** cross-axis pair; `repo-wide` (`instancesOutsideDiff > 0`). Each escalation gets a question class from the policy list and joins the queue.
2. Otherwise **auto-apply** when: `validated` and `quick-fix`. Agreeing cross-axis pairs auto-apply as a unit — one commit covering both IDs. `dependsOn` edges among auto-applying findings order the batch; they never block it.
3. Otherwise **auto-ticket**: `validated` and `needs-a-session`.
4. **Edges route together**: a finding whose `dependsOn` target auto-tickets joins that ticket; whose target escalated, joins the escalation as context (its fix waits on the answer). A proposal `invalidatedBy` a finding that auto-applied gets its stale premise re-grounded by the fix agent before applying; `invalidatedBy` an escalated finding → escalate together.

**The auto-apply agent** — one `model: 'sonnet'` fix agent in the main checkout — never parallel worktrees — which **re-derives both preconditions itself, as its first act**: `git status --porcelain` (dirty tree → whole tier demotes to auto-ticket; never commit around a user's uncommitted work) and `git rev-parse --abbrev-ref HEAD` (default branch without an explicit user OK → demote). Report *which*: "demoted: dirty tree" and "demoted: couldn't verify preconditions" are different lines, and only the second is a bug to chase. It applies the batch serially in dependency order, **one commit per finding ID** (`review: W2-STD-3 — <one-liner>`; one commit per pair for agreeing pairs), runs the full test suite once at the end, reverts any finding-commit that breaks it, and escalates that finding as **no working fix** with the failure attached.

**The auto-ticket agent** — `model: 'sonnet'` at low reasoning effort, pure tracker mechanics: clusters findings by file while the combined work fits one session; each ticket a **child of the spec** with labels `impl` + `ready-for-agent` + `review-finding`, body carrying the findings, why they matter, the validated proposals, and anchors by file + quoted snippet. These join the next frontier automatically — review rework rides the next wave without anyone asking.

## Question mechanics

**Open with the orientation summary** — the audit digest first: findings raised → refuted → auto-applied (IDs + SHAs) → auto-ticketed (ticket #s), stated as *done*, not proposed; the user can override any of it by free text (`revert W2-STD-7`) and the manager `git revert`s that finding's commit or closes the ticket. Then the escalation count by question class, and — when the standards axis was idle — one line saying so: *"No documented standards; the standards axis checked nothing this wave. It activates when rules are written."* Never dump the question blocks here.

**One question per turn.** Order: spec questions before standards questions; within each, the ones later work most likely builds on first. Per escalation, print its block per `/hitl-questions` (anchors and code excerpts arrive on request, via `explain`):

```
### W2-SPEC-9 — spec question — 2 of 3
- **The question:** <one line, in the domain's terms>
- **What the spec says:** <quoted line + decision ID, or "the spec is silent here">
- **What the code does today:** <one line, behavior not implementation>
- **Why it needs you:** spec unclear | competing fixes | genuine trade-off | no working fix | pervasive pattern
- **Options:** <each option as a behavior choice, with its consequence and what it triggers — fix now, ticket, spec comment>
- **Recommendation:** <the option you'd pick and the one-line why>
```

— then ask with `AskUserQuestion` per `/hitl-questions`. Class-specific shapes:

- **Spec unclear** (`spec-suspect`) — the options are the plausible readings, plus "the code is right as written". The block carries a **draft spec comment** for the chosen reading — posted to the spec issue only on the user's verdict, so the spec accretes the answer and no later wave re-asks it.
- **Competing fixes** — one question for the pair: which behavior wins. The verdict settles both IDs; the losing fix is recorded rejected.
- **Genuine trade-off** — the trade-off's horns as options, consequences stated.
- **No working fix** — options: ticket it for a fresh attempt with the failure attached, or leave it (recorded, with the reason).
- **Pervasive pattern** — options: **adopt as rule** (a standalone ticket — not a spec child — labeled `review-finding` + `needs-triage`, carrying the pattern, the grep evidence, and a task to append the rule to the governing `CONVENTIONS.md`; a parking lot nothing works until the user picks it up), **fix everywhere** (spec-child ticket covering all instances), or **leave as-is**.

`/hitl-questions`' escape hatches bind here as: `explain` answered then the same ID re-asked; batched answers taken as given; "stop" recording untouched IDs as `unanswered`, re-raised at the closing pass.

**Act on the collected answers** — none of them mid-loop: post the chosen spec comments; run one serial fix agent (Sonnet, same discipline as auto-apply: re-ground each proposal against current `HEAD` by quoted snippet, one commit per ID, full suite at the end, breakers reverted and re-escalated) for fixes the answers unlocked; file the tickets the answers called for; `git revert` anything the audit overrode. Post the wave summary recording every outcome — completeness there is what makes the run converge.

## Authoring notes for the wave workflow

- **Model policy: executors run Sonnet, deciders inherit.** Agents that **execute a fully specified brief** pass `model: 'sonnet'`: the claim agent (pure tracker mechanics), the implementers (the wall-clock bottleneck — routinely 30+ min per wave on a bigger model — working from fully specified tickets plus a wave-fresh plan), the merge/conflict agents (serialized, so speed compounds; netted by never-merge-on-red and the wave verification reading the merged diff), the auto-ticket agent, and both fix agents — auto-apply and post-answer (sketches already validated; netted by the test suite, per-finding revertible commits, and the audit-revert loop). Agents that **decide** omit `model` and inherit the creating session's model: **the planners and the collision check** (choosing the approach is the decide half of implementing — the plan stage exists to move it off the executor tier, so Sonnet only executes the map), the partition stage, both reviewers, **labeling** (its dedup calls enforce the adjudication memory, and a wrong suppression there is the one silent failure no downstream net catches), both validator passes, and the proposers. **Routing is plain script logic over schema fields — never an agent.** Every Sonnet stage sits under at least one net; the planners are the one inherited stage on the wall-clock critical path, and they're cheap there — minutes of exploration ahead of a 30-minute Sonnet implement leg.
- **Fill the template; inline, don't thread.** The template threads nothing through `args` — it has been observed arriving as a JSON *string*, so `${args.x}` interpolates the literal `undefined` and nothing fails loudly. Bake ticket bodies, decisions, and dedup inputs into the `FILL` slots at fill time, as JSON string literals (double-quoted, `\n`-escaped) — immune to the backticks and apostrophes that terminate template literals and kill the launch with a parse error. The pre-wave SHA slot is the ship branch's HEAD at launch — the workflow's own merges land after it, so it is the wave diff's fixed point.
- **The fill may be delegated.** Every fill input is tracker-sourced by construction, so a fresh **fill agent** loses nothing the manager has: it reads the spec, tickets, and ledger, writes the filled script to a file, and returns the path plus a one-line manifest; the manager launches with `Workflow({scriptPath})`. Under `/next auto` this is the rule, not an option — the conductor's context holds returns and ledgers, never fills.
- Give every stage a `schema` so verdicts come back as typed enum fields, never prose the manager interprets — the routing step depends on it. Run findings through validate → propose → validate-fix as **chunked `pipeline` chains** (~5 findings per chunk, one agent per chunk per stage, no cross-chunk barriers); the deliberate barriers are the routing step, the serial fix agent, and the ledger post. Chain merges onto a shared promise in implementer-completion order — serialized, never a wait-for-all barrier. Pure-mechanics Sonnet stages (claim, auto-ticket) also pass `effort: 'low'`; the fix agents don't — multi-file edits plus a suite run and reverts are not low-effort work.
- The pending-questions comment is posted **by the workflow** (its final stage), not the manager — the queue must be durable even if the session dies the moment the workflow returns.

## Relation to /diff-review

This skill's pipeline is a fork of `/diff-review`'s, re-tuned for the wave gate — and `/diff-review` has since back-adopted the fork's core: the same **escalate-intent / auto-resolve-code routing**, the same five question classes, the same auto-apply and auto-ticket agents, the same question mechanics. The remaining differences are scope, not philosophy:

- **The smell baseline.** `/diff-review`'s standards axis keeps the full Fowler smell baseline on top of documented rules — smells enter as hypotheses, survive adversarial validation, and then route like any other finding. This gate reviews written rules only; the closing sweeper keeps just its four composition smells, aimed at parallel-implementation drift.
- **The run machinery.** Waves, the ledger, the spec-axis gate, and cross-session resumability belong to ship. `/diff-review` is a standalone, single-session review of any diff since a fixed point — branch, PR, or work-in-progress, spec or no spec.

(This skill replaced an earlier `/ship` that ran no-human-until-the-end: its lightweight wave review and "confident fixes" agent became the verification pipeline, its end-of-run handoff to `/diff-review` became the closing pass, and its cross-skill ship ↔ review ↔ `/next` lap became review tickets rejoining the frontier in-run.)
