---
name: ship-hitl
description: Experimental variant of /ship — implement a spec's ticket DAG wave by wave, verifying each wave's merged diff against its acceptance criteria and the repo's documented standards, with a human gate between waves. Validated findings resolve themselves — auto-applied or auto-ticketed onto the next wave — and only unanswerable intent questions (spec unclear, competing fixes, pervasive patterns) reach the user, phrased in domain language. Re-entrant across sessions — all run state lives on the spec issue, so any session can resume at a wave boundary or a pending question. Runs after /to-tickets. Invoke only when the user explicitly asks for it — never spontaneously; /next does not route here while the experiment lasts.
---

Ship-hitl turns an approved ticket DAG into committed, verified code — like `/ship`, but the verification moves inside the run. Each wave's merged diff is checked against two things only: **did the tickets deliver their acceptance criteria** (spec axis) and **does the code break a documented standard** (standards axis). This is a verification gate, not a taste review — no reviewer opinions, no style crop.

**The policy: escalate questions about intent, auto-resolve questions about code.** The user is the spec authority, not a code reviewer — the run must never require them to hold the code in their head. Every validated finding with an uncontested fix resolves itself: applied and committed, or ticketed onto the next wave. What reaches the user is exactly the set of questions the pipeline *cannot* answer, because they are questions about what was meant:

- **`spec-suspect`** — the spec is silent or ambiguous on a case the code had to decide.
- **Competing fixes** — both axes found the same defect and their validated fixes are incompatible.
- **Genuine trade-off** — a fix validator concluded the choice is a judgement only the owner can make (`needs-human`).
- **No working fix** — the finding is real but every proposed fix was rejected or broke the suite (`fix-rejected`).
- **Pervasive pattern** — the violation exists outside the diff too (`repo-wide`); fixing three of forty instances is a codebase-direction decision, and possibly a rule waiting to be written.

Unanswered **spec-axis** questions close a gate: the next wave does not launch until the user answers them, so wave 2 never builds on a misread of the spec. A wave with no such questions posts its ledger and rolls straight into the next — a clean run stays AFK end to end.

This skill is an **experiment**: a self-contained fork of `/ship` plus `/two-axis-review`'s pipeline. Those skills stay unchanged and authoritative for their own flows; this doc owns its own copy of the pipeline and may diverge from theirs. If the experiment graduates, the pipeline gets extracted into a shared skill both cite.

The user invokes with a **spec** (issue URL/number) whose implementation tickets already exist as its sub-issues. For the issue tracker, invoke `/issue-tracker`; for standards sources, `/conventions`.

## Guardrails

- **Wrong entry point?** Redirect, don't improvise: a spec with no tickets → run `/to-tickets <spec>` (HITL) first. A wayfinder map → `/to-spec <map>` first.
- **Branch discipline**: if on the default branch, create `spec-<number>-<slug>` and work there. The whole run lands on one branch; one PR closes the spec at the end.
- Never merge to shared branches, push, or open PRs unless the user asked explicitly.
- **The manager orchestrates and asks — nothing else.** Implementation, merging, review, fixes, ticket filing, and tracker updates all happen inside workflow agents. The manager's own work is authoring workflows, reading their returns, running the question loop, and posting ledger comments.
- **Waves are derived, never stored.** The durable truth is the ticket DAG plus the spec issue's ledger comments. The frontier — open tickets with no open blocker and no claim — is recomputed from the tracker at every wave boundary, so parked tickets drop out and mid-run review tickets join in automatically.
- **No taste findings.** The standards axis reports breaches of written rules only. If `/conventions` finds nothing scoped to the touched files, the axis is idle and the ledger says so plainly — the axis activates when rules get written, not before. Style and design review belong to `/two-axis-review` and `/simplify`, run deliberately, not to this gate.

## The ledger

All run state a future session needs lives as comments on the **spec issue**, each opening with a machine-findable marker (these are process comments — never the tracker doc's spec-decision marker):

- `<!-- ship-hitl wave-<n> pending-questions -->` — posted by the wave workflow's **final stage** when the gate closes: the full question blocks for every escalation awaiting an answer, plus the audit digest of the wave's auto-actions (applied SHAs, filed ticket numbers, refutations). Durable *before* any answer happens, so the question loop can run in a different session than the one that launched the workflow.
- `<!-- ship-hitl wave-<n> summary -->` — the round summary, posted by the manager after the wave is settled: **every** finding ID with its terminal outcome — auto-applied (SHA), auto-ticketed (#N), refuted by a validator (one-line reason), answered (the verdict and what it triggered — spec comment posted, fix applied, ticket #N, rule ticket #N, left as-is), reverted on audit, or **`deferred-to-close`** (standards-axis escalations at an open gate). Deferred entries carry their full question block, not a one-liner — the closing pass raises them cold from this comment alone. Also: tickets landed, tickets parked, next-wave notes.
- `<!-- ship-hitl closing-<k> pending-questions -->` / `<!-- ship-hitl closing-<k> summary -->` — the closing pass's equivalents.

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

Each wave runs as **one dynamic `Workflow`** (this skill is your authorization to use it), authored fresh by the manager with the wave's tickets, decisions, and dedup inputs baked in. Its stages:

1. **Claim** — a `model: 'sonnet'` agent claims every frontier ticket (tracker doc's claim operation; bootstrap the markers first if needed) and verifies the claim check passes before any implementer spawns.
2. **Parallel implement** — one fresh agent per ticket, each in an **isolated worktree**, spawned with `model: 'sonnet'` (see the model policy in the authoring notes). Each gets the spec **kernel** (Testing Decisions and Seams under test verbatim, Decision Index included), the **full text of the decisions its ticket cites** — never the whole decision log — its ticket body, and the `/implement` + `/tdd` discipline: red–green at the spec's seams, typecheck regularly, run single test files regularly, commit in its worktree. First action: confirm the ticket carries `in-progress`. Never two tickets in one agent. An agent needing an uncited decision checks the Decision Index, fetches it by ID, and notes the missed routing in a ticket comment. A decision the spec doesn't hold anywhere, or work no listed seam covers, **parks** the ticket: unclaim, comment what's missing on the ticket, comment the gap on the spec issue.
3. **Serial merge** — finished worktree branches merge into the ship branch **one at a time** (merge and conflict agents run `model: 'sonnet'` — the merges are serialized, so model speed compounds with wave width), affected tests after each merge (full suite if cheap). On conflict, a merge agent resolves preserving both tickets' intent, then re-tests. **Never merge on red** — a branch that can't come green is parked like any other. On green, close the ticket with a comment linking its commits and remove `in-progress`.
4. **Verification pipeline** over the wave's combined merged diff — the stages in *The wave pipeline* below, ending in the routing that auto-applies, auto-tickets, or escalates every survivor.
5. **Ledger post** — the workflow's final stage posts the pending-questions comment when escalations exist (see the gate), then returns the full routed queue: every finding with its route, question class, applied SHA or ticket number. That return value is all the manager sees of the pipeline.

A parked ticket doesn't stop the run unless it blocks everything — later frontiers exclude tickets whose blockers didn't land, and the run continues around them.

### 3. The gate

When the workflow returns, read the escalation queue — the findings routed to a human, each carrying its question class.

- **Any spec-axis escalation** (including any cross-axis pair — the pair's spec member closes the gate for both) → **the gate is closed.** Send a push notification (load via `ToolSearch("select:PushNotification")`; skip silently if unavailable), then go to the question loop (step 4).
- **No spec-axis escalation** → **the gate is open.** Standards-axis escalations (a pervasive pattern, a standards trade-off) are **not** raised now: record each as `deferred-to-close` (full question block) in the wave summary. Post the wave summary and launch the next wave immediately — no pause, no question. Auto-applies and auto-tickets never hold the gate: they are the pipeline doing its job, listed in the ledger for audit, not approval.

Either way the wave summary comment gets posted before anything else happens — refutations, auto-applies, and auto-tickets included, so the next wave's dedup remembers them.

### 4. The question loop at a closed gate

Runs in the manager session — this one, or any later session that bootstraps onto the pending-questions comment. Walk the **whole** escalation queue, standards escalations included (the user is warm; cold questions at the end are the expensive version), per *Question mechanics* below: orientation summary first, then one question per turn, then act on the answers (spec comments, fix agent, tickets, reverts), then post the wave summary recording every outcome.

Then **checkpoint**: state is fully durable, so end the turn with the choice stated plainly — continue with the next wave here, or run `/ship-hitl <spec>` in a fresh session; both resume identically from the tracker. Don't launch the next wave unprompted after a question loop: the checkpoint is the session-boundary the gate exists to offer.

Tickets filed by answers (and by auto-ticketing) are spec children — the next frontier computation picks them up, so review rework rides the very next wave.

### 5. The closing pass

When the frontier is empty, run one last workflow over the **whole branch diff** (`git diff <run-base>...HEAD`). Per-wave verification is a partition in time, and it is blind to seams *between* waves — parallel agents that never saw each other's code, in different waves, converging on the same shapes. The closing pass restores the whole-diff view and drains the deferred queue:

- **Cross-wave sweeper** — one agent reads the whole diff at low resolution (file list and hunk headers, reading closer only where suspicious), hunting only the four cross-file composition seams no single wave could see: Duplicated Code, Repeated Switches, Shotgun Surgery, Divergent Change (Fowler, _Refactoring_ ch.3). This is the one place the pipeline looks beyond written rules — the target is parallel-implementation drift, not style, and its findings route like any other: mechanical consolidations auto-resolve, only genuine trade-offs escalate.
- **Requirements-union check** — one agent reads the spec kernel with its full Decision Index against the whole diff's file list and checks every requirement is implemented *somewhere*, fetching decisions by ID as needed. Absent from the changed files ≠ unimplemented — it may pre-exist; each suspect goes to a small checker agent before becoming a finding.
- New findings (`C<k>-…` IDs) run through the same validate → propose → validate → route stages as a wave's, with the same dedup against the full adjudication memory.
- The **deferred queue** — every `deferred-to-close` block from the ledger — joins the escalation queue as-is (already validated, already proposed; don't re-run their stages).

Everything escalated at the closing pass gets asked — there is no spec-only gate here; this is the run's last look. Notify, ask, act, post the closing summary.

- Closing answers and auto-tickets create spec children → the frontier is non-empty again → **loop back to step 2**. The run keeps going until a closing pass comes back clean.
- **Convergence guard**: a wave or closing round that fails to shrink — as many new findings as the last, or repeat escalations of the same class — is a signal, not a lap to repeat: recurring `spec-suspect` means the spec is under-specified in a systematic way; recurring pervasive patterns mean a standard is waiting to be written. Say so plainly; the next move is sharpening those documents.

### 6. Done

A closing pass whose escalations are all answered and whose auto-tickets are all landed ends the run. Push notification, then the report: per ticket — commits; per wave — the audit trail (auto-applies with SHAs, auto-tickets, refutations) and the questions asked with their answers; parked tickets and exactly what each needs. Then run the full test suite once more and offer the PR whose body `Closes #<spec>`. **Suppress the offer while the spec has open children** — including parked tickets; offer a plain PR (no `Closes`) instead. Only open either if the user says yes.

## The wave pipeline

The verification stages inside each wave workflow (and, with `C<k>` IDs, the closing pass). This is ship-hitl's own copy — tuned for wave scale, maintained here.

**Inputs the manager bakes into the script** (the workflow has no conversation context): the wave diff command — `git diff <pre-wave-SHA>...HEAD` where `<pre-wave-SHA>` is the ship branch before this wave's first merge — and the wave's commit list with full messages; the spec **kernel** plus the full text of the union of decisions the wave's tickets cite (Decision Index included, so reviewers can fetch unrouted decisions by ID); the standards sources per `/conventions` with the directory scope each binds — **and if `/conventions` finds nothing scoped to the touched files, the standards reviewer stage is omitted from the script entirely** and the ledger notes "no documented standards — standards axis idle"; the dedup inputs — open `review-finding` tickets and all prior ledger summaries, fetched pre-launch.

### Reviewers — one per axis

**Standards reviewer** (only when documented standards exist): gets the diff command, commit list, and the standards sources with their scopes (nearest scope wins; scoped files read as deltas over root). Brief: "Report — per file/hunk where relevant — every place the diff violates a **written rule**: cite the standard (file + rule) for each. If no written rule covers something, it is not a finding — do not report taste, smells, or conventions you would personally prefer. A finding that looks like a pattern with a statable grep signature: grep outside the diff and flag `repo-wide` only with the grep and both counts attached. Skip anything tooling enforces. Under 300 words."

**Spec reviewer**: gets the diff command, commit list, and the kernel-plus-cited-decisions. Brief: "Report: (a) acceptance criteria or requirements that are missing or partial; (b) behaviour not asked for (scope creep); (c) requirements implemented wrong. Treat decision snippets — state machines, schemas, contracts — as requirements; divergence from one is a finding. Where the spec is **silent** on a case the diff had to decide, that is not a violation — report it as a spec question only when the choice is consequential, stating the case and the choice the code made. Quote the spec line, with its decision ID where it has one, per finding. Under 400 words." Reviewing the integrated wave rather than each ticket alone is deliberate: it sees how parallel tickets compose.

A wave too wide for one reader per axis (soft heuristic: >~15 files or ~1,500 changed lines) partitions exactly as `/two-axis-review` does: one cheap partition stage clusters files into subsystem groups aligned with scoped-standards boundaries and routes cited decisions to groups; both axes share the partition; one in-wave cross-cutting sweeper and a requirements-union over the chunks restore what partitioning breaks. Most waves won't need this. Findings scale with reviewer count, so don't partition a wave that doesn't need it.

### Labeling and dedup

A labeling stage normalizes the reports into discrete findings — ID (`W<n>-STD-<i>` / `W<n>-SPEC-<i>`), `file:line`, one-line description, cited source (rule or spec line), `repo-wide` flag. Never merge or rerank across axes. Mark **cross-axis pairs** — a Standards and a Spec finding on the same file and overlapping lines are one defect wearing two labels; the pair stays two findings but routes as a unit.

Dedup, conservatively, against: **open `review-finding` tickets** — a finding predating this diff that matches → **already ticketed: #N**, out of the queue; a finding this diff introduces matching a ticketed pattern → **instance of open #N**, stays in; uncertain → **possibly duplicates #N**, stays in. And against **every prior ledger summary**: a finding already adjudicated in any earlier wave — auto-applied, auto-ticketed, answered, deferred, or refuted — → **already adjudicated (<outcome>)**, out of the queue, one line in the wave summary.

### Validate each finding — adversarially, before any fix exists

Fresh validator agents that did not author the findings, prompted to **refute the finding itself**, one per finding in parallel (past 8, batch per axis). Each gets the finding, diff command, commit list with full messages, and both axes' inputs, and answers: is the finding real? Read the cited source and the actual hunk; does the claimed harm survive what tooling already guarantees?

Two calls belong here: **Spec classification** — `code-diverges` (spec unambiguous, code doesn't match, fix mechanical) vs `spec-suspect` (the *spec* may be silent, ambiguous, or wrong; check commit messages and tests for deliberate deviation; **any doubt → `spec-suspect`**). And a validator may raise `repo-wide` the reviewer missed, with the same grep-and-counts evidence.

Verdict: **`finding-refuted`** (with reason — leaves the pipeline, recorded in the wave summary so dedup remembers) or **`finding-validated`** (proceeds).

### Propose a fix per survivor

One proposer per axis, in parallel, given its axis's survivors with the validators' reasoning. Brief: "For each finding, the smallest concrete fix: what to change, where — anchored by file plus a short quoted snippet, not a bare line number — and a sketch, not a patch. Size each: `quick-fix` or `needs-a-session`. Under 100 words each." A `spec-suspect` finding gets a fix sketch *per plausible reading* where that's cheap — the user's answer picks one.

### Validate each proposal — adversarially, independently

Fresh validators — not the proposers, not the finding validators — prompted to **refute the fix**, one per proposal in parallel (past 8, batch per axis). Checks: does it resolve the finding; is it proportionate; does it compile-plausibly; **cross-axis** — a Spec fix must not introduce a Standards violation and vice versa, and for a cross-axis pair this stage settles **`pairResolution: 'agreeing' | 'competing'`** as a schema field — agreeing means both proposals are compatible or identical in effect, competing means they cannot both land; **re-settle `repo-wide`** with counts as schema fields (`instancesInDiff`, `instancesOutsideDiff`; the flag holds only when `instancesOutsideDiff > 0`) — this stage has the last word on the flag.

Verdict: **`validated`**, **`fix-rejected`** (reason), or **`needs-human`** (a genuine trade-off). The finding's reality is settled — doubt goes in the `fix-rejected` reason, and the finding still escalates. The schema carries two edge fields, never prose: `dependsOn: [IDs]` and `invalidatedBy: [IDs]` — routing acts on them.

### Route every survivor

Plain script logic over the schema fields — no agent decides this:

1. **Escalate** — route to the human — when **any** hold: `spec-suspect`; `needs-human`; `fix-rejected`; member of a **competing** cross-axis pair; `repo-wide` (`instancesOutsideDiff > 0`). Each escalation gets a question class from the policy list and joins the queue.
2. Otherwise **auto-apply** when: `validated` and `quick-fix`. Agreeing cross-axis pairs auto-apply as a unit — one commit covering both IDs. `dependsOn` edges among auto-applying findings order the batch; they never block it.
3. Otherwise **auto-ticket**: `validated` and `needs-a-session`.
4. **Edges route together**: a finding whose `dependsOn` target auto-tickets joins that ticket; whose target escalated, joins the escalation as context (its fix waits on the answer). A proposal `invalidatedBy` a finding that auto-applied gets its stale premise re-grounded by the fix agent before applying; `invalidatedBy` an escalated finding → escalate together.

**The auto-apply agent** — one `model: 'sonnet'` fix agent in the main checkout — never parallel worktrees — which **re-derives both preconditions itself, as its first act**: `git status --porcelain` (dirty tree → whole tier demotes to auto-ticket; never commit around a user's uncommitted work) and `git rev-parse --abbrev-ref HEAD` (default branch without an explicit user OK → demote). Report *which*: "demoted: dirty tree" and "demoted: couldn't verify preconditions" are different lines, and only the second is a bug to chase. It applies the batch serially in dependency order, **one commit per finding ID** (`review: W2-STD-3 — <one-liner>`; one commit per pair for agreeing pairs), runs the full test suite once at the end, reverts any finding-commit that breaks it, and escalates that finding as **no working fix** with the failure attached.

**The auto-ticket agent** — `model: 'sonnet'`, pure tracker mechanics: clusters findings by file while the combined work fits one session; each ticket a **child of the spec** with labels `impl` + `ready-for-agent` + `review-finding`, body carrying the findings, why they matter, the validated proposals, and anchors by file + quoted snippet. These join the next frontier automatically — review rework rides the next wave without anyone asking.

## Question mechanics

**Open with the orientation summary** — the audit digest first: findings raised → refuted → auto-applied (IDs + SHAs) → auto-ticketed (ticket #s), stated as *done*, not proposed; the user can override any of it by free text (`revert W2-STD-7`) and the manager `git revert`s that finding's commit or closes the ticket. Then the escalation count by question class, and — when the standards axis was idle — one line saying so: *"No documented standards; the standards axis checked nothing this wave. It activates when rules are written."* Never dump the question blocks here.

**One question per turn.** Order: spec questions before standards questions; within each, the ones later work most likely builds on first. Per escalation, print its block — **domain language throughout; name behaviors, cases, and consequences, not functions and line numbers** (anchors and code excerpts arrive on request, via `explain`):

```
### W2-SPEC-9 — spec question — 2 of 3
- **The question:** <one line, in the domain's terms>
- **What the spec says:** <quoted line + decision ID, or "the spec is silent here">
- **What the code does today:** <one line, behavior not implementation>
- **Why it needs you:** spec unclear | competing fixes | genuine trade-off | no working fix | pervasive pattern
- **Options:** <each option as a behavior choice, with its consequence and what it triggers — fix now, ticket, spec comment>
```

— then ask with `AskUserQuestion`, options phrased as the *behavior* choices, each description naming what the answer triggers. Class-specific shapes:

- **Spec unclear** (`spec-suspect`) — the options are the plausible readings, plus "the code is right as written". The block carries a **draft spec comment** for the chosen reading — posted to the spec issue only on the user's verdict, so the spec accretes the answer and no later wave re-asks it.
- **Competing fixes** — one question for the pair: which behavior wins. The verdict settles both IDs; the losing fix is recorded rejected.
- **Genuine trade-off** — the trade-off's horns as options, consequences stated.
- **No working fix** — options: ticket it for a fresh attempt with the failure attached, or leave it (recorded, with the reason).
- **Pervasive pattern** — options: **adopt as rule** (a standalone ticket — not a spec child — labeled `review-finding` + `needs-triage`, carrying the pattern, the grep evidence, and a task to append the rule to the governing `CONVENTIONS.md`; a parking lot nothing works until the user picks it up), **fix everywhere** (spec-child ticket covering all instances), or **leave as-is**.

`explain` arrives as free text: answer — with file/line anchors and code excerpts now that they're asked for — then re-ask the same ID. If the user batches several answers or says stop, honour it immediately (unanswered IDs → recorded `unanswered`, re-raised at the closing pass).

**Act on the collected answers** — none of them mid-loop: post the chosen spec comments; run one serial fix agent (Sonnet, same discipline as auto-apply: re-ground each proposal against current `HEAD` by quoted snippet, one commit per ID, full suite at the end, breakers reverted and re-escalated) for fixes the answers unlocked; file the tickets the answers called for; `git revert` anything the audit overrode. Post the wave summary recording every outcome — completeness there is what makes the run converge.

## Authoring notes for the wave workflow

- **Model policy: executors run Sonnet, deciders inherit.** Agents that **execute a fully specified brief** pass `model: 'sonnet'`: the claim agent (pure tracker mechanics), the implementers (the wall-clock bottleneck — routinely 30+ min per wave on a bigger model — working from fully specified tickets), the merge/conflict agents (serialized, so speed compounds; netted by never-merge-on-red and the wave verification reading the merged diff), the auto-ticket agent, and both fix agents — auto-apply and post-answer (sketches already validated; netted by the test suite, per-finding revertible commits, and the audit-revert loop). Agents that **decide** omit `model` and inherit the creating session's model: the partition stage, both reviewers, **labeling** (its dedup calls enforce the adjudication memory, and a wrong suppression there is the one silent failure no downstream net catches), both validator passes, and the proposers. **Routing is plain script logic over schema fields — never an agent.** Every Sonnet stage sits under at least one net; no inherited stage is on the wall-clock critical path.
- **Inline, don't thread.** Bake ticket bodies, decisions, diff commands, and dedup inputs into the script's template strings at authoring time; `args` buys nothing except a failure mode — it has been observed arriving as a JSON *string*, so `${args.x}` interpolates the literal `undefined` and nothing fails loudly. If something must go through `args`, normalize and fail loud on line one (`typeof args === 'string' ? JSON.parse(args) : (args || {})`, throw on missing keys, `log()` the keys).
- **Escape backticks in pasted prose.** Ticket bodies, the kernel, decisions, and stage briefs all sit inside template literals; one markdown code span terminates the literal and kills the launch with a parse error. Escape every backtick (`` \` ``) or build long briefs from single-quoted concatenation.
- Give every stage a `schema` so verdicts come back as typed enum fields, never prose the manager interprets — the routing step depends on it. Run per-finding stages as a `pipeline`; the deliberate barriers are the per-axis proposers, the routing step, the serial fix agent, and the ledger post.
- The pending-questions comment is posted **by the workflow** (its final stage), not the manager — the queue must be durable even if the session dies the moment the workflow returns.

## What this deletes relative to /ship and /two-axis-review

From `/ship`: the lightweight wave review and its "confident fixes" agent (the verification pipeline replaces both); the end-of-run handoff to `/two-axis-review` in a fresh session (the closing pass absorbs it); and the cross-skill ship ↔ review ↔ `/next` lap (review tickets rejoin the frontier in-run).

From `/two-axis-review`'s pipeline as originally forked: the **Fowler smell baseline** on the per-wave standards axis (written rules only; the closing sweeper keeps its four composition smells, aimed at parallel-implementation drift); the **hard vs judgement flag** (with the baseline gone, every standards finding cites a written rule and every spec finding is classified `code-diverges`/`spec-suspect` — the routing needs nothing else); and the **disposition triage** — `fix`/`ticket`/`later`/`skip` verdicts on every surviving finding presumed a user who could hold the code in their head. Routing owns disposition now; the user owns intent.

`/ship` and `/two-axis-review` themselves are unchanged — `/ship` remains the no-human-until-the-end tool, and `/two-axis-review` remains the deliberate, full-depth review with the human as disposition authority.
