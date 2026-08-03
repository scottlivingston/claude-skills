---
name: ship-hitl
description: Experimental variant of /ship — implement a spec's ticket DAG wave by wave, running the full two-axis review pipeline on each wave's merged diff, with a human gate between waves: spec-axis findings block the next wave until triaged. Re-entrant across sessions — all run state lives on the spec issue, so any session can resume at a wave boundary or a pending triage. Runs after /to-tickets. Invoke only when the user explicitly asks for it — never spontaneously; /next does not route here while the experiment lasts.
---

Ship-hitl turns an approved ticket DAG into committed, reviewed code — like `/ship`, but the review moves inside the run. Each wave's merged diff goes through the full find → validate → propose → validate → auto-apply pipeline, and **spec-axis findings that need a human verdict close a gate**: the next wave does not launch until the user has triaged them. Problems in wave 1 get fixed before wave 2 builds on them, each triage is wave-sized instead of branch-sized, and the closing review shrinks to the few checks only the whole branch can answer.

This skill is an **experiment**: a self-contained fork of `/ship` plus `/two-axis-review`'s pipeline. Those skills stay unchanged and authoritative for their own flows; this doc owns its own copy of the pipeline and may diverge from theirs. If the experiment graduates, the pipeline gets extracted into a shared skill both cite.

The user invokes with a **spec** (issue URL/number) whose implementation tickets already exist as its sub-issues. For the issue tracker, invoke `/issue-tracker`; for standards sources, `/conventions`.

## Guardrails

- **Wrong entry point?** Redirect, don't improvise: a spec with no tickets → run `/to-tickets <spec>` (HITL) first. A wayfinder map → `/to-spec <map>` first.
- **Branch discipline**: if on the default branch, create `spec-<number>-<slug>` and work there. The whole run lands on one branch; one PR closes the spec at the end.
- Never merge to shared branches, push, or open PRs unless the user asked explicitly.
- **The manager orchestrates and triages — nothing else.** Implementation, merging, review, fixes, and tracker updates all happen inside workflow agents. The manager's own work is authoring workflows, reading their returns, running the triage loop, and posting ledger comments.
- **Waves are derived, never stored.** The durable truth is the ticket DAG plus the spec issue's ledger comments. The frontier — open tickets with no open blocker and no claim — is recomputed from the tracker at every wave boundary, so parked tickets drop out and mid-run review tickets join in automatically.

## The ledger

All run state a future session needs lives as comments on the **spec issue**, each opening with a machine-findable marker (these are process comments — never the tracker doc's spec-decision marker):

- `<!-- ship-hitl wave-<n> pending-triage -->` — posted by the wave workflow's **final stage** when the gate closes: the full finding blocks (ID, location, flags, proposal, validation verdict, auto-apply SHAs) for every finding awaiting a verdict. Durable *before* any triage happens, so triage can run in a different session than the one that launched the workflow.
- `<!-- ship-hitl wave-<n> summary -->` — the round summary, posted by the manager after the wave is settled: **every** finding ID with its terminal outcome — applied (SHA), fixed, ticketed (#N), `later` (#N), skipped, kept, reverted, **refuted by a validator** (one-line reason), or **`deferred-to-close`**. Deferred entries carry their full finding block, not a one-liner — the closing pass triages them cold from this comment alone. Also: tickets landed, tickets parked, next-wave notes.
- `<!-- ship-hitl closing-<k> pending-triage -->` / `<!-- ship-hitl closing-<k> summary -->` — the closing pass's equivalents.

Finding IDs are wave-scoped and never reused: `W<n>-STD-<i>` / `W<n>-SPEC-<i>` for wave *n*, `C<k>-STD-<i>` / `C<k>-SPEC-<i>` for closing pass *k*. The summaries are the run's **adjudication memory**: every later wave's dedup stage reads them, so no finding is ever re-litigated — that is what makes the run converge.

## Process

### 1. Bootstrap — any session, idempotent

Every invocation starts the same way, whether it's the first session or a resume:

1. Read the spec in full — kernel plus addressable decisions per the tracker doc — including Testing Decisions, the **Seams under test** list, and the Decision Index.
2. List the spec's sub-issue tickets with states, blocking edges, claims, and the decision IDs each cites.
3. Read the spec issue's comments and collect the ledger: prior wave/closing summaries (adjudication memory), any pending-triage comment, open `review-finding` tickets.
4. Find or create the ship branch (`spec-<number>-<slug>`); check it out. Record the run's base: `git merge-base <default-branch> HEAD`.
5. Pick the resume point:
   - A **pending-triage comment with no matching summary** → resume at **triage** (step 4 below) from that comment. Do not re-run the wave's pipeline.
   - Otherwise compute the frontier. **Non-empty** → next wave (step 2), numbered one past the highest ledger wave. **Empty** → closing pass (step 5) — unless the latest closing summary is clean, in which case the run is done (step 6).
6. Report the resume point and the wave structure (what's frontier now, what unblocks when) before launching anything.

### 2. The wave workflow

Each wave runs as **one dynamic `Workflow`** (this skill is your authorization to use it), authored fresh by the manager with the wave's tickets, decisions, and dedup inputs baked in. Its stages:

1. **Claim** — a `model: 'sonnet'` agent claims every frontier ticket (tracker doc's claim operation; bootstrap the markers first if needed) and verifies the claim check passes before any implementer spawns.
2. **Parallel implement** — one fresh agent per ticket, each in an **isolated worktree**, spawned with `model: 'sonnet'` (see the model policy in the authoring notes). Each gets the spec **kernel** (Testing Decisions and Seams under test verbatim, Decision Index included), the **full text of the decisions its ticket cites** — never the whole decision log — its ticket body, and the `/implement` + `/tdd` discipline: red–green at the spec's seams, typecheck regularly, run single test files regularly, commit in its worktree. First action: confirm the ticket carries `in-progress`. Never two tickets in one agent. An agent needing an uncited decision checks the Decision Index, fetches it by ID, and notes the missed routing in a ticket comment. A decision the spec doesn't hold anywhere, or work no listed seam covers, **parks** the ticket: unclaim, comment what's missing on the ticket, comment the gap on the spec issue.
3. **Serial merge** — finished worktree branches merge into the ship branch **one at a time** (merge and conflict agents run `model: 'sonnet'` — the merges are serialized, so model speed compounds with wave width), affected tests after each merge (full suite if cheap). On conflict, a merge agent resolves preserving both tickets' intent, then re-tests. **Never merge on red** — a branch that can't come green is parked like any other. On green, close the ticket with a comment linking its commits and remove `in-progress`.
4. **Review pipeline** over the wave's combined merged diff — the stages in *The wave pipeline* below.
5. **Ledger post** — the workflow's final stage posts the pending-triage comment when survivors exist (see the gate), then returns the full labeled queue: every finding with its flags, verdicts, proposal, size, and applied SHA or status. That return value is all the manager sees of the pipeline.

A parked ticket doesn't stop the run unless it blocks everything — later frontiers exclude tickets whose blockers didn't land, and the run continues around them.

### 3. The gate

When the workflow returns, split the queue. **Needs-a-verdict** means: not auto-applied, not refuted, not already-adjudicated or already-ticketed.

- **Any spec-axis finding needs a verdict** (including any cross-axis pair — the pair's spec member closes the gate for both) → **the gate is closed.** Send a push notification (load via `ToolSearch("select:PushNotification")`; skip silently if unavailable), then go to triage (step 4).
- **No spec-axis finding needs a verdict** → **the gate is open.** Standards findings still needing verdicts are **not** triaged now: record each as `deferred-to-close` (full block) in the wave summary. Post the wave summary and launch the next wave immediately — no pause, no question. This is what keeps a clean run AFK.

Either way the wave summary comment gets posted before anything else happens — refutations and auto-applies included, so the next wave's dedup remembers them.

### 4. Triage at a closed gate

Triage runs in the manager session — this one, or any later session that bootstraps onto the pending-triage comment. Walk the **whole wave's** needs-a-verdict queue, both axes (the user is warm; cold standards triage at the end is the expensive version), per *Triage mechanics* below: orientation summary first, then one finding per turn, then act on the collected verdicts (fix agent, tickets, reverts), then post the wave summary recording every adjudication.

Then **checkpoint**: state is fully durable, so end the turn with the choice stated plainly — continue with the next wave here, or run `/ship-hitl <spec>` in a fresh session; both resume identically from the tracker. Don't launch the next wave unprompted after a triage: the checkpoint is the session-boundary the gate exists to offer.

`ticket` verdicts became spec children just now — the next frontier computation picks them up, so review rework rides the very next wave.

### 5. The closing pass

When the frontier is empty, run one last workflow over the **whole branch diff** (`git diff <run-base>...HEAD`). Per-wave review is a partition in time, and it breaks the same two whole-diff properties spatial partitioning does; the closing pass restores them and drains the deferred queue:

- **Cross-wave sweeper** — one agent reads the whole diff at low resolution (file list and hunk headers, reading closer only where suspicious), hunting only the four cross-file smells no single wave could see: Duplicated Code, Repeated Switches, Shotgun Surgery, Divergent Change.
- **Requirements-union check** — one agent reads the spec kernel with its full Decision Index against the whole diff's file list and checks every requirement is implemented *somewhere*, fetching decisions by ID as needed. Absent from the changed files ≠ unimplemented — it may pre-exist; each suspect goes to a small checker agent before becoming a finding.
- New findings (`C<k>-…` IDs) run through the same validate → propose → validate → auto-apply stages as a wave's, with the same dedup against the full adjudication memory.
- The **deferred standards queue** — every `deferred-to-close` block from the ledger — joins the triage queue as-is (already validated, already proposed; don't re-run their stages).

Everything needing a verdict at the closing pass gets triaged — there is no spec-only gate here; this is the run's last look. Notify, triage, act, post the closing summary.

- Closing `ticket` verdicts create spec children → the frontier is non-empty again → **loop back to step 2**. The run keeps going until a closing pass comes back clean.
- **Convergence guard**: a wave or closing round that fails to shrink — as many new findings as the last, or a flat crop of judgement calls — is a signal, not a lap to repeat: the spec is under-defined or a standard is undocumented. Say so plainly; the next move is sharpening those documents.

### 6. Done

A closing pass with no `fix` or `ticket` verdicts ends the run. Push notification, then the report: per ticket — commits, fixes applied; per wave — findings and outcomes; parked tickets and exactly what each needs. Then run the full test suite once more and offer the PR whose body `Closes #<spec>`. **Suppress the offer while the spec has open children** — including parked tickets; offer a plain PR (no `Closes`) instead. Only open either if the user says yes.

## The wave pipeline

The review stages inside each wave workflow (and, with `C<k>` IDs, the closing pass). This is ship-hitl's own copy — tuned for wave scale, maintained here.

**Inputs the manager bakes into the script** (the workflow has no conversation context): the wave diff command — `git diff <pre-wave-SHA>...HEAD` where `<pre-wave-SHA>` is the ship branch before this wave's first merge — and the wave's commit list with full messages; the spec **kernel** plus the full text of the union of decisions the wave's tickets cite (Decision Index included, so reviewers can fetch unrouted decisions by ID); the standards sources per `/conventions` with the directory scope each binds, plus the smell baseline below pasted in full; the dedup inputs — open `review-finding` tickets and all prior ledger summaries, fetched pre-launch.

### Reviewers — one per axis

**Standards reviewer**: gets the diff command, commit list, standards sources with their scopes (nearest scope wins; scoped files read as deltas over root), and the smell baseline. Brief: "Report — per file/hunk where relevant — (a) every place the diff violates a documented standard: cite the standard (file + rule); (b) any baseline smell: name it and quote the hunk. Distinguish hard violations from judgement calls — documented-standard breaches can be hard, baseline smells never are, and a documented repo standard overrides the baseline. (c) A finding that looks like a pattern with a statable grep signature: grep outside the diff and flag `repo-wide` only with the grep and both counts attached. Skip anything tooling enforces. Under 400 words."

**Spec reviewer**: gets the diff command, commit list, and the kernel-plus-cited-decisions. Brief: "Report: (a) requirements asked for that are missing or partial; (b) behaviour not asked for (scope creep); (c) requirements implemented wrong. Treat decision snippets — state machines, schemas, contracts — as requirements; divergence from one is a finding. Quote the spec line, with its decision ID where it has one, per finding. Under 400 words." Reviewing the integrated wave rather than each ticket alone is deliberate: it sees how parallel tickets compose.

A wave too wide for one reader per axis (soft heuristic: >~15 files or ~1,500 changed lines) partitions exactly as `/two-axis-review` does: one cheap partition stage clusters files into subsystem groups aligned with scoped-standards boundaries and routes cited decisions to groups; both axes share the partition; one in-wave cross-cutting sweeper and a requirements-union over the chunks restore what partitioning breaks. Most waves won't need this.

### Labeling and dedup

A labeling stage normalizes the reports into discrete findings — ID (`W<n>-STD-<i>` / `W<n>-SPEC-<i>`), `file:line`, one-line description, hard vs judgement flag, `repo-wide` flag, cited source. Never merge or rerank across axes. Mark **cross-axis pairs** — a Standards and a Spec finding on the same file and overlapping lines are one defect wearing two labels; the pair stays two findings, but it's barred from auto-apply and triaged as a unit.

Dedup, conservatively, against: **open `review-finding` tickets** — a finding predating this diff that matches → **already ticketed: #N**, out of the queue; a finding this diff introduces matching a ticketed pattern → **instance of open #N**, stays in; uncertain → **possibly duplicates #N**, stays in. And against **every prior ledger summary**: a finding already adjudicated in any earlier wave — fixed, ticketed, `later`, skipped, deferred, or refuted — → **already adjudicated (<verdict>)**, out of the queue, one line in the wave summary.

### Validate each finding — adversarially, before any fix exists

Fresh validator agents that did not author the findings, prompted to **refute the finding itself**, one per finding in parallel (past 8, batch per axis). Each gets the finding, diff command, commit list with full messages, and both axes' inputs, and answers: is the finding real? Read the cited source and the actual hunk; does the claimed harm survive what tooling already guarantees?

Two calls belong here: **Spec classification** — `code-diverges` (spec unambiguous, code doesn't match, fix mechanical) vs `spec-suspect` (the *spec* may be wrong; check commit messages and tests for deliberate deviation; **any doubt → `spec-suspect`**). And a validator may raise `repo-wide` the reviewer missed, with the same grep-and-counts evidence.

Verdict: **`finding-refuted`** (with reason — leaves the pipeline, recorded in the wave summary so dedup remembers) or **`finding-validated`** (proceeds).

### Propose a fix per survivor

One proposer per axis, in parallel, given its axis's survivors with the validators' reasoning. Brief: "For each finding, the smallest concrete fix: what to change, where — anchored by file plus a short quoted snippet, not a bare line number — and a sketch, not a patch. Size each: `quick-fix` or `needs-a-session`. Under 100 words each." For baseline smells, the smell's "→ how to fix" is the starting point, grounded in the actual hunk.

### Validate each proposal — adversarially, independently

Fresh validators — not the proposers, not the finding validators — prompted to **refute the fix**, one per proposal in parallel (past 8, batch per axis). Checks: does it resolve the finding; is it proportionate; **cross-axis** — a Spec fix must not introduce a Standards violation and vice versa; **re-settle `repo-wide`** with counts as schema fields (`instancesInDiff`, `instancesOutsideDiff`; the flag holds only when `instancesOutsideDiff > 0`) — this stage has the last word on the flag.

Verdict: **`validated`**, **`fix-rejected`** (reason), or **`needs-human`** (a genuine trade-off). The finding's reality is settled — doubt goes in the `fix-rejected` reason, and the finding still reaches triage. The schema carries two edge fields, never prose: `dependsOn: [IDs]` and `invalidatedBy: [IDs]` — auto-apply and triage act on them.

### Auto-apply the mechanical tier

A finding auto-applies when **all** hold: hard (documented-standard breach or Spec `code-diverges`; baseline smells never), `validated`, `quick-fix`, not `repo-wide`, not `spec-suspect`, not in a cross-axis pair, and free of `dependsOn`/`invalidatedBy` edges — exactly the findings whose correct fix waits on no verdict.

One `model: 'sonnet'` fix agent in the main checkout — never parallel worktrees — which **re-derives both preconditions itself, as its first act**: `git status --porcelain` (dirty tree → whole tier demotes; never commit around a user's uncommitted work) and `git rev-parse --abbrev-ref HEAD` (default branch without an explicit user OK → demote). Report *which*: "demoted: dirty tree" and "demoted: couldn't verify preconditions" are different lines, and only the second is a bug to chase. It applies the batch serially, **one commit per finding ID** (`review: W2-STD-3 — <one-liner>`), runs the full test suite once at the end, reverts any finding-commit that breaks it, and demotes that finding to needs-a-verdict with the failure attached.

### Smell baseline

The Standards axis always carries this fixed set (Fowler, _Refactoring_ ch.3), even when a repo documents nothing. The repo overrides — a documented standard wins, and where it endorses something the baseline flags, suppress the smell. Every smell is a labelled judgement call, never a hard violation; skip anything tooling enforces.

- **Mysterious Name** — a name that doesn't reveal what it does or holds. → rename; if no honest name comes, the design's murky.
- **Duplicated Code** — the same logic shape in more than one hunk or file. → extract the shared shape, call it from both.
- **Feature Envy** — a method reaching into another object's data more than its own. → move it onto the data it envies.
- **Data Clumps** — the same few fields/params travelling together. → bundle into one type, pass that.
- **Primitive Obsession** — a primitive standing in for a domain concept. → give the concept its own small type.
- **Repeated Switches** — the same `switch`/`if`-cascade on the same type recurring. → polymorphism, or one shared map.
- **Shotgun Surgery** — one logical change forcing scattered edits across many files. → gather what changes together.
- **Divergent Change** — one module edited for several unrelated reasons. → split so each changes for one reason.
- **Speculative Generality** — abstraction for needs the spec doesn't have. → delete it; inline until a real need shows.
- **Message Chains** — long `a.b().c().d()` navigation. → hide the walk behind one method.
- **Middle Man** — a class that mostly delegates onward. → cut it, call the real target.
- **Refused Bequest** — an implementer ignoring most of what it inherits. → composition over inheritance.

## Triage mechanics

**Open with the summary only** — counts per axis, how many refuted, how many auto-applied (IDs + SHAs), how many need a verdict, the worst issue *within each axis* by ID (never a single winner across axes), and one line naming the verdicts: **fix**, **ticket**, **later**, **skip**, plus **explain** and **revert**. When `/conventions` found nothing documented, say so up front: every Standards finding is a judgement call and this axis won't shrink until rules get written down. Never dump the finding blocks here.

**One finding per turn.** Order: auto-applied first (a revert should land before fixes stack on it), then Standards, then Spec; hard before judgement within each axis. Per finding, print its block —

```
### W2-STD-1 — src/foo.ts:42 (judgement call, repo-wide) — 4 of 11
- **Finding:** <one line>
- **Why it matters:** <consequence, citing the rule or spec line>
- **Proposed fix:** <proposal + sketch>
- **Validation:** validated | fix-rejected — <reason> | needs-human — <trade-off>
- **Size:** quick-fix | needs-a-session
- **Status:** applied in <sha> | needs your call | instance of open #N | possibly duplicates #N
```

— then ask for its verdict with `AskUserQuestion`, leading with the option validation supports, marked `(Recommended)`: `fix` for a validated quick-fix, `ticket` for a validated needs-a-session or a fix-rejected, `later` for anything repo-wide; auto-applied findings get `keep` / `revert` / `ticket`. Spec findings put their classification in the header; a `spec-suspect` block carries a **Draft spec comment** — posted to the spec issue only on the user's verdict. A cross-axis pair never gets a blind turn: render both blocks, ask one question that picks between the competing fixes; the verdict settles both IDs. `explain` arrives as free text: answer, then re-ask the same ID. If the user batches several verdicts or says stop, honour it immediately (untouched IDs → `skip`).

**Act on the collected verdicts** — none of them mid-loop:

- **fix** — one serial fix subagent (Sonnet, like the auto-apply tier), step-9 discipline: re-ground each proposal against current `HEAD` by quoted snippet, one commit per ID, full suite at the end, breakers reverted and demoted. Walk the edges first: a `fix` whose `dependsOn` was skipped doesn't queue — surface it; a proposal `invalidatedBy` an accepted sibling goes in with the stale premise called out.
- **revert** — by the manager: `git revert` that finding's commit; conflicts → hand-apply the inverse.
- **ticket** — cluster by file while the combined work fits one session; each ticket a **child of the spec** with labels `impl` + `ready-for-agent` + `review-finding`, body carrying findings, why they matter, proposals, and verdicts anchored by file + quoted snippet. These join the next frontier automatically.
- **later** — truly out of scope for this spec: a **standalone** ticket (not a spec child), `review-finding` + `needs-triage`, with the pattern statement, the evidence, and a task item to append the rule to the governing `CONVENTIONS.md`. A parking lot: nothing works it until the user picks it up as a fresh effort.
- **skip** / **keep** — record and move on.

Every queued finding reaches a terminal outcome, and the wave summary records all of them — completeness there is what makes the run converge.

## Authoring notes for the wave workflow

- **Model policy: executors run Sonnet, deciders inherit.** Agents that **execute a fully specified brief** pass `model: 'sonnet'`: the claim agent (pure tracker mechanics), the implementers (the wall-clock bottleneck — routinely 30+ min per wave on a bigger model — working from fully specified tickets), the merge/conflict agents (serialized, so speed compounds; netted by never-merge-on-red and the wave review reading the merged diff), and both fix agents — auto-apply and round-2 (sketches already validated; netted by the test suite, per-finding revertible commits, and the keep/revert triage turn). Agents that **decide** omit `model` and inherit the creating session's model: the partition stage, both reviewers, **labeling** (its dedup calls enforce the adjudication memory, and a wrong suppression there is the one silent failure no downstream net catches), both validator passes, and the proposers. Every Sonnet stage sits under at least one net; no inherited stage is on the wall-clock critical path.
- **Inline, don't thread.** Bake ticket bodies, decisions, diff commands, and dedup inputs into the script's template strings at authoring time; `args` buys nothing except a failure mode — it has been observed arriving as a JSON *string*, so `${args.x}` interpolates the literal `undefined` and nothing fails loudly. If something must go through `args`, normalize and fail loud on line one (`typeof args === 'string' ? JSON.parse(args) : (args || {})`, throw on missing keys, `log()` the keys).
- **Escape backticks in pasted prose.** Ticket bodies, the kernel, decisions, and stage briefs all sit inside template literals; one markdown code span terminates the literal and kills the launch with a parse error. Escape every backtick (`` \` ``) or build long briefs from single-quoted concatenation.
- Give every stage a `schema` so verdicts come back as typed enum fields, never prose the manager interprets. Run per-finding stages as a `pipeline`; the deliberate barriers are the per-axis proposers, the serial fix agent, and the ledger post.
- The pending-triage comment is posted **by the workflow** (its final stage), not the manager — the queue must be durable even if the session dies the moment the workflow returns.

## What this deletes relative to /ship

The lightweight wave review and its "confident fixes" agent (the full pipeline replaces both); the end-of-run handoff to `/two-axis-review` in a fresh session (the closing pass absorbs it); and the cross-skill ship ↔ review ↔ `/next` lap (review tickets rejoin the frontier in-run). `/ship` itself is unchanged and remains the no-human-until-the-end tool.
