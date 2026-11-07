---
name: tend
description: Keep the repo's defined docs — CONVENTIONS.md, TESTING.md, PRINCIPLES.md, CONTEXT.md, CONTEXT-MAP.md, ADRs — clean and on purpose, as a document gate on /finding-pipeline. `/tend --since <ref>` tends the docs a change bears on; run it that way when a workflow finishes a change, or whole-repo when the user asks to tend, sweep, or clean up those docs.
---

# Tend

Agents write the repo's defined docs a line at a time, each line for the session that wrote it, so every doc drifts two ways. It gathers sediment, which `/cold-read` cores through. And it drifts **off purpose**: entries that belong in another doc, rules nothing can check, copies of what the root doc or the tooling already says. Each defined doc's owning skill keeps a `TENDING.md` naming the off-purpose checks for its doc; this gate runs both over the docs in scope, lands what a lookup proves, and asks the rest.

## Scope

`/tend [--since <ref> | paths…]`. Run [find-tended.sh](find-tended.sh) from this skill's directory with the same arguments. Each line is a defined doc, its owning skill, that skill's `TENDING.md`, why it is in scope, and its **focus** — `whole`, or the line numbers to tend; `none` means there is nothing to tend — say so and stop.

- **`--since <ref>`** scopes to a change: the docs it edited, and the docs naming a path it touched, each focused on the lines it edited and the lines naming a path it touched. This is the form a workflow runs at the end of a change, so what a change bears on is cleaned while it is fresh, at a cost that tracks the change, not the doc.
- **Paths, or nothing**, sweeps every defined doc under them, each whole — a deliberate pass that clears what predates the per-change runs, such as the first tend of a repo.

Findings anchor on focus lines. The rest of the doc is context: read to judge a focus line, never swept for defects of its own, except as the other side of a contradiction with a focus line.

## Run the gate

Load `/finding-pipeline`: tend is a document gate on it, run as one dynamic `Workflow` (this skill is your authorization) filled from its [doc-gate.template.js](../finding-pipeline/doc-gate.template.js). Fill every slot per the contract's *Workflow authoring invariants*; what is local to this gate:

- **`GATE_NAME`** `tend`, **`ID_PREFIX`** `TD`. **`MATERIAL_SOURCE`** names the scope — `--since <ref>`, or the paths.
- **`MATERIAL`** is the scope manifest — each doc's path, owner, `TENDING.md`, why it is in scope, and focus — not the docs' text: every stage reads the docs from the checkout. **`READ_OP`**: read the file at its path; history through git.
- **`READERS`** — one per doc on the decider tier, except one per ADR directory in scope. Each brief names the doc, its focus, its `TENDING.md`, and for a doc in a subdirectory the root doc of the same name; the reader loads `/cold-read`, runs its read, resolve, and sweep on the focus lines, then every check in the `TENDING.md` that can land on them.
- **`DEFECTS`** — `/cold-read`'s *Defects* section verbatim, then each in-scope owner's `TENDING.md` checks verbatim, headed by the doc they apply to.
- **`DERIVABLE`** — a repair `/cold-read` or the doc's `TENDING.md` lands, whose proof is a lookup anyone can rerun against the tree or its history.
- **`ESCALATE_WHEN`** — any finding on a doc its owner reserves to the human (`PRINCIPLES.md`); any repair a `TENDING.md` check makes a question.
- **`SCOPE_NOTE`** — a finding anchors on a focus line of an in-scope doc; the rest of the doc, code, history, and other docs are context, except that a repair may also edit the doc a moved entry lands in, or the other side of a contradiction.
- **`REPAIR_KINDS`** — strike, re-point, correct, move.
- **`EDIT_TARGET`** and **`TRACKER_MECHANICS`** — edits land in the doc files in the working tree, one commit per finding ID (`tend: <ID> — <one-liner>`) so each is one revert away; on a tree that held uncommitted work when the gate began, edits stay uncommitted and the digest says so. Only the final stage posts a gate record — the edit agent's report is the digest. Posting follows the gate home: a comment through `/issue-tracker` on a tracker issue, an appended section on a gate file.
- **`GATE_ISSUE_REF`** — the gate home. **`PRIOR_SUMMARIES`** — its earlier `<!-- tend summary -->` records. **`ANSWER_RECORD`** — the docs themselves, and prior summaries' left-as-is verdicts.

## Gate home and questions

The **gate home** is the caller's when a workflow runs this gate — it names its own; run standalone, it is `.scratch/tend-<branch>.md`. A `<!-- tend pending-questions -->` there with no summary after it is a resume point: run the question loop from it, never the workflow again. The orientation, the question loop, AFK, the summary, and agent-answered gates on a wayfinder effort are all `/finding-pipeline`'s.

## Rules

- **`/cold-read`'s rules bind every edit.** A landed edit has a lookup behind it; rules land as they came in; reasons stay.
- **The owning skill says what belongs.** What a doc is for is its owner's to state — the skill's own description of the file and its `TENDING.md` — never this skill's.
- **Clean is cheap.** A clean focus costs its reader one read and a one-line return.
