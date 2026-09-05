---
name: diff-review
description: Review the changes since a fixed point (commit, branch, tag, or merge-base) on two axes — Standards (documented coding standards plus the Fowler smell baseline) and Spec (what the originating issue or spec asked for) — through the finding pipeline, validated fixes auto-applied or auto-ticketed and only intent questions walked past the user one per turn. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to "review since X".
---

Two-axis review of the diff between `HEAD` and a fixed point the user supplies:

- **Standards** — does the code conform to this repo's documented coding standards (plus the smell baseline below)?
- **Spec** — does the code faithfully implement the originating issue / PRD / spec?

**The policy — shared with `/ship`: escalate questions about intent, auto-resolve questions about code.** The user is the intent authority, not a code reviewer — the review must never require them to hold the code in their head. Every validated finding with an uncontested fix resolves itself: applied and committed by the serial fix agent, or published as a ticket the rest of the workflow (`/ship`, `/next`) picks up. What reaches the user is exactly the set of questions the pipeline *cannot* answer, because they are questions about what was meant — the five question classes of `/finding-pipeline`'s code gates: spec unclear, competing fixes, genuine trade-off, no working fix, pervasive pattern.

The pipeline is the contract in `/finding-pipeline` — stages, adversarial discipline, routing, the fix and ticket agents, gate markers, question mechanics, and the code-gate specifics live there once, shared with `/ship` and the document gates; when an invariant needs changing, change the contract, not this skill. It runs as **one dynamic `Workflow`** (this skill is your authorization), so the manager's context stays clean for the question loop. What's local here is pinning the diff, finding the spec and standards sources, the smell baseline, the reviewer briefs, and the merge offer. Nothing is ever edited in the review session itself outside the fix agents.

For the issue tracker, invoke `/issue-tracker`.

## Process

### 1. Pin the fixed point

Whatever the user said is the fixed point — a commit SHA, branch name, tag, `main`, `HEAD~5`, etc. If they didn't specify one, ask for it.

Capture the diff command once: `git diff <fixed-point>...HEAD` (three-dot, so the comparison is against the merge-base). Also note the list of commits via `git log <fixed-point>..HEAD --oneline`.

Before going further, confirm the fixed point resolves (`git rev-parse <fixed-point>`) and the diff is non-empty. A bad ref or empty diff should fail here — not inside the workflow.

Record three more facts for later:

- How big is the diff (`git diff <fixed-point>...HEAD --stat`)? The size decides whether step 4 partitions the reviews.
- Is the working tree clean (`git status --porcelain`)? A dirty tree demotes the auto-apply tier to tickets (the contract's fix agent re-checks).
- Is `HEAD` the repo's default branch? If so, get the user's OK (or a branch) before any auto-commit lands — the OK travels in the fix agent's brief.

### 2. Identify the spec source

Look for the originating spec, in this order:

1. Issue references in the commit messages (`#123`, `Closes #45`, etc.) — fetch via the tracker doc above.
2. A path the user passed as an argument.
3. A PRD/spec file under `docs/`, `specs/`, or `.scratch/` matching the branch name or feature.
4. If nothing is found, ask the user where the spec is. If they say there isn't one, the **Spec** reviewer stage will skip and report "no spec available".

When the spec is a tracker issue, "the spec contents" means the kernel body plus its **addressable decisions**, reassembled in index order per the tracker doc's spec-decision convention — the decision marker is also what separates spec content from this skill's own round-summary comments on the same issue. A spec with no Decision Index is just its body (the pre-index format).

### 3. Identify the standards sources

The canonical source is `CONVENTIONS.md`, per `/conventions`: the root file plus, in a monorepo, any `CONVENTIONS.md` on the ancestor path of a file the diff touches — nearest scope wins on conflict, scoped files read as deltas over root. Collect the governing set for the files this diff touches, and record which directories each scoped file binds — the Standards reviewer needs that mapping to judge each file by its own scope's rules.

Repos not using the convention still get reviewed: fall back to anything that documents how code should be written (`CODING_STANDARDS.md`, `CONTRIBUTING.md`, `STYLEGUIDE.md`, equivalents under `docs/`). Record whether this search found anything documented at all — the orientation summary (step 6) says so when it didn't.

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

**Start from [workflow.template.js](workflow.template.js) — fill it, don't author from scratch.** Read the template and fill every `FILL` slot in its data block; everything below its FIXED marker — schemas, prompt builders, stage order, the barriers — is the same every run; edit it only when this run genuinely deviates. An unfilled slot throws `FILL is not defined` at launch — loud, before any agent spawns. Filling follows the contract's *Workflow authoring invariants* — nothing through `args`, prose slots as JSON string literals. The manager fills, launches, relays progress, and does no review work itself; the reviewer briefs below and the template's prompts are the same words — keep the two in sync when either changes.

The slots — the workflow has no conversation context:

- the diff command and the commit list with full messages, plus the `WIDE` flag judged from step 1's `--stat`,
- the spec contents (or "no spec"),
- the standards sources with the directory scope each binds (the smell baseline itself is embedded in the template — step 3's text and the template's `SMELL_BASELINE` const are the same words, kept in sync),
- the dedup inputs — the open `review-finding` tickets and the spec issue's prior `<!-- diff-review summary -->` comments, fetched **before** launching (the summaries also feed the validators as the binding answer record),
- the tracker inputs — the spec issue's ref when the spec is a tracker issue, and the tracker's create/label/parent/comment operations per `/issue-tracker` (null → auto-ticket findings and the pending-questions post come back for the manager, step 7),
- the user's default-branch OK from step 1, when given.

The workflow returns the full labeled queue — every finding with its flags, verdicts, proposal, size, route, and applied SHA or ticket ref — plus the escalation queue with question classes, and that return value is all the manager sees of the pipeline.

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

### 5. What is local inside the pipeline

Labeling, dedup, adversarial validation, proposals, fix validation, routing, and the fix and ticket agents run per `/finding-pipeline`'s stages and code-gate section. Local to this skill:

- **IDs** are `STD-<i>` / `SPEC-<i>`, numbered in report order, per run — a re-run renumbers. When the reviews were partitioned, the labeling stage also dedups across group boundaries: the cross-cutting sweeper and a chunk reviewer may report the same hunk.
- **Smells** enter labelled as hypotheses ("possible Feature Envy"); for a validated smell, the baseline's "→ how to fix" is the proposer's starting point, grounded in the actual hunk.
- **Adjudication memory** is the spec issue's `<!-- diff-review summary -->` comments (step 7 posts one per round); an answered verdict there, and any spec comment it posted, is binding spec text.
- **Auto-tickets** parent to the spec issue when it is a tracker issue; with no tracker spec they publish standalone, and with no tracker mechanics at all they come back *ticket-pending* for step 7.

### 6. The gate and the question loop

When the spec is a tracker issue, the workflow's final stage posts `<!-- diff-review pending-questions -->` on it — the question blocks plus the audit digest — and the gate goes AFK per the contract: notify, end the turn, and any session resumes the loop from the comment — `/next` routes a spec carrying one to it. With no tracker issue there is nowhere durable to post: the queue lives in the workflow's return, and the loop runs now, in this session.

Open with the contract's orientation summary — with one local line when step 3 found no documented standards at any scope: the smell baseline was the only Standards source this round, and the axis sharpens as rules get written; each pervasive-pattern *adopt as rule* ticket is the mechanism. Then walk the escalations one question per turn, per the contract's question mechanics and the five question classes; the block's "what the material does today" line reads "what the code does today" here.

### 7. Act on the collected answers

Per the contract, after the loop and none of it mid-loop: post the chosen spec comments; run the post-answer fix agent for the fixes the answers unlocked; file the tickets the answers called for (*adopt as rule* tickets standalone) and any findings the workflow returned *ticket-pending*; `git revert` anything the audit overrode — done by you in the main session, and if later fix commits conflict with the revert, hand-apply the inverse instead.

Close with a wrap-up recap — one line per ID and its terminal outcome — the first and only time the whole set appears together. Then post the round's `<!-- diff-review summary -->` on the spec issue: every finding ID with its terminal outcome, refutations, reverts, and left-as-is calls included, plus the tickets created. The next round dedups against it — an outcome not recorded here will be re-found and re-asked.

### 8. Offer the merge (when the spec is a tracker issue)

If the spec source was a tracker issue and the findings are clean or resolved, offer to open a PR whose body `Closes #<spec>` so the merge closes the spec issue and links the work it fulfills. Only open it if the user says yes. If the user then asks to merge it, **squash-merge** (`gh pr merge --squash`) — the spec lands as one commit on the default branch, not its ticket-by-ticket history.

**Suppress this offer while the spec issue has open children** — including any tickets this round published, auto or answered. Merging would close a spec with known open defects; offer a plain PR (no `Closes`) instead, or wait for the children to land. Standalone *adopt as rule* tickets are **not** children and do not suppress the offer — that's why they're standalone.

## Why two axes

A change can pass one axis and fail the other:

- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what the issue asked but breaks the project's conventions → **Spec pass, Standards fail.**

Reporting them separately stops one axis from masking the other — and the contract's cross-axis fix check is where the separation pays off again: it catches a fix for one axis quietly breaking the other.
