---
name: two-axis-review
description: Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes — Standards (does the code follow this repo's documented coding standards?) and Spec (does the code match what the originating issue/PRD asked for?). Runs both reviews in parallel sub-agents, labels every finding, proposes and adversarially validates a fix for each, and reports them for per-ID batch feedback — apply fixes in-session or publish them as tracker tickets. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to "review since X".
---

Two-axis review of the diff between `HEAD` and a fixed point the user supplies:

- **Standards** — does the code conform to this repo's documented coding standards?
- **Spec** — does the code faithfully implement the originating issue / PRD / spec?

Both axes run as **parallel sub-agents** so they don't pollute each other's context. The skill then labels each finding with a per-run ID, proposes a fix per finding, adversarially validates each proposal, and presents one report the user can triage with per-ID verdicts — applying small fixes in-session and publishing session-sized ones as tickets the rest of the workflow (`/ship`, `/next`) can pick up.

For the issue tracker, read `issue-tracker.md` in this plugin's `skills/` directory (one level up from this SKILL.md).

## Process

### 1. Pin the fixed point

Whatever the user said is the fixed point — a commit SHA, branch name, tag, `main`, `HEAD~5`, etc. If they didn't specify one, ask for it.

Capture the diff command once: `git diff <fixed-point>...HEAD` (three-dot, so the comparison is against the merge-base). Also note the list of commits via `git log <fixed-point>..HEAD --oneline`.

Before going further, confirm the fixed point resolves (`git rev-parse <fixed-point>`) and the diff is non-empty. A bad ref or empty diff should fail here — not inside two parallel sub-agents.

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
- The brief: "Report — per file/hunk where relevant — (a) every place the diff violates a documented standard: cite the standard (file + the rule); and (b) any baseline smell you spot: name it and quote the hunk. Distinguish hard violations from judgement calls — documented-standard breaches can be hard, but baseline smells are always judgement calls, and a documented repo standard overrides the baseline. Skip anything tooling enforces. Under 400 words."

**Spec sub-agent prompt** — include:

- The diff command and commit list.
- The path or fetched contents of the spec.
- The brief: "Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Quote the spec line for each finding. Under 400 words."

If the spec is missing, skip the Spec sub-agent and note this in the final report.

### 5. Label the findings

Normalize each report into a list of discrete findings — this is the aggregator's "light cleaning". Assign each finding an ID: `STD-1`, `STD-2`, … for Standards, `SPEC-1`, `SPEC-2`, … for Spec, numbered in report order. (Axis-prefixed IDs keep the axes separate and need no coordination between the sub-agents; IDs are per-run — a re-run renumbers.)

Each finding carries: its ID, a `file:line` location, a one-line description, the hard-violation vs judgement-call flag, and the cited source (the standard's rule, or the spec line). Do **not** merge or rerank findings across axes — the two axes are deliberately separate (see _Why two axes_).

### 6. Propose a fix per finding

Spawn **one proposer sub-agent per axis** (in parallel, `general-purpose`) — findings within an axis share context, and per-axis keeps agent count sane. Give each proposer its axis's labeled findings, the diff command, and this brief:

"For each finding, propose the smallest concrete fix that resolves it: what to change, where (`file:line`), and a short sketch of the changed code — a sketch, not a full patch. Also size each fix: `in-session` (a few edits, doable now) or `needs-a-session` (a fresh context window's worth of work). Keep each proposal under 100 words."

For baseline smells, the smell's generic "→ how to fix" is the starting point — the proposer's job is grounding it in the actual hunk.

### 7. Validate each proposal — adversarially, independently

Validation by the proposal's author is theater. Spawn **fresh validator sub-agents** that did not author the proposals, prompted to **refute**, one per finding, all in parallel. If there are more than 8 findings total, batch instead: one validator per axis, still fresh agents, still refutation-framed.

Each validator gets the finding, its proposal, the diff command, and both axes' inputs (the standards sources / smell baseline, and the spec), and checks three things:

1. **Does the fix actually resolve the finding?**
2. **Is it proportionate?** The minimal change that clears the finding — no speculative rewrites.
3. **Cross-axis check:** a fix for a Spec finding must not introduce a Standards violation, and a Standards fix must not change behaviour the spec asked for.

Verdict per proposal: `validated`, `rejected` (with the reason), or `needs-human` (a genuine trade-off the user must call).

### 8. Report

Present findings under `## Standards` and `## Spec` headings. Each finding is one block:

```
### STD-1 — src/foo.ts:42 (judgement call)
- **Finding:** <one-line description>
- **Why it matters:** <consequence, citing the standard rule or spec line>
- **Proposed fix:** <the proposal, with its sketch>
- **Validation:** validated | rejected — <reason> | needs-human — <the trade-off>
- **Size:** in-session | needs-a-session
```

End with a one-line summary — total findings per axis and the worst issue _within each axis_, cited by ID. Don't pick a single winner across axes — that's the reranking the separation exists to prevent.

Then invite batch feedback:

> Reply with per-ID verdicts, e.g. `STD-1 fix, STD-2 ticket, SPEC-1 skip, SPEC-2 explain` — **fix** (apply now), **ticket** (publish to the tracker), **skip** (drop), **explain** (expand on the finding). Freeform notes per ID are fine too.

### 9. Act on the feedback

When the reply arrives, act on each verdict:

- **fix** — apply the proposal in-session. If its verdict was `rejected` or `needs-human`, don't apply it blind: surface the validator's objection and agree on a revised fix first.
- **ticket** — publish one ticket per finding via the tracker doc's contract (bootstrap first if needed): title from the finding, body carrying the finding / why it matters / proposed fix / validation verdict, marked `impl` + `ready-for-agent`. When the spec source was a tracker issue, make each ticket a **child of that spec issue** (the tracker doc's parent/child operation) so `/ship <spec>`'s frontier query and `/next` pick them up with no extra wiring. Default to **no blocking edges** between findings tickets — review findings are almost always independent.
- **skip** — drop it; note it as skipped in the wrap-up.
- **explain** — expand on the finding and its reasoning, then re-ask for a verdict on that ID.

Findings whose proposals were `rejected` stay report-only by default — the finding may be real even when the fix isn't — so never auto-ticket them without the user's explicit verdict.

### 10. Offer the merge (when the spec is a tracker issue)

If the spec source was a tracker issue and the findings are clean or fixed, offer to open a PR whose body `Closes #<spec>` so the merge closes the spec issue and links the work it fulfills. Only open it if the user says yes.

**Suppress this offer while the spec issue has open children** — including any tickets step 9 just published. Merging would close a spec with known open defects; offer a plain PR (no `Closes`) instead, or wait for the children to land.

## Why two axes

A change can pass one axis and fail the other:

- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what the issue asked but breaks the project's conventions → **Spec pass, Standards fail.**

Reporting them separately stops one axis from masking the other — and the validation pass's cross-axis check (step 7) is where the separation pays off again: it catches a fix for one axis quietly breaking the other.
