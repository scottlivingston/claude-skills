---
name: two-axis-review
description: Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes — Standards (does the code follow this repo's documented coding standards?) and Spec (does the code match what the originating issue/PRD asked for?). Runs both reviews in parallel sub-agents, labels every finding, proposes and adversarially validates a fix for each, auto-applies the mechanical validated fixes via a serial fix subagent, and reports the rest for per-ID batch feedback — queue more fixes, publish tracker tickets, or park repo-wide patterns as standalone cleanup tickets. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to "review since X".
---

Two-axis review of the diff between `HEAD` and a fixed point the user supplies:

- **Standards** — does the code conform to this repo's documented coding standards?
- **Spec** — does the code faithfully implement the originating issue / PRD / spec?

Both axes run as **parallel sub-agents** so they don't pollute each other's context. The skill then labels each finding with a per-run ID, proposes a fix per finding, adversarially validates each proposal, **auto-applies the mechanical validated tier** through a single serial fix subagent, and presents one report the user triages with per-ID verdicts — queuing further fixes to the fix subagent, publishing session-sized findings as tickets the rest of the workflow (`/ship`, `/next`) can pick up, and parking repo-wide patterns as standalone cleanup tickets. Nothing is ever edited in the review session itself.

For the issue tracker, read `issue-tracker.md` in this plugin's `skills/` directory (one level up from this SKILL.md).

## Process

### 1. Pin the fixed point

Whatever the user said is the fixed point — a commit SHA, branch name, tag, `main`, `HEAD~5`, etc. If they didn't specify one, ask for it.

Capture the diff command once: `git diff <fixed-point>...HEAD` (three-dot, so the comparison is against the merge-base). Also note the list of commits via `git log <fixed-point>..HEAD --oneline`.

Before going further, confirm the fixed point resolves (`git rev-parse <fixed-point>`) and the diff is non-empty. A bad ref or empty diff should fail here — not inside two parallel sub-agents.

Record two more facts for later:

- Is the working tree clean (`git status --porcelain`)? A dirty tree disables the auto-apply tier (step 8).
- Is `HEAD` the repo's default branch? If so, get the user's OK (or a branch) before any auto-commit lands (step 8).

### 2. Identify the spec source

Look for the originating spec, in this order:

1. Issue references in the commit messages (`#123`, `Closes #45`, etc.) — fetch via the tracker doc above.
2. A path the user passed as an argument.
3. A PRD/spec file under `docs/`, `specs/`, or `.scratch/` matching the branch name or feature.
4. If nothing is found, ask the user where the spec is. If they say there isn't one, the **Spec** sub-agent will skip and report "no spec available".

### 3. Identify the standards sources

Anything in the repo that documents how code should be written, such as `CODING_STANDARDS.md` or `CONTRIBUTING.md`.

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

### 4. Spawn both sub-agents in parallel

Send a single message with two `Agent` tool calls. Use the `general-purpose` subagent for both.

**Standards sub-agent prompt** — include:

- The full diff command and commit list.
- The list of standards-source files you found in step 3, **plus the smell baseline from step 3** pasted in full — the sub-agent has no other access to it.
- The brief: "Report — per file/hunk where relevant — (a) every place the diff violates a documented standard: cite the standard (file + the rule); and (b) any baseline smell you spot: name it and quote the hunk. Distinguish hard violations from judgement calls — documented-standard breaches can be hard, but baseline smells are always judgement calls, and a documented repo standard overrides the baseline. (c) When a finding looks like an instance of a pattern rather than a one-off, and the pattern has a statable grep signature (a banned element or API, a naming rule), grep two or three places outside the diff; if the pattern predates this change, flag the finding `repo-wide`. Skip anything tooling enforces. Under 400 words."

**Spec sub-agent prompt** — include:

- The diff command and commit list.
- The path or fetched contents of the spec.
- The brief: "Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Quote the spec line for each finding. Under 400 words."

If the spec is missing, skip the Spec sub-agent and note this in the final report.

### 5. Label the findings

Normalize each report into a list of discrete findings — this is the aggregator's "light cleaning". Assign each finding an ID: `STD-1`, `STD-2`, … for Standards, `SPEC-1`, `SPEC-2`, … for Spec, numbered in report order. (Axis-prefixed IDs keep the axes separate and need no coordination between the sub-agents; IDs are per-run — a re-run renumbers.)

Each finding carries: its ID, a `file:line` location, a one-line description, the hard-violation vs judgement-call flag, the `repo-wide` flag where raised, and the cited source (the standard's rule, or the spec line). The hard flag is axis-specific: on **Standards**, only a documented-standard breach can be hard — baseline smells never are; on **Spec**, hardness is settled by the validator's classification in step 7 (`code-diverges` is hard, `spec-suspect` is a judgement call). Do **not** merge or rerank findings across axes — the two axes are deliberately separate (see _Why two axes_).

**Dedup against open review tickets.** List open `review-finding` tickets (tracker doc). Match conservatively: a standalone cleanup ticket matches at the rule/pattern level; a spec-child ticket matches only same file + same rule. Then:

- A finding whose subject **predates this diff** (visible in context, not introduced by the change) and matches an open ticket → mark **already ticketed: #N** — no proposal, no validator, not in the verdict queue.
- A finding this diff **introduces** that matches a ticketed pattern → mark **instance of open #N** and keep it in the queue — new instances of a known pattern are new debt, and fixing your own new instances doesn't reduce repo consistency.
- An uncertain match → mark **possibly duplicates #N** and keep it in the queue. A visible duplicate is recoverable; a silent suppression isn't.

### 6. Propose a fix per finding

Spawn **one proposer sub-agent per axis** (in parallel, `general-purpose`) — findings within an axis share context, and per-axis keeps agent count sane. Give each proposer its axis's labeled findings, the diff command, and this brief:

"For each finding, propose the smallest concrete fix that resolves it: what to change, where — anchor by file plus a short quoted snippet of the code being changed, not a bare line number (lines drift once fixes start landing) — and a short sketch of the changed code — a sketch, not a full patch. Also size each fix: `quick-fix` (a few edits — a candidate for the batched fix subagent) or `needs-a-session` (a fresh context window's worth of work). Keep each proposal under 100 words."

For baseline smells, the smell's generic "→ how to fix" is the starting point — the proposer's job is grounding it in the actual hunk.

### 7. Validate each proposal — adversarially, independently

Validation by the proposal's author is theater. Spawn **fresh validator sub-agents** that did not author the proposals, prompted to **refute**, one per finding, all in parallel. If there are more than 8 findings total, batch instead: one validator per axis, still fresh agents, still refutation-framed.

Each validator gets the finding, its proposal, the diff command, the commit list **with full messages** (`git log <fixed-point>..HEAD`), and both axes' inputs (the standards sources / smell baseline, and the spec), and checks:

1. **Does the fix actually resolve the finding?**
2. **Is it proportionate?** The minimal change that clears the finding — no speculative rewrites.
3. **Cross-axis check:** a fix for a Spec finding must not introduce a Standards violation, and a Standards fix must not change behaviour the spec asked for.
4. **Spec classification** (Spec findings only): label the finding **`code-diverges`** — the spec is unambiguous, the code doesn't match, the fix is mechanical — or **`spec-suspect`** — the divergence exposes an assumption baked into the spec that the code may contradict deliberately; the *spec* may be wrong. Before choosing, read the commit messages and any tests touching the diverging code: evidence of a deliberate deviation → `spec-suspect`. **Any doubt → `spec-suspect`** — a false spec-suspect costs one human glance; a false code-diverges silently rewrites behaviour.

A validator may also raise the `repo-wide` flag on a Standards finding the reviewer missed — it sees the fix in context.

Verdict per proposal: `validated`, `rejected` (with the reason), or `needs-human` (a genuine trade-off the user must call).

### 8. Auto-apply the mechanical tier

A finding is **auto-apply** when *all* of these hold; everything else waits for the user:

- hard — a documented-standard breach, or Spec `code-diverges` (baseline smells never qualify),
- `validated`,
- `quick-fix`,
- not `repo-wide` (fixing 3 of 40 instances of a pattern makes the repo *less* consistent),
- not `spec-suspect`.

Two preconditions, both recorded in step 1:

- **Clean tree.** If the working tree was dirty, the whole tier demotes to needs-your-call — one line in the report says why. Never commit around a user's uncommitted work.
- **Not the default branch** — or the user has OK'd committing there (offer a branch instead).

Spawn **one fix subagent** in the main checkout — never parallel worktrees; serial application by a single agent is what makes review fixes stop colliding. It applies the batch in order, **one commit per finding ID** (`review: STD-3 — <one-liner>`), runs the full test suite once at the end, reverts any finding-commit that breaks it, and demotes that finding to needs-your-call with the failure attached. It runs **to completion before the report is assembled** — the report cites its commit SHAs.

### 9. Report

Open with the applied list — a cross-axis convenience list, not a re-ranking:

> **Applied automatically:** STD-1 (`abc1234`), SPEC-3 (`def5678`). Reply `STD-1 revert` to undo any of them.

Then findings under `## Standards` and `## Spec` headings. Each finding is one block:

```
### STD-1 — src/foo.ts:42 (judgement call, repo-wide)
- **Finding:** <one-line description>
- **Why it matters:** <consequence, citing the standard rule or spec line>
- **Proposed fix:** <the proposal, with its sketch>
- **Validation:** validated | rejected — <reason> | needs-human — <the trade-off>
- **Size:** quick-fix | needs-a-session
- **Status:** applied in <sha> | needs your call | already ticketed: #N | instance of open #N | possibly duplicates #N
```

Spec findings put their classification in the header line (`code-diverges` / `spec-suspect`). A `spec-suspect` block additionally carries a **Draft spec comment:** — the comment that would go on the spec issue if the user agrees the spec is what's wrong. Draft only; never post it without a verdict.

End with a one-line summary — total findings per axis, how many auto-applied, and the worst issue _within each axis_, cited by ID. Don't pick a single winner across axes — that's the reranking the separation exists to prevent.

Then invite batch feedback:

> Reply with per-ID verdicts, e.g. `STD-1 revert, STD-2 ticket, SPEC-1 later, SPEC-2 explain` — **fix** (queue for the fix subagent), **ticket** (publish to the tracker as a child of the spec), **later** (standalone repo-wide cleanup ticket — doesn't gate the spec), **skip** (drop), **explain** (expand on the finding), **revert** (undo an auto-applied fix). Freeform notes per ID are fine too.

### 10. Act on the feedback

When the reply arrives, act on each verdict:

- **fix** — collect every `fix` verdict into one batch and spawn a **round-2 fix subagent** with the step 8 discipline: serial, one commit per finding ID, test suite at the end, breakers reverted and reported. It must **re-ground each proposal against current `HEAD`** — earlier fix commits have moved lines since the sketches were written; find the quoted snippet, don't trust `file:line`. If a `fix`-verdicted proposal was `rejected` or `needs-human`, don't apply it blind: surface the validator's objection and agree on a revised fix first.
- **revert** — done by you in the main session, not a subagent: `git revert` that finding's commit; if later fix commits conflict with the revert, hand-apply the inverse instead. Valid for any fix-subagent commit from any round.
- **ticket** — **cluster by file** before publishing: `ticket`-verdicted findings that touch the same file(s) become **one ticket** as long as the combined work still fits a single fresh session; past that cap, split into independent tickets with **no blocking edges** — file overlap is not a blocker, and `/ship`'s serial merge is where overlap is absorbed. Each ticket: title from the finding or cluster; body carrying the findings / why they matter / proposed fixes / validation verdicts, anchored by file + quoted snippet (no line numbers — they go stale); labels `impl` + `ready-for-agent` + `review-finding` (bootstrap first if needed). When the spec source was a tracker issue, make each ticket a **child of that spec issue** so `/ship <spec>`'s frontier query and `/next` pick them up with no extra wiring.
- **later** — publish a **standalone** ticket, *not* a child of the spec, labelled `review-finding` + `needs-triage`. Body: the repo-wide pattern statement, the diff findings quoted as evidence, the proposed fix approach, and a task item to **add the rule to the repo's coding-standards doc** so future reviews enforce it as a documented standard instead of rediscovering it. A `later` ticket is a parking lot: no frontier query reaches it, and nothing works it until the user promotes it — typically by running `/to-tickets` on it to turn the cleanup into its own spec and DAG.
- **skip** — drop it; note it as skipped in the wrap-up.
- **explain** — expand on the finding and its reasoning, then re-ask for a verdict on that ID.

After publishing, post **one summary comment on the spec issue**: what was auto-applied, which child tickets were created, which standalone `later` tickets exist. The spec's sub-issue list shouldn't be the only trace of the review.

The verdict loop runs until every queued finding has a terminal outcome — applied, ticketed, parked as `later`, skipped, or reverted. Findings whose proposals were `rejected` stay report-only by default — the finding may be real even when the fix isn't — so never auto-ticket them without the user's explicit verdict.

### 11. Offer the merge (when the spec is a tracker issue)

If the spec source was a tracker issue and the findings are clean or fixed, offer to open a PR whose body `Closes #<spec>` so the merge closes the spec issue and links the work it fulfills. Only open it if the user says yes.

**Suppress this offer while the spec issue has open children** — including any tickets step 10 just published. Merging would close a spec with known open defects; offer a plain PR (no `Closes`) instead, or wait for the children to land. Standalone `later` tickets are **not** children and do not suppress the offer — that's why they're standalone.

## Why two axes

A change can pass one axis and fail the other:

- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what the issue asked but breaks the project's conventions → **Spec pass, Standards fail.**

Reporting them separately stops one axis from masking the other — and the validation pass's cross-axis check (step 7) is where the separation pays off again: it catches a fix for one axis quietly breaking the other.
