---
name: diff-review
description: Review the changes since a fixed point (commit, branch, tag, or merge-base) on two axes — Standards (documented coding standards plus the Fowler smell baseline) and Spec (what the originating issue or spec asked for) — through the finding pipeline, validated fixes auto-applied or auto-ticketed and only intent questions walked past the user one per turn. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to "review since X".
---

Two-axis review of the diff between `HEAD` and a fixed point the user supplies:

- **Standards** — does the code conform to this repo's documented coding standards (plus the smell baseline)?
- **Spec** — does the code faithfully implement the originating issue or spec?

The policy and the pipeline are `/finding-pipeline`'s — escalate intent, auto-resolve code; stages, adversarial discipline, routing, the fix and ticket agents, gate markers, question mechanics, and the code-gate specifics all live there. It runs as **one dynamic `Workflow`** (this skill is your authorization), so the manager's context stays clean for the question loop. What's local here is pinning the diff, finding the spec and standards sources, the smell baseline, the reviewers, and the merge offer. During the pipeline, only the fix agents edit code.

For the issue tracker, invoke `/issue-tracker`.

## Process

### 1. Pin the fixed point

Whatever the user said is the fixed point — a commit SHA, branch name, tag, `main`, `HEAD~5`, etc. If they didn't specify one, ask for it.

Before going further, confirm the fixed point resolves and the diff against its merge-base (three-dot) is non-empty — a bad ref or empty diff fails here, not inside the workflow. Capture that diff command, the commit list since the fixed point with full messages, and the diff's stat, which decides whether the reviews partition.

If `HEAD` is the repo's default branch, get the user's OK (or a branch) before any auto-commit lands — the OK travels in the fix agent's brief.

### 2. Identify the spec source

Look for the originating spec, in this order:

1. Issue references in the commit messages (`#123`, `Closes #45`, etc.) — fetch via the tracker doc above.
2. A path the user passed as an argument.
3. A spec file under `docs/`, `specs/`, or `.scratch/` matching the branch name or feature.
4. If nothing is found, ask the user where the spec is. If they say there isn't one, the Spec axis skips and reports "no spec available".

Then locate the **gate home** (step 6). If it holds a `<!-- diff-review pending-questions -->` with no summary after it, this is a resume: go straight to step 6's loop from that material — never re-run the pipeline.

When the spec is a tracker issue, "the spec contents" means the kernel body plus its **addressable decisions**, reassembled in index order per the tracker doc's spec-decision convention — the decision marker is also what separates spec content from this skill's own round-summary comments on the same issue. A spec with no Decision Index is just its body.

### 3. Identify the standards sources

The canonical source is `CONVENTIONS.md`, per `/conventions`: the root file plus, in a monorepo, any `CONVENTIONS.md` on the ancestor path of a file the diff touches — nearest scope wins on conflict, scoped files read as deltas over root. Collect the governing set for the files this diff touches, and record which directories each scoped file binds, so each file is judged by its own scope's rules.

Repos not using the convention still get reviewed: fall back to anything that documents how code should be written (`CODING_STANDARDS.md`, `CONTRIBUTING.md`, `STYLEGUIDE.md`, equivalents under `docs/`). Record whether this search found anything documented at all — the orientation summary (step 6) says so when it didn't.

On top of whatever the repo documents, the Standards axis always carries the **smell baseline** — twelve Fowler code smells (_Refactoring_, ch.3), each with its fix, listed in the template's `SMELL_BASELINE`; it applies even when a repo documents nothing. A documented repo standard always overrides it, and anything tooling enforces is skipped. Each smell enters the pipeline as a labelled hypothesis ("possible Feature Envy") that must survive adversarial validation, and past validation routes exactly like a documented-rule breach.

### 4. Fill and launch the pipeline workflow

**Start from [workflow.template.js](workflow.template.js) — fill it, don't author from scratch.** Fill every `FILL` slot in its data block, per the comment beside each and the contract's *Workflow authoring invariants*; everything below its FIXED marker is the same every run — edit it only when this run genuinely deviates. The manager fills, launches, relays progress, and does no review work itself.

**Fill `SPEC_SCOPE` whenever the diff is partial** (a work-in-progress branch, one ticket of a DAG, half a migration) — unbounded, the Spec reviewer reports every requirement not yet due as missing. Fetch the dedup inputs — the open `review-finding` tickets and the gate home's prior `<!-- diff-review summary -->` records — **before** launching. Resolve the three model slots per `/model-policy` and say which models the tiers resolved to in one line before launching.

The workflow returns the full labeled queue — every finding with its flags, verdicts, proposal, size, route, and applied SHA or ticket ref — plus the escalation queue with question classes; that return value is all the manager sees of the pipeline.

**Reviewers.** One reviewer per axis, since a single reader sees every cross-file pattern. The Standards reviewer reports documented-rule breaches and baseline smells, flagging `repo-wide` patterns with grep evidence; the Spec reviewer reports missing or partial requirements, scope creep, and wrong implementations, bounded by `SPEC_SCOPE`. Past what one reviewer can hold (soft heuristic: ~15 files or ~1,500 changed lines — the `WIDE` slot), the template partitions the diff into subsystem groups both axes share, adds a cross-cutting sweeper for the smells that span groups, and checks spec requirements no slice claimed. The words are the template's.

### 5. What is local inside the pipeline

Labeling, dedup, adversarial validation, proposals, fix validation, routing, and the fix and ticket agents run per `/finding-pipeline`'s stages and code-gate section. Local to this skill:

- **IDs** are `STD-<i>` / `SPEC-<i>`, numbered in report order, per run — a re-run renumbers. When the reviews were partitioned, the labeling stage also dedups across group boundaries.
- **Smells** enter labelled as hypotheses; for a validated smell, the baseline's fix is the proposer's starting point, grounded in the actual hunk.
- **Prior summaries** are the gate home's `<!-- diff-review summary -->` records (step 7 posts one per round); an answered verdict there, and any spec comment it posted, is binding spec text.
- **Auto-tickets** parent to the spec issue when it is a tracker issue; with no tracker spec they publish standalone, and with no tracker mechanics at all they come back *ticket-pending* for step 7.

### 6. The gate and the question loop

The **gate home** is where this review's gate state lives. When the spec is a tracker issue, it is that issue. Otherwise it is a **gate file**: the path the caller named; else, for a spec file, `<spec file's stem>.review.md` beside it; else, with no spec, `.scratch/diff-review-<branch>.md`. A gate file holds the same records a spec issue would, as sections appended in order — the latest pending-questions with no summary after it is the resume point.

The workflow's final stage posts `<!-- diff-review pending-questions -->` to the gate home — the question blocks plus the audit digest — and the gate goes AFK per the contract.

Open with the contract's orientation summary — with one local line when step 3 found no documented standards at any scope: the smell baseline was the only Standards source this round, and each pervasive-pattern *adopt as rule* ticket is how the axis sharpens. Then walk the escalations one finding per turn as a position, per the contract's question mechanics and the five question classes.

### 7. Act on the collected answers

Per the contract, after the loop and none of it mid-loop: post the chosen spec comments — on the spec issue, or, for a spec file, as amendments where the caller named (else appended to the spec file under `## Review answers`); run the post-answer fix agent for the fixes the answers unlocked; file the tickets the answers called for (*adopt as rule* tickets standalone) and any findings the workflow returned *ticket-pending*; undo anything the audit overrode, yourself in the main session.

Close with a wrap-up recap — one line per ID and its terminal outcome — the first and only time the whole set appears together. Then post the round's `<!-- diff-review summary -->` to the gate home per the contract, plus the tickets created.

### 8. Offer the merge (when the spec is a tracker issue)

If the spec source was a tracker issue and the findings are clean or resolved, offer to open a PR whose body `Closes #<spec>`. Only open it if the user says yes. If the user then asks to merge it, **squash-merge** — the spec lands as one commit on the default branch, not its ticket-by-ticket history.

**Suppress this offer while the spec issue has open children** — including any tickets this round published, auto or answered — since merging would close a spec with known open defects; offer a plain PR (no `Closes`) instead, or wait for the children to land. Standalone *adopt as rule* tickets are **not** children and do not suppress the offer.
