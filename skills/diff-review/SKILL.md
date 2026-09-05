---
name: diff-review
description: Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes — Standards (does the code follow this repo's documented coding standards, plus the Fowler smell baseline?) and Spec (does the code match what the originating issue/PRD asked for?). Runs the find→validate→propose→validate→route pipeline as one dynamic workflow — both axis reviews in parallel (partitioned into shared subsystem groups when the diff is wide), every finding labeled and adversarially validated (refuted findings dropped), a fix proposed per survivor and adversarially validated — and validated findings resolve themselves, quick fixes auto-applied by a serial fix agent, session-sized fixes auto-ticketed for the ship loop. Only questions about intent reach the user — spec unclear, competing fixes, genuine trade-off, no working fix, pervasive pattern — walked one question per turn. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to "review since X".
---

Two-axis review of the diff between `HEAD` and a fixed point the user supplies:

- **Standards** — does the code conform to this repo's documented coding standards (plus the smell baseline below)?
- **Spec** — does the code faithfully implement the originating issue / PRD / spec?

**The policy — shared with `/ship`: escalate questions about intent, auto-resolve questions about code.** The user is the intent authority, not a code reviewer — the review must never require them to hold the code in their head. Every validated finding with an uncontested fix resolves itself: applied and committed by the serial fix agent, or published as a ticket the rest of the workflow (`/ship`, `/next`) picks up. What reaches the user is exactly the set of questions the pipeline *cannot* answer, because they are questions about what was meant:

- **Spec unclear** (`spec-suspect`) — the spec is ambiguous, self-contradicting, or possibly wrong on a case the code had to decide, and the user's answer would change what gets built. (Silence alone is not a question: silence plus one defensible choice resolves itself.)
- **Competing fixes** — both axes found the same defect and their validated fixes are incompatible.
- **Genuine trade-off** — a fix validator concluded the choice is a judgement only the owner can make (`needs-human`).
- **No working fix** — the finding is real but every proposed fix was rejected or broke the suite (`fix-rejected`).
- **Pervasive pattern** — the violation exists outside the diff too (`repo-wide`); fixing three of forty instances is a codebase-direction decision, and possibly a rule waiting to be written.

The whole pipeline — both axis reviews in parallel (partitioned into shared subsystem groups when the diff is too wide for one reader), per-run finding IDs, adversarial finding validation (a refuted finding is dropped there, before any fix is drafted), fix proposals for the survivors, adversarial fix validation, and the routing that resolves every survivor — runs as **one dynamic `Workflow`**: stage order is enforced by script rather than discipline, and the manager's context stays clean for the question loop. It implements the invariant contract in `/finding-pipeline`, shared with `/ship` and the document gates — when an invariant needs changing, change the contract, not a copy. The manager then walks the escalations past the user **one question per turn**, phrased in domain language, and acts on the answers — further fixes, spec comments, tickets, reverts. Nothing is ever edited in the review session itself outside the fix agents.

For the issue tracker, invoke `/issue-tracker`.

## Process

### 1. Pin the fixed point

Whatever the user said is the fixed point — a commit SHA, branch name, tag, `main`, `HEAD~5`, etc. If they didn't specify one, ask for it.

Capture the diff command once: `git diff <fixed-point>...HEAD` (three-dot, so the comparison is against the merge-base). Also note the list of commits via `git log <fixed-point>..HEAD --oneline`.

Before going further, confirm the fixed point resolves (`git rev-parse <fixed-point>`) and the diff is non-empty. A bad ref or empty diff should fail here — not inside the workflow.

Record three more facts for later:

- How big is the diff (`git diff <fixed-point>...HEAD --stat`)? The size decides whether step 4 partitions the reviews.
- Is the working tree clean (`git status --porcelain`)? A dirty tree demotes the auto-apply tier to tickets (step 9).
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
- **A heuristic, not a verdict.** Each smell enters the pipeline as a labelled hypothesis ("possible Feature Envy") that must survive adversarial validation like any other finding — and, like any standard here, skip anything tooling already enforces. Past validation, a smell routes exactly like a documented-rule breach: a validated quick fix auto-applies, a session-sized one auto-tickets, and only the intent questions reach the user.

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

### 4. Fill and launch the pipeline workflow

Steps 4–9 — review, label, validate findings, propose, validate fixes, route and auto-resolve — run as **one dynamic `Workflow`** (this skill is your authorization to use it). The manager fills the workflow template, launches it, relays progress, and does no review work itself; the stage briefs in steps 4–9 are the prompts the template embeds — keep the two in sync when either changes. Script order is what makes the pipeline honest: a proposer cannot see a finding whose validator refuted it, because the script never hands it one.

Hand the stages everything they need — the workflow has no conversation context; these are the template's `FILL` slots:

- the diff command and the commit list with full messages,
- the spec contents (or "no spec"),
- the standards sources with the directory scope each binds (the smell baseline itself is embedded in the template — step 3's text and the template's `SMELL_BASELINE` const are the same words, kept in sync),
- the dedup inputs for step 5 — fetch the open `review-finding` tickets and the spec issue's prior-round summary comments **before** launching (the summaries also feed the validators as the binding answer record),
- the auto-ticket agent's tracker inputs — the spec issue's ref when the spec is a tracker issue, and the tracker's create/label/parent operations per `/issue-tracker`,
- the user's default-branch OK from step 1, when given (the fix agent re-derives the tree and branch state itself — step 9).

**Start from [workflow.template.js](workflow.template.js) — fill it, don't author from scratch.** Read the template and fill every `FILL` slot in its data block (the list above, plus the `WIDE` flag judged from step 1's `--stat`). Everything below its FIXED marker — schemas, prompt builders, stage order, the barriers — is the same every run; edit it only when this run genuinely deviates. An unfilled slot throws `FILL is not defined` at launch — loud, before any agent spawns. Two observed failure modes shaped the template; filling it correctly keeps both dead. First, `args`: it has arrived as a JSON *string*, turning every `${args.x}` into the literal `undefined` — and a prompt interpolating `undefined` doesn't fail; the agent silently rediscovers its input with Bash, or proceeds without it — so the template threads nothing through `args`. Second, backticks: a markdown code span quoting a symbol or shell command — the natural way to write spec or standards prose — terminates a template literal and kills the launch with a parse error — so fill the prose slots as JSON string literals (double-quoted, `\n`-escaped), which no code span or apostrophe can terminate.

The template gives every stage a `schema` so verdicts come back as typed fields — `finding-refuted` vs `fix-rejected` is an enum value, never prose the manager interprets. It runs the two axes as independent chains — a Standards finding needn't wait for the Spec reviewer — and within an axis, findings flow in chunks of ~5 through validate → propose → validate-fix as independent pipeline chains, no cross-chunk barriers. The deliberate barriers that remain: the routing step (plain script over the whole queue), the serial fix agent, and the auto-ticket agent (step 9). The workflow returns the full labeled queue — every finding with its flags, verdicts, proposal, size, route, and applied SHA or ticket ref — plus the escalation queue with question classes, and that return value is all the manager sees of the pipeline.

**Partition wide diffs.** One reviewer per axis is the default and, when the diff fits, the better one — a single reader sees every cross-file pattern. Past what one reviewer can hold alongside its standards and spec (soft heuristic: more than ~15 files or ~1,500 changed lines, judged from step 1's `--stat` — the template's `WIDE` slot), the script inserts a **partition stage**: one cheap agent reads the file list and stats — not the full diff — plus the spec and the standards-scope map, and clusters the changed files into logical groups, by subsystem or directory, which also aligns with scoped `CONVENTIONS.md` boundaries. Each group becomes a path-scoped diff command (`git diff <fixed-point>...HEAD -- <paths>`), and **both axes share the one partition** — then one reviewer per group per axis:

- A **Standards chunk reviewer** gets its group's diff command and only the standards governing those paths (plus the smell baseline).
- A **Spec chunk reviewer** gets its group's diff command, the spec **kernel** with its full Decision Index, and the **full text of the decisions routed to its group** — the partition stage assigns decision IDs to groups the same way it clusters files (it already reads the spec). The index one-liners stand in for every other decision, so scope creep stays checkable against the whole decision surface; a reviewer that suspects a hunk answers an unrouted decision fetches that decision by ID (the tracker doc's read). Its report also lists **which spec requirements its slice touches**. (A pre-index spec is passed whole instead — it has no units to route.)

Partitioning silently breaks two whole-diff properties; the script restores each:

- **Cross-file smells.** Duplicated Code, Repeated Switches, Shotgun Surgery, and Divergent Change span groups by nature — no chunk reviewer can see them. One extra **cross-cutting sweeper** reads the whole diff at low resolution (file list and hunk headers, reading closer only where something looks suspicious), hunting only those four.
- **Missing requirements.** "Asked for and never built" is a property of the union, not any slice. The script unions the chunks' requirement-coverage lists; each requirement no slice claims goes to one small checker agent — absent from the changed files ≠ unimplemented; it may pre-exist — before entering the queue as a finding.

**Reviewer stage** — one agent per axis, or per group and axis when partitioned.

**Standards reviewer prompt** — include:

- The diff command (path-scoped, when partitioned) and commit list.
- The list of standards-source files you found in step 3 — with the directory scope each one binds, and the instruction that a scoped `CONVENTIONS.md` governs only files under its directory, nearest scope winning — **plus the smell baseline from step 3** pasted in full; the reviewer has no other access to the baseline.
- The brief: "Report — per file/hunk where relevant — (a) every place the diff violates a documented standard: cite the standard (file + the rule); and (b) any baseline smell you spot: name it and quote the hunk — a smell is a labelled hypothesis for the validators, and a documented repo standard overrides the baseline. (c) When a finding looks like an instance of a pattern rather than a one-off, and the pattern has a statable grep signature (a banned element or API, a naming rule), grep for it outside the diff and flag the finding `repo-wide` only with the grep and both counts attached — instances inside the diff, instances outside it, counting only instances the rule actually governs (apply the rule's own scope and any grandfather clause). A pattern with zero governed instances outside the diff is this change's own duplication, not a repo pattern. Skip anything tooling enforces. Under 400 words."

**Spec reviewer prompt** — include:

- The diff command (path-scoped, when partitioned) and commit list.
- The path or fetched contents of the spec.
- The brief: "Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Treat the spec's decision snippets (state machines, schemas, type shapes, contracts — inline or in its addressable decisions) as requirements — divergence from one is a finding like any other. Quote the spec line, with its decision ID where it has one, for each finding. Under 400 words."

If the spec is missing, the script skips the Spec reviewer stage; note this in the final report.

### 5. Label the findings

A labeling stage normalizes each report into a list of discrete findings — the aggregator's "light cleaning". When the reviews were partitioned, it also dedups across group boundaries: the cross-cutting sweeper and a chunk reviewer may report the same hunk. The script assigns each finding an ID: `STD-1`, `STD-2`, … for Standards, `SPEC-1`, `SPEC-2`, … for Spec, numbered in report order. (Axis-prefixed IDs keep the axes separate and need no coordination between the reviewers; IDs are per-run — a re-run renumbers.)

Each finding carries: its ID, a `file:line` location, a one-line description, the `repo-wide` flag where raised (with its grep evidence), and the cited source (the standard's rule or the named smell, or the spec line — with its decision ID where it has one). Do **not** merge or rerank findings across axes — the two axes are deliberately separate (see _Why two axes_).

**Detect cross-axis pairs.** When a Standards and a Spec finding anchor to the same file and overlapping lines, they are usually one defect wearing two labels — and their proposed fixes can compete. Label each `cross-axis pair: <other ID>`. The pair stays two findings on two axes with two proposals, but routes as a unit: a pair-resolution check (step 8) settles whether the two validated fixes **agree or compete** — an agreeing pair auto-applies as one commit covering both IDs; a competing pair escalates as one question whose answer settles both.

**Dedup against open review tickets.** Match against the open `review-finding` tickets fetched pre-launch (per the tracker doc). Match conservatively: a standalone cleanup ticket matches at the rule/pattern level; a spec-child ticket matches only same file + same rule. Then:

- A finding whose subject **predates this diff** (visible in context, not introduced by the change) and matches an open ticket → mark **already ticketed: #N** — no proposal, no validator, out of the pipeline.
- A finding this diff **introduces** that matches a ticketed pattern → mark **instance of open #N** and keep it in — new instances of a known pattern are new debt, and fixing your own new instances doesn't reduce repo consistency.
- An uncertain match → mark **possibly duplicates #N** and keep it in. A visible duplicate is recoverable; a silent suppression isn't.

**Dedup against prior rounds.** Also match against the spec issue's review **summary comments**, likewise fetched pre-launch (step 12 posts one per round): every finding adjudicated in an earlier round — auto-applied, auto-ticketed, answered by a verdict, refuted by a validator, reverted, or left as-is — is already decided. A finding matching one → mark **already adjudicated (<outcome>)**: no proposal, no validator, one line in the wrap-up. This memory is what makes the ship ↔ review loop converge — no finding is ever re-litigated. The memory cuts a second way: an answered verdict in a prior summary, and any spec comment a verdict posted, is **binding spec text** — a new finding one directly governs stays in but classifies as divergence from the answer (step 6), never as a new question.

### 6. Validate each finding — adversarially, before any fix exists

Validation by the finding's author is theater — and validating a finding only *through* its fix conflates two questions: a validator that refutes a fix by undercutting the finding's premise produces an incoherent verdict. So findings are validated **on their own, before any fix is proposed**: a stage of **fresh validator agents** that did not author the findings, prompted to **refute the finding itself** — one validator per chunk of ~5 findings, chunks in parallel. Chunking cuts both ways of the old all-or-one shape: no single mega-batch serializing a busy axis into one long generation, and no swarm of single-finding agents each re-ingesting the full diff and spec. Each chunk then rides its own validate → propose → validate-fix chain (steps 6–8) with no cross-chunk barrier — one chunk can be at the fix-validation stage while another is still validating findings.

Each validator gets the finding, the diff command, the commit list **with full messages** (`git log <fixed-point>..HEAD`), and both axes' inputs (the standards sources / smell baseline, and the spec), and answers one question: **is the finding real?** Read the cited source and the actual hunk — does the standard rule or spec line say what the reviewer claims, does the code actually breach it, and does the claimed harm survive what the compiler and tooling already guarantee?

Two more calls belong to this pass, because they are properties of the finding, not of any fix:

- **Spec classification** (Spec findings only): label the finding **`code-diverges`** or **`spec-suspect`**, decided by one test: **would the user's answer change the fix?** `spec-suspect` only when two or more defensible readings call for different behaviour, the record shows a deliberate deviation (read the commit messages and any tests touching the diverging code), or the spec's own statements collide. Spec silence alone is not doubt: a defect with one defensible minimal fix — a visible bug, a wrong comment, dead code the diff itself added — is `code-diverges` even where the spec never speaks. Answered verdicts from prior rounds and the spec comments they posted are binding spec text: a finding one directly governs is `code-diverges` from that answer, never a re-ask. Where real behavioural doubt survives the test → `spec-suspect` — a false spec-suspect costs one human glance; a false code-diverges silently rewrites behaviour.
- A validator may raise the **`repo-wide`** flag on a Standards finding the reviewer missed — carrying the same grep-and-counts evidence the reviewer owes (step 4).

Verdict per finding:

- **`finding-refuted`** (with the reason) — the finding doesn't hold. It leaves the pipeline here: no proposal, no question; it appears only as a one-liner in the wrap-up and the round summary so the next round's dedup remembers it.
- **`finding-validated`** — real; it proceeds to proposal.

### 7. Propose a fix per validated finding

**One proposer agent per chunk** — its chunk's **surviving** findings share context, so fixes that overlap get drafted coherently, and per-chunk keeps agent count sane without collapsing a busy axis into one long generation. Give each proposer its survivors — with the validators' reasoning attached — the diff command, and this brief:

"For each finding, propose the smallest concrete fix that resolves it: what to change, where — anchor by file plus a short quoted snippet of the code being changed, not a bare line number (lines drift once fixes start landing) — and a short sketch of the changed code — a sketch, not a full patch. Also size each fix: `quick-fix` (a few edits — a candidate for the serial fix agent) or `needs-a-session` (a fresh context window's worth of work), and mark `doc-only` where the entire fix lives in comments, docs, or headers — no executable code. Keep each proposal under 100 words."

For baseline smells, the smell's generic "→ how to fix" is the starting point — the proposer's job is grounding it in the actual hunk. A `spec-suspect` finding gets a fix sketch *per plausible reading* where that's cheap — the user's answer picks one.

### 8. Validate each proposal — adversarially, independently

Validation by the proposal's author is theater. This stage's **fresh validator agents** — not the proposers, and not step 6's finding validators — are prompted to **refute the fix**, one per chunk, chunks in parallel.

Each validator gets its chunk's findings (with their step 6 validation reasoning), the proposals, the diff command, the commit list, both axes' inputs, and the **whole axis's finding roster** — IDs, files, one-liners — so the edge fields below can name findings outside its chunk. It checks:

1. **Does the fix actually resolve the finding?**
2. **Is it proportionate?** The minimal change that clears the finding — no speculative rewrites.
3. **Cross-axis check:** a fix for a Spec finding must not introduce a Standards violation, and a Standards fix must not change behaviour the spec asked for.
4. **Re-settle `repo-wide`:** confirm or clear the flag, carrying the counts as schema fields (`instancesInDiff`, `instancesOutsideDiff`) — counting **only instances the cited rule actually governs**: apply the rule's own scope and any grandfather clause, so a rule binding only new-and-edited files never counts untouched ones. The flag holds only when governed `instancesOutsideDiff > 0` — a "pattern" whose every governed instance sits inside the diff is this change's own duplication, fixable here. This stage has the last word: the routing step reads the flag from here, not from the reviewer.
5. **Confirm or clear `doc-only`** — final word: true only when the fix touches no executable code. A validated `doc-only` quick-fix on a `spec-suspect` finding auto-applies instead of escalating (step 9), so confirm it only when the code's current behaviour is right and only the record about it is wrong.

Verdict per proposal: **`validated`**, **`fix-rejected`** (with the reason), or **`needs-human`** (a genuine trade-off the user must call). The finding's reality is not on the table here — step 6 settled it. A fix validator that still doubts the premise records that doubt inside its `fix-rejected` reason; the finding keeps its validated status and escalates, where the user makes the call.

The proposal schema also carries two edge fields the validator fills instead of burying in prose: `dependsOn: [IDs]` — this fix only works if those findings' fixes land too (say, it reads a const another fix introduces) — and `invalidatedBy: [IDs]` — accepting one of those findings' fixes makes this proposal's premise or wording false. The routing step acts on these edges; an edge recorded only as reasoning prose is an edge nobody acts on.

**Pair resolution.** For each cross-axis pair whose members both survived, one extra check settles **`pairResolution: 'agreeing' | 'competing'`** as a schema field — agreeing means the two proposals are compatible or identical in effect (both can land, or one subsumes the other); competing means they cannot both land. This stage has the last word on the pair, as it does on `repo-wide`.

### 9. Route every survivor

Plain script logic over the schema fields — no agent decides this:

1. **Escalate** — route to the user — when **any** hold: `spec-suspect` — *unless* its fix came back `validated` + `quick-fix` + `doc-only`, which auto-applies instead (behaviour already deemed right; only the record was wrong); `needs-human`; `fix-rejected`; member of a **competing** cross-axis pair; `repo-wide` (governed `instancesOutsideDiff > 0`). Each escalation gets a question class from the policy list and joins the queue.
2. Otherwise **auto-apply** when: `validated` and `quick-fix`. Agreeing cross-axis pairs auto-apply as a unit — one commit covering both IDs. `dependsOn` edges among auto-applying findings order the batch; they never block it.
3. Otherwise **auto-ticket**: `validated` and `needs-a-session`.
4. **Edges and pairs route together**: a finding whose `dependsOn` target auto-tickets joins that ticket; whose target escalated, joins the escalation as context (its fix waits on the answer). A proposal `invalidatedBy` a finding that auto-applied gets its stale premise re-grounded by the fix agent before applying; `invalidatedBy` an escalated finding → escalate together. A pair routes at its most conservative member: either escalates → both do; either tickets → one shared ticket.

**The auto-apply agent** — one `model: 'sonnet'` fix agent in the main checkout — never parallel worktrees; serial application by a single agent is what makes review fixes stop colliding. It **re-derives both preconditions itself, as its first act**: `git status --porcelain` (dirty tree → the whole tier demotes to auto-ticket; never commit around a user's uncommitted work) and `git rev-parse --abbrev-ref HEAD` (default branch without the user's step 1 OK → demote likewise; the OK travels in the agent's brief, the branch check doesn't). The report line says *which* happened: "demoted: dirty tree" and "demoted: couldn't verify preconditions" are different lines, and only the second is a bug to chase. It applies the batch serially in dependency order, **one commit per finding ID** (`review: STD-3 — <one-liner>`; one commit per pair for agreeing pairs), runs the full test suite once at the end, reverts any finding-commit that breaks it, and escalates that finding as **no working fix** with the failure attached.

**The auto-ticket agent** — `model: 'sonnet'` at low reasoning effort, pure tracker mechanics, runs after the fix agent so precondition demotions land in its batch. It clusters findings by file while the combined work fits one session (past that cap, independent tickets with **no blocking edges** — file overlap is not a blocker; `/ship`'s serial merge is where overlap is absorbed). Each ticket body carries the findings, why they matter, the validated proposals, and anchors by file + quoted snippet (no line numbers — they go stale). When the spec is a tracker issue, each ticket is a **child of that spec** with labels `impl` + `ready-for-agent` + `review-finding`, so `/ship <spec>`'s frontier query and `/next` pick it up with no extra wiring; with no tracker spec, tickets publish standalone with `ready-for-agent` + `review-finding`.

### 10. Open with the orientation summary

When the workflow returns, post one short message built from its queue — the audit digest first, stated as *done*, not proposed: findings raised → refuted → auto-applied (IDs + SHAs) → auto-ticketed (ticket #s). The user can override any of it by free text (`revert STD-7`, `close #12`) — the manager `git revert`s that finding's commit or closes the ticket. Then:

- The escalation count by question class, per axis — never the question blocks themselves.
- When step 3 found no documented standards at any scope, one line saying so: the smell baseline was the only Standards source this round, and the axis sharpens as rules get written — each pervasive-pattern *adopt as rule* ticket is the mechanism.

Dumping every question block here defeats the loop below. Keep it to a handful of lines.

### 11. The question loop

Walk the escalation queue **one question per turn**. A wall of blocks is what makes review feedback expensive; this loop is the skill's main ergonomic promise, so never collapse it into a batch dump on your own initiative.

Order the queue: Spec questions before Standards questions; within each, the ones later work most likely builds on first. Findings that auto-resolved, were refuted, or were shelved by dedup are not in the queue at all. Per escalation, print its block per `/hitl-questions` (anchors and code excerpts arrive on request, via `explain`):

```
### <short plain title of the finding> — spec question — 2 of 3 (SPEC-4)
- **The question:** <one line, in the domain's terms>
- **What the source says:** <the decision or rule named by what it requires, then its quoted line; or "the spec is silent here">
- **What the code does today:** <one line, behavior not implementation>
- **Why it needs you:** spec unclear | competing fixes | genuine trade-off | no working fix | pervasive pattern
- **Options:** <each option as a behavior choice, with its consequence and what it triggers — fix now, ticket, spec comment>
- **Recommendation:** <the option you'd pick and the one-line why>
```

— then ask with `AskUserQuestion` per `/hitl-questions`. Class-specific shapes:

- **Spec unclear** (`spec-suspect`) — the options are the plausible readings, plus "the code is right as written". The block carries a **draft spec comment** for the chosen reading — posted to the spec issue only on the user's verdict, so the spec accretes the answer and no later round re-asks it.
- **Competing fixes** — one question for the pair: which behavior wins. The verdict settles both IDs; the losing fix is recorded rejected.
- **Genuine trade-off** — the trade-off's horns as options, consequences stated.
- **No working fix** — options: ticket it for a fresh attempt with the failure attached, or leave it (recorded, with the reason).
- **Pervasive pattern** — options: **adopt as rule** (a standalone ticket — never a spec child — labeled `review-finding` + `needs-triage`, carrying the pattern, the grep evidence, and a task to append the rule to the governing `CONVENTIONS.md` per `/conventions`, so future reviews enforce it as a documented standard instead of rediscovering it; a parking lot nothing works until the user picks it up — at which point it seeds a fresh effort, its own spec or map, never an appendix to this one), **fix everywhere** (a ticket covering all instances — a spec child when the spec is a tracker issue), or **leave as-is**.

A finding routed **joined** — its fix waits on another escalation's answer — rides its target's block as one line of context, never its own turn; the target's verdict settles it too. Never carry an unresolved ID past its turn. `/hitl-questions`' escape hatches bind here as: `explain` answered then the same ID re-asked; batched verdicts taken as given; "stop" recording every untouched ID as `unanswered` before the wrap-up.

### 12. Act on the collected answers

When the loop ends, act — none of it mid-loop:

- Post the chosen **spec comments** for spec-unclear verdicts.
- Run one **round-2 fix agent** (Sonnet, the step 9 discipline: serial, one commit per finding ID, full suite at the end, breakers reverted and reported) for the fixes the answers unlocked. It must **re-ground each proposal against current `HEAD`** — earlier fix commits have moved lines since the sketches were written; find the quoted snippet, don't trust `file:line`. Walk the step 8 edges before spawning: a fix whose `dependsOn` names a reverted or left-as-is ID doesn't queue — surface the conflict and get a revised verdict; a fix whose proposal was `invalidatedBy` an accepted sibling goes in with the stale premise called out for re-wording.
- File the tickets the answers called for — same clustering and parenting as the auto-ticket agent; *adopt as rule* tickets standalone per step 11. Also file any findings the workflow returned as **ticket-pending** (no tracker mechanics were passed, or the ticket agent failed to publish them) — they were routed auto-ticket and must not be lost.
- `git revert` anything the audit overrode — done by you in the main session, not a subagent; if later fix commits conflict with the revert, hand-apply the inverse instead. Valid for any fix-agent commit from any round.

Close with a wrap-up recap — one line per ID and its terminal outcome (auto-applied, auto-ticketed, refuted, answered with its verdict, reverted, left as-is, unanswered) — the first and only time the whole set appears together.

After that, post **one summary comment on the spec issue** — the round's full adjudication record: every finding ID and its terminal outcome, **including refutations, reverts, and left-as-is calls** (one-line reason each), plus the child tickets and standalone tickets created. The next round's step 5 dedups against this comment — an outcome not recorded here will be re-found and re-asked, so completeness here is what makes the loop converge.

### 13. Offer the merge (when the spec is a tracker issue)

If the spec source was a tracker issue and the findings are clean or resolved, offer to open a PR whose body `Closes #<spec>` so the merge closes the spec issue and links the work it fulfills. Only open it if the user says yes. If the user then asks to merge it, **squash-merge** (`gh pr merge --squash`) — the spec lands as one commit on the default branch, not its ticket-by-ticket history.

**Suppress this offer while the spec issue has open children** — including any tickets this round published, auto or answered. Merging would close a spec with known open defects; offer a plain PR (no `Closes`) instead, or wait for the children to land. Standalone *adopt as rule* tickets are **not** children and do not suppress the offer — that's why they're standalone.

## The ship ↔ review loop

This review is half of a loop: `/ship` implements, this skill reviews, its tickets become spec children, `/next` routes back to shipping, and the pair repeats. The loop is **done** when a round auto-applies nothing, tickets nothing, and escalates nothing — which is exactly when step 13's PR offer un-suppresses. Each round must shrink: auto-applies and tickets remove findings by resolving them, refutations and answered verdicts remove them by adjudication memory (steps 5 and 12), and spec-unclear answers amend the *spec* rather than churning the code. If a round fails to shrink — as many new findings as the previous round, or repeat escalations of the same class — say so plainly: recurring `spec-suspect` means the spec is under-specified in a systematic way; recurring pervasive patterns mean a standard is waiting to be written. The next move is sharpening those documents, not another lap.

## Why two axes

A change can pass one axis and fail the other:

- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what the issue asked but breaks the project's conventions → **Spec pass, Standards fail.**

Reporting them separately stops one axis from masking the other — and the fix-validation pass's cross-axis check (step 8) is where the separation pays off again: it catches a fix for one axis quietly breaking the other.
