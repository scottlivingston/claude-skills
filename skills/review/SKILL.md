---
name: review
description: Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes — Standards (does the code follow this repo's documented coding standards?) and Spec (does the code match what the originating issue/PRD asked for?). Runs the find→validate→propose→validate→auto-apply pipeline as one dynamic workflow — both axis reviews in parallel (partitioned into shared subsystem groups when the diff is wide), every finding labeled and adversarially validated (refuted findings dropped), a fix proposed per survivor and adversarially validated, mechanical validated fixes auto-applied by a serial fix agent — then walks the rest past the user one finding at a time for a verdict — queue more fixes, publish tracker tickets, or park repo-wide patterns as standalone cleanup tickets. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to "review since X".
---

Two-axis review of the diff between `HEAD` and a fixed point the user supplies:

- **Standards** — does the code conform to this repo's documented coding standards?
- **Spec** — does the code faithfully implement the originating issue / PRD / spec?

The whole find-and-validate pipeline — both axis reviews in parallel (partitioned into shared subsystem groups when the diff is too wide for one reader), per-run finding IDs, adversarial finding validation (a refuted finding is dropped there, before any fix is drafted), fix proposals for the survivors, adversarial fix validation, and the auto-applied mechanical tier — runs as **one dynamic `Workflow`**: stage order is enforced by script rather than discipline, and the manager's context stays clean for triage. The manager then walks the remaining findings past the user **one at a time**, collecting a verdict each — queuing further fixes to the fix subagent, publishing session-sized findings as tickets the rest of the workflow (`/ship`, `/next`) can pick up, and parking repo-wide patterns as standalone cleanup tickets. Nothing is ever edited in the review session itself.

For the issue tracker, invoke `/issue-tracker`.

## Process

### 1. Pin the fixed point

Whatever the user said is the fixed point — a commit SHA, branch name, tag, `main`, `HEAD~5`, etc. If they didn't specify one, ask for it.

Capture the diff command once: `git diff <fixed-point>...HEAD` (three-dot, so the comparison is against the merge-base). Also note the list of commits via `git log <fixed-point>..HEAD --oneline`.

Before going further, confirm the fixed point resolves (`git rev-parse <fixed-point>`) and the diff is non-empty. A bad ref or empty diff should fail here — not inside the workflow.

Record three more facts for later:

- How big is the diff (`git diff <fixed-point>...HEAD --stat`)? The size decides whether step 4 partitions the reviews.
- Is the working tree clean (`git status --porcelain`)? A dirty tree disables the auto-apply tier (step 9).
- Is `HEAD` the repo's default branch? If so, get the user's OK (or a branch) before any auto-commit lands (step 9).

### 2. Identify the spec source

Look for the originating spec, in this order:

1. Issue references in the commit messages (`#123`, `Closes #45`, etc.) — fetch via the tracker doc above.
2. A path the user passed as an argument.
3. A PRD/spec file under `docs/`, `specs/`, or `.scratch/` matching the branch name or feature.
4. If nothing is found, ask the user where the spec is. If they say there isn't one, the **Spec** reviewer stage will skip and report "no spec available".

When the spec is a tracker issue, "the spec contents" means the kernel body plus its **addressable decisions**, reassembled in index order per the tracker doc's spec-decision convention — the decision marker is also what separates spec content from this skill's own round-summary comments on the same issue. A spec with no Decision Index is just its body (the pre-index format).

### 3. Identify the standards sources

The canonical source is `CONVENTIONS.md`, per `/conventions`: the root file plus, in a monorepo, any `CONVENTIONS.md` on the ancestor path of a file the diff touches — nearest scope wins on conflict, scoped files read as deltas over root. Collect the governing set for the files this diff touches, and record which directories each scoped file binds — the Standards reviewer needs that mapping to judge each file by its own scope's rules.

Repos not using the convention still get reviewed: fall back to anything that documents how code should be written (`CODING_STANDARDS.md`, `CONTRIBUTING.md`, `STYLEGUIDE.md`, equivalents under `docs/`). Record whether this search found anything documented at all — step 10's orientation message says so when it didn't.

On top of whatever the repo documents, the Standards axis always carries the **smell baseline** below — a fixed set of Fowler code smells (_Refactoring_, ch.3) that applies even when a repo documents nothing. Two rules bind it:

- **The repo overrides.** A documented repo standard always wins; where it endorses something the baseline would flag, suppress the smell.
- **Always a judgement call.** Each smell is a labelled heuristic ("possible Feature Envy"), never a hard violation — and, like any standard here, skip anything tooling already enforces.

Each smell reads *what it is* → *how to fix*; match it against the diff:

- **Mysterious Name** — a function, variable, or type whose name doesn't reveal what it does or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code** — the same logic shape appears in more than one hunk or file in the change. → extract the shared shape, call it from both.
- **Feature Envy** — a method that reaches into another object's data more than its own. → move the method onto the data it envies.
- **Data Clumps** — the same few fields or params keep travelling together (a type wanting to be born). → bundle them into one type, pass that.
- **Primitive Obsession** — a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type.
- **Repeated Switches** — the same `switch`/`if`-cascade on the same type recurs across the change. → replace with polymorphism, or one map both sites share.
- **Shotgun Surgery** — one logical change forces scattered edits across many files in the diff. → gather what changes together into one module.
- **Divergent Change** — one file or module is edited for several unrelated reasons. → split so each module changes for one reason.
- **Speculative Generality** — abstraction, parameters, or hooks added for needs the spec doesn't have. → delete it; inline back until a real need shows.
- **Message Chains** — long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method on the first object.
- **Middle Man** — a class or function that mostly just delegates onward. → cut it, call the real target direct.
- **Refused Bequest** — a subclass or implementer that ignores or overrides most of what it inherits. → drop the inheritance, use composition.

### 4. Author and launch the pipeline workflow

Steps 4–9 — review, label, validate findings, propose, validate fixes, auto-apply — run as **one dynamic `Workflow`** (this skill is your authorization to use it). The manager authors the script, launches it, relays progress, and does no review work itself; the stage briefs in steps 4–9 are the prompts for the script's agents. Script order is what makes the pipeline honest: a proposer cannot see a finding whose validator refuted it, because the script never hands it one.

Hand the stages everything they need — the workflow has no conversation context:

- the diff command and the commit list with full messages,
- the spec contents (or "no spec"),
- the standards sources with the directory scope each binds, plus the smell baseline pasted in full,
- the dedup inputs for step 5 — fetch the open `review-finding` tickets and the spec issue's prior-round summary comments **before** launching,
- the user's default-branch OK from step 1, when given (the fix agent re-derives the tree and branch state itself — step 9).

**Inline, don't thread.** The manager knows all of this at authoring time, so bake it into the script's template strings directly; `args` buys nothing here except a failure mode — it has been observed arriving as a JSON *string*, turning every `${args.x}` into the literal `undefined`, and a prompt interpolating `undefined` doesn't fail: the agent silently rediscovers its input with Bash, or proceeds without it. If anything must go through `args` anyway, open the script by normalizing and failing loud:

```js
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const missing = ['diffCmd', 'spec', 'standards'].filter(k => !(k in A))
if (missing.length) throw new Error('args missing: ' + missing.join(', '))
log('args keys: ' + Object.keys(A).join(', '))
```

**Escape backticks in prompt prose.** Stage briefs live inside template literals, and a markdown code span quoting a symbol or shell command — the natural way to write a brief — terminates the literal and kills the launch with a parse error. Escape every backtick in prose (`` \` ``), or build long briefs from single-quoted concatenation.

Give every stage a `schema` so verdicts come back as typed fields — `finding-refuted` vs `fix-rejected` is an enum value, never prose the manager interprets. Run the per-finding stages as a `pipeline` — a Standards finding needn't wait for the Spec reviewer — with two deliberate barriers: the per-axis proposer (step 7 batches an axis's survivors into one agent) and the final serial fix agent (step 9). The workflow returns the full labeled queue — every finding with its flags, verdicts, proposal, size, and applied SHA or status — and that return value is all the manager sees of the pipeline.

**Partition wide diffs.** One reviewer per axis is the default and, when the diff fits, the better one — a single reader sees every cross-file pattern. Past what one reviewer can hold alongside its standards and spec (soft heuristic: more than ~15 files or ~1,500 changed lines, judged from step 1's `--stat`), the script inserts a **partition stage**: one cheap agent reads the file list and stats — not the full diff — plus the spec and the standards-scope map, and clusters the changed files into logical groups, by subsystem or directory, which also aligns with scoped `CONVENTIONS.md` boundaries. Each group becomes a path-scoped diff command (`git diff <fixed-point>...HEAD -- <paths>`), and **both axes share the one partition** — then one reviewer per group per axis:

- A **Standards chunk reviewer** gets its group's diff command and only the standards governing those paths (plus the smell baseline).
- A **Spec chunk reviewer** gets its group's diff command, the spec **kernel** with its full Decision Index, and the **full text of the decisions routed to its group** — the partition stage assigns decision IDs to groups the same way it clusters files (it already reads the spec). The index one-liners stand in for every other decision, so scope creep stays checkable against the whole decision surface; a reviewer that suspects a hunk answers an unrouted decision fetches that decision by ID (the tracker doc's read). Its report also lists **which spec requirements its slice touches**. (A pre-index spec is passed whole instead — it has no units to route.)

Partitioning silently breaks two whole-diff properties; the script restores each:

- **Cross-file smells.** Duplicated Code, Repeated Switches, Shotgun Surgery, and Divergent Change span groups by nature — no chunk reviewer can see them. One extra **cross-cutting sweeper** reads the whole diff at low resolution (file list and hunk headers, reading closer only where something looks suspicious), hunting only those four.
- **Missing requirements.** "Asked for and never built" is a property of the union, not any slice. The script unions the chunks' requirement-coverage lists; each requirement no slice claims goes to one small checker agent — absent from the changed files ≠ unimplemented; it may pre-exist — before entering the queue as a finding.

**Reviewer stage** — one agent per axis, or per group and axis when partitioned.

**Standards reviewer prompt** — include:

- The diff command (path-scoped, when partitioned) and commit list.
- The list of standards-source files you found in step 3 — with the directory scope each one binds, and the instruction that a scoped `CONVENTIONS.md` governs only files under its directory, nearest scope winning — **plus the smell baseline from step 3** pasted in full; the reviewer has no other access to the baseline.
- The brief: "Report — per file/hunk where relevant — (a) every place the diff violates a documented standard: cite the standard (file + the rule); and (b) any baseline smell you spot: name it and quote the hunk. Distinguish hard violations from judgement calls — documented-standard breaches can be hard, but baseline smells are always judgement calls, and a documented repo standard overrides the baseline. (c) When a finding looks like an instance of a pattern rather than a one-off, and the pattern has a statable grep signature (a banned element or API, a naming rule), grep for it outside the diff and flag the finding `repo-wide` only with the grep and both counts attached — instances inside the diff, instances outside it. A pattern with zero instances outside the diff is this change's own duplication, not a repo pattern. Skip anything tooling enforces. Under 400 words."

**Spec reviewer prompt** — include:

- The diff command (path-scoped, when partitioned) and commit list.
- The path or fetched contents of the spec.
- The brief: "Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Treat the spec's decision snippets (state machines, schemas, type shapes, contracts — inline or in its addressable decisions) as requirements — divergence from one is a finding like any other. Quote the spec line, with its decision ID where it has one, for each finding. Under 400 words."

If the spec is missing, the script skips the Spec reviewer stage; note this in the final report.

### 5. Label the findings

A labeling stage normalizes each report into a list of discrete findings — the aggregator's "light cleaning". When the reviews were partitioned, it also dedups across group boundaries: the cross-cutting sweeper and a chunk reviewer may report the same hunk. The script assigns each finding an ID: `STD-1`, `STD-2`, … for Standards, `SPEC-1`, `SPEC-2`, … for Spec, numbered in report order. (Axis-prefixed IDs keep the axes separate and need no coordination between the reviewers; IDs are per-run — a re-run renumbers.)

Each finding carries: its ID, a `file:line` location, a one-line description, the hard-violation vs judgement-call flag, the `repo-wide` flag where raised, and the cited source (the standard's rule, or the spec line — with its decision ID where it has one). The hard flag is axis-specific: on **Standards**, only a documented-standard breach can be hard — baseline smells never are; on **Spec**, hardness is settled by the finding validator's classification in step 6 (`code-diverges` is hard, `spec-suspect` is a judgement call). Do **not** merge or rerank findings across axes — the two axes are deliberately separate (see _Why two axes_).

**Detect cross-axis pairs.** When a Standards and a Spec finding anchor to the same file and overlapping lines, they are usually one defect wearing two labels — and their proposed fixes can compete. Label each `cross-axis pair: <other ID>`. The pair stays two findings on two axes with two proposals; the pairing changes only how they're handled downstream — barred from auto-apply (step 9), rendered together at triage (step 11).

**Dedup against open review tickets.** Match against the open `review-finding` tickets passed in `args` (the manager listed them pre-launch, per the tracker doc). Match conservatively: a standalone cleanup ticket matches at the rule/pattern level; a spec-child ticket matches only same file + same rule. Then:

- A finding whose subject **predates this diff** (visible in context, not introduced by the change) and matches an open ticket → mark **already ticketed: #N** — no proposal, no validator, not in the verdict queue.
- A finding this diff **introduces** that matches a ticketed pattern → mark **instance of open #N** and keep it in the queue — new instances of a known pattern are new debt, and fixing your own new instances doesn't reduce repo consistency.
- An uncertain match → mark **possibly duplicates #N** and keep it in the queue. A visible duplicate is recoverable; a silent suppression isn't.

**Dedup against prior rounds.** Also match against the spec issue's review **summary comments**, likewise passed in `args` (step 12 posts one per round): every finding adjudicated in an earlier round — fixed, ticketed, parked as `later`, **skipped**, or **refuted by a validator** — is already decided. A finding matching one → mark **already adjudicated (<verdict>)**: no proposal, no validator, not in the verdict queue, one line in the wrap-up. This memory is what makes the ship ↔ review loop converge — no finding is ever re-litigated.

### 6. Validate each finding — adversarially, before any fix exists

Validation by the finding's author is theater — and validating a finding only *through* its fix conflates two questions: a validator that refutes a fix by undercutting the finding's premise produces an incoherent verdict. So findings are validated **on their own, before any fix is proposed**: a stage of **fresh validator agents** that did not author the findings, prompted to **refute the finding itself**, one per finding, all in parallel. If there are more than 8 findings total, batch instead: one validator per axis, still fresh agents, still refutation-framed.

Each validator gets the finding, the diff command, the commit list **with full messages** (`git log <fixed-point>..HEAD`), and both axes' inputs (the standards sources / smell baseline, and the spec), and answers one question: **is the finding real?** Read the cited source and the actual hunk — does the standard rule or spec line say what the reviewer claims, does the code actually breach it, and does the claimed harm survive what the compiler and tooling already guarantee?

Two more calls belong to this pass, because they are properties of the finding, not of any fix:

- **Spec classification** (Spec findings only): label the finding **`code-diverges`** — the spec is unambiguous, the code doesn't match, the fix is mechanical — or **`spec-suspect`** — the divergence exposes an assumption baked into the spec that the code may contradict deliberately; the *spec* may be wrong. Before choosing, read the commit messages and any tests touching the diverging code: evidence of a deliberate deviation → `spec-suspect`. **Any doubt → `spec-suspect`** — a false spec-suspect costs one human glance; a false code-diverges silently rewrites behaviour.
- A validator may raise the **`repo-wide`** flag on a Standards finding the reviewer missed — carrying the same grep-and-counts evidence the reviewer owes (step 4).

Verdict per finding:

- **`finding-refuted`** (with the reason) — the finding doesn't hold. It leaves the pipeline here: no proposal, no triage turn; it appears only as a one-liner in the wrap-up and the round summary so the next round's dedup remembers it.
- **`finding-validated`** — real; it proceeds to proposal.

### 7. Propose a fix per validated finding

**One proposer agent per axis** (in parallel) — findings within an axis share context, and per-axis keeps agent count sane. Give each proposer its axis's **surviving** findings — with the validators' reasoning attached — the diff command, and this brief:

"For each finding, propose the smallest concrete fix that resolves it: what to change, where — anchor by file plus a short quoted snippet of the code being changed, not a bare line number (lines drift once fixes start landing) — and a short sketch of the changed code — a sketch, not a full patch. Also size each fix: `quick-fix` (a few edits — a candidate for the batched fix subagent) or `needs-a-session` (a fresh context window's worth of work). Keep each proposal under 100 words."

For baseline smells, the smell's generic "→ how to fix" is the starting point — the proposer's job is grounding it in the actual hunk.

### 8. Validate each proposal — adversarially, independently

Validation by the proposal's author is theater. This stage's **fresh validator agents** — not the proposers, and not step 6's finding validators — are prompted to **refute the fix**, one per proposal, all in parallel; past 8, batch per axis as in step 6.

Each validator gets the finding (with its step 6 validation reasoning), the proposal, the diff command, the commit list, and both axes' inputs, and checks:

1. **Does the fix actually resolve the finding?**
2. **Is it proportionate?** The minimal change that clears the finding — no speculative rewrites.
3. **Cross-axis check:** a fix for a Spec finding must not introduce a Standards violation, and a Standards fix must not change behaviour the spec asked for.
4. **Re-settle `repo-wide`:** confirm or clear the flag, carrying the counts as schema fields (`instancesInDiff`, `instancesOutsideDiff`). The flag holds only when `instancesOutsideDiff > 0` — a "pattern" whose every instance sits inside the diff is this change's own duplication, fixable here. This stage has the last word: step 9's gate and triage's `later` recommendation read the flag from here, not from the reviewer.

Verdict per proposal: **`validated`**, **`fix-rejected`** (with the reason), or **`needs-human`** (a genuine trade-off the user must call). The finding's reality is not on the table here — step 6 settled it. A fix validator that still doubts the premise records that doubt inside its `fix-rejected` reason; the finding keeps its validated status and surfaces in the triage loop, where the user makes the call.

The proposal schema also carries two edge fields the validator fills instead of burying in prose: `dependsOn: [IDs]` — this fix only works if those findings' fixes land too (say, it reads a const another fix introduces) — and `invalidatedBy: [IDs]` — accepting one of those findings' fixes makes this proposal's premise or wording false. Steps 9 and 12 act on these edges; an edge recorded only as reasoning prose is an edge nobody acts on.

### 9. Auto-apply the mechanical tier

A finding is **auto-apply** when *all* of these hold; everything else waits for the user:

- hard — a documented-standard breach, or Spec `code-diverges` (baseline smells never qualify),
- `validated`,
- `quick-fix`,
- not `repo-wide` (fixing 3 of 40 instances of a pattern makes the repo *less* consistent),
- not `spec-suspect`,
- not in a `cross-axis pair` and free of `dependsOn`/`invalidatedBy` edges (step 8) — exactly the findings whose correct fix waits on a verdict the user hasn't given yet.

Two preconditions. The fix agent **re-derives both itself, as its first act** — `git status --porcelain`, `git rev-parse --abbrev-ref HEAD` — never trusting values threaded through the script: the tree may have changed since launch, and a value that didn't arrive must demote loudly, not pass silently.

- **Clean tree.** If the tree is dirty, the whole tier demotes to needs-your-call. Never commit around a user's uncommitted work.
- **Not the default branch** — or the user OK'd committing there in step 1 (the OK travels in the agent's brief; the branch check doesn't).

Either way, the report line says *which* happened: "demoted: dirty tree" and "demoted: couldn't verify preconditions" are different lines, and only the second is a bug to chase.

The workflow's final stage is **one fix agent** in the main checkout — never parallel worktrees; serial application by a single agent is what makes review fixes stop colliding. It applies the batch in order, **one commit per finding ID** (`review: STD-3 — <one-liner>`), runs the full test suite once at the end, reverts any finding-commit that breaks it, and demotes that finding to needs-your-call with the failure attached. Because it is the last stage, the workflow completes with every auto-apply landed — triage never races it, and the triage loop cites its commit SHAs.

### 10. Open with the summary only

When the workflow returns, post one short orientation message built from its queue — **not** the findings themselves:

- The applied list, a cross-axis convenience list, not a re-ranking: **Applied automatically:** STD-1 (`abc1234`), SPEC-3 (`def5678`).
- Counts per axis, how many the validators refuted (dropped; wrap-up only), and how many need a verdict.
- The worst issue _within each axis_, cited by ID. Don't pick a single winner across axes — that's the reranking the separation exists to prevent.
- One line naming the verdicts that are coming: **fix**, **ticket**, **later**, **skip**, plus **explain** and **revert**.
- When step 3 found no documented standards at any scope, say so up front: every Standards finding this round is a judgement call, and this axis will not shrink between rounds until the recurring calls get written down as rules — each `later` ticket's `CONVENTIONS.md` task item is the mechanism.

Dumping every finding block here defeats the whole point of the loop below. Keep it to a handful of lines.

### 11. Triage the findings one at a time

Walk the queue one finding per turn. **One finding on screen, one verdict, next.** A wall of blocks is what makes review feedback expensive; this loop is the skill's main ergonomic promise, so never collapse it back into a batch dump on your own initiative.

Order the queue: auto-applied findings first (a revert should land before later fixes stack on top of it), then Standards, then Spec; within each axis, hard violations before judgement calls. Findings marked **already ticketed: #N**, **already adjudicated**, or **`finding-refuted`** are not in the queue at all.

For each finding, print its block:

```
### STD-1 — src/foo.ts:42 (judgement call, repo-wide) — 4 of 11
- **Finding:** <one-line description>
- **Why it matters:** <consequence, citing the standard rule or spec line>
- **Proposed fix:** <the proposal, with its sketch>
- **Validation:** validated | fix-rejected — <reason> | needs-human — <the trade-off>
- **Size:** quick-fix | needs-a-session
- **Status:** applied in <sha> | needs your call | instance of open #N | possibly duplicates #N
```

A `cross-axis pair` never gets a blind turn: when the first member comes up, render **both** blocks — both proposals, both validation verdicts — and ask one question whose options pick between the competing fixes (or reject both). That verdict settles both IDs; record the second and don't re-ask it on its turn.

The `n of N` counter goes in the header so the user always knows how much is left. Spec findings put their classification in the header line too (`code-diverges` / `spec-suspect`). A `spec-suspect` block additionally carries a **Draft spec comment:** — the comment that would go on the spec issue if the user agrees the spec is what's wrong. Draft only; never post it without a verdict.

Then ask for that one finding's verdict with `AskUserQuestion` — a single question, options tailored to the finding:

- **Needs your call:** `fix` (queue for the fix subagent), `ticket` (child of the spec), `later` (truly out of scope for this spec — standalone cleanup ticket), `skip` (drop). Lead with the one the validation actually supports — `fix` for a `validated` `quick-fix`, `ticket` for a `validated` `needs-a-session` or a `fix-rejected` (the finding is real; the fix needs rethinking in its own session), `later` for anything `repo-wide` — and mark it `(Recommended)`.
- **Auto-applied:** `keep` first, then `revert`, then `ticket` (the fix landed but something adjacent still needs work).

`explain` isn't an option button — the user reaches it through the free-text answer, along with any freeform note. When they do: answer it, then **re-ask the same ID** before advancing. Never carry an unresolved ID past its turn.

Record each verdict and move on — **act on none of them yet**. File-clustered tickets (step 12) and the single serial fix subagent both need the whole set before they can run.

Two escape hatches, both honoured immediately: if the user answers several IDs at once, or asks for the rest in one go, drop out of the loop and take the remaining verdicts as text; if they say to stop, treat every untouched ID as `skip` and go straight to the wrap-up.

### 12. Act on the collected verdicts

When the loop ends, act on each verdict:

- **fix** — collect every `fix` verdict into one batch and spawn a **round-2 fix subagent** with the step 9 discipline: serial, one commit per finding ID, test suite at the end, breakers reverted and reported. It must **re-ground each proposal against current `HEAD`** — earlier fix commits have moved lines since the sketches were written; find the quoted snippet, don't trust `file:line`. A `fix` verdict on a `fix-rejected` or `needs-human` proposal is never applied blind — that objection gets surfaced and a revised fix agreed **in the loop, on that finding's turn**, before the queue advances. Walk the step 8 edges before spawning: a `fix` whose `dependsOn` names a skipped or reverted ID doesn't queue — surface the conflict and get a revised verdict; a `fix` whose proposal was `invalidatedBy` an accepted sibling goes to the fix agent with the stale premise called out for re-wording — otherwise the agent writes text a verdict just made false.
- **revert** — done by you in the main session, not a subagent: `git revert` that finding's commit; if later fix commits conflict with the revert, hand-apply the inverse instead. Valid for any fix-subagent commit from any round.
- **ticket** — **cluster by file** before publishing: `ticket`-verdicted findings that touch the same file(s) become **one ticket** as long as the combined work still fits a single fresh session; past that cap, split into independent tickets with **no blocking edges** — file overlap is not a blocker, and `/ship`'s serial merge is where overlap is absorbed. Each ticket: title from the finding or cluster; body carrying the findings / why they matter / proposed fixes / validation verdicts, anchored by file + quoted snippet (no line numbers — they go stale); labels `impl` + `ready-for-agent` + `review-finding` (bootstrap first if needed). When the spec source was a tracker issue, make each ticket a **child of that spec issue** so `/ship <spec>`'s frontier query and `/next` pick them up with no extra wiring.
- **later** — for work that is **truly out of scope for this spec**. (Contrast with `ticket`: *ticket* = fix it in the next ship round, in its own session; *later* = not part of this effort at all.) Publish a **standalone** ticket, *not* a child of the spec, labelled `review-finding` + `needs-triage`. Body: the repo-wide pattern statement, the diff findings quoted as evidence, the proposed fix approach, and a task item to **append the rule to the governing `CONVENTIONS.md`** (the scope nearest the pattern, root when it's repo-wide — per `/conventions`) so future reviews enforce it as a documented standard instead of rediscovering it. A `later` ticket is a parking lot: no frontier query reaches it, it never blocks the loop or the PR, and nothing works it until the user decides to pick it up — at which point it seeds a **fresh effort** (its own spec, or a wayfinder map if it needs charting), never an appendix to this one.
- **skip** — drop it; note it as skipped in the wrap-up.
- **keep** — the auto-applied fix stands; nothing to do.

Close with a wrap-up recap — one line per ID and its terminal outcome, which is the first and only time the whole set appears together.

After publishing, post **one summary comment on the spec issue** — the round's full adjudication record: every finding ID and its terminal outcome, **including skips and validator-refuted findings** (one-line reason each) and reverts, plus the child tickets created and the standalone `later` tickets. The next round's step 5 dedups against this comment — a verdict not recorded here will be re-found and re-asked, so completeness here is what makes the loop converge.

Every queued finding must reach a terminal outcome — applied, ticketed, parked as `later`, skipped, kept, or reverted. Anything that gained a new proposal mid-triage (a revised fix agreed after an `explain`) goes back through the round-2 fix subagent, not straight to disk. Findings whose proposals were `fix-rejected` stay report-only by default — the finding is real even though the fix isn't — so never auto-ticket them without the user's explicit verdict.

### 13. Offer the merge (when the spec is a tracker issue)

If the spec source was a tracker issue and the findings are clean or fixed, offer to open a PR whose body `Closes #<spec>` so the merge closes the spec issue and links the work it fulfills. Only open it if the user says yes. If the user then asks to merge it, **squash-merge** (`gh pr merge --squash`) — the spec lands as one commit on the default branch, not its ticket-by-ticket history.

**Suppress this offer while the spec issue has open children** — including any tickets step 12 just published. Merging would close a spec with known open defects; offer a plain PR (no `Closes`) instead, or wait for the children to land. Standalone `later` tickets are **not** children and do not suppress the offer — that's why they're standalone.

## The ship ↔ review loop

This review is half of a loop: `/ship` implements, this skill reviews, `ticket` verdicts become spec children, `/next` routes back to shipping, and the pair repeats. The loop is **done** when a round yields no `fix` or `ticket` verdicts — which is exactly when step 13's PR offer un-suppresses. Each round must shrink: `fix`/`ticket` remove findings by resolving them, `skip`/`later`/`finding-refuted` remove them by adjudication memory (steps 5 and 12), and `spec-suspect` findings amend the *spec* rather than churning the code. If a round fails to shrink — as many new findings as the previous round, or more — say so plainly: the spec is under-defined or a standard is undocumented, and the next move is sharpening those documents, not another lap. A flat round of judgement calls is the same signal as a growing one: with nothing documented, the Standards axis re-derives taste from the smell baseline every lap and will produce a fresh crop of defensible-but-arguable findings indefinitely.

## Why two axes

A change can pass one axis and fail the other:

- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what the issue asked but breaks the project's conventions → **Spec pass, Standards fail.**

Reporting them separately stops one axis from masking the other — and the fix-validation pass's cross-axis check (step 8) is where the separation pays off again: it catches a fix for one axis quietly breaking the other.
