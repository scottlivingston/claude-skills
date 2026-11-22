---
name: issue-tracker
description: The issue-tracker contract every workflow skill speaks — vocabulary, ticket/structure/workflow operations — with GitHub and local-markdown implementations and a per-repo override. Consult before creating, reading, labeling, linking, or querying tickets on the tracker.
---

# Issue tracker

Shared tracker wiring for every workflow skill in this plugin. Skills speak in the **contract** below — its vocabulary and operations; how each operation is performed depends on which implementation is in effect.

## Which tracker?

Resolve once per session, in this order:

1. **Repo override**: if `.claude/issue-tracker.md` exists in the repo, follow it. An override may implement the whole contract or just a delta — where it speaks, it wins; anything it doesn't cover falls through to the resolution below. A delta can be a few lines, e.g. "As the GitHub implementation, except: claim by assigning yourself instead of the `in-progress` label."
2. **GitHub** (default): the repo has a GitHub remote (infer from `git remote -v`; `gh` does this automatically inside a clone) and `gh` is available → the GitHub implementation below.
3. **Local markdown** (fallback): no GitHub remote, or no `gh` → the local implementation below.

**A `/wayfinder` effort is the exception**: its tickets always live in `sc`, whatever the repo's tracker — see *Wayfinder efforts* below.

## The contract

What every implementation must define. A repo override implements (or overrides pieces of) exactly this.

### Vocabulary

Skills use these role names verbatim; an implementation maps each to a concrete marker — a label, a status field, an assignee, whatever the tracker has.

Triage roles: `needs-triage` (maintainer must evaluate), `needs-info` (waiting on reporter), `ready-for-agent` (fully specified, ready for an AFK agent), `ready-for-human` (requires human implementation), `wontfix` (will not be actioned).

Workflow roles:

- `in-progress` — a session is actively working the ticket. Applying it is the **claim** (always the session's first write, before any work); removing it unclaims. An open ticket without it is up for grabs.
- `spec` — a spec issue: what a change should deliver, which `/diff-review` reviews it against.
- `impl` — a child ticket of a spec or a `/wayfinder` plan: a plan's piece, or a review-finding fix under a spec.
- `review-finding` — a ticket published from a review-gate finding (per `/finding-pipeline`): carried by spec-child fix tickets (alongside `impl`) and by standalone repo-wide cleanup tickets.
- `effort-seed` — an idea parked for a future `/iterate` effort, published by `/seed`; closed when an effort kicks off from it.
- `hitl` / `afk` — a wayfinder risk's or task's mode: waiting on the human (escalated, or a task only they can do), or agent-worked. Each carries exactly one.
- `friction` — a decision carrying friction notes (per `/deciding`) not yet acted on; cleared when its reconsideration opens.
- `wayfinder:plan`, `wayfinder:risk`, `wayfinder:task`, `wayfinder:decision` — a `/wayfinder` plan, a risk a spike answers, a task only the human can do, and a decision several of its pieces build on. Risks, tasks, and decisions are **linked** to their plan, never its children, so they stay off the plan's frontier.
- `wayfinder:defect`, `wayfinder:parked` — a piece filed from a failed verification, and a piece its build stopped on, with the reason in a comment.

### Ticket operations

- **Create** a ticket (title, body, vocabulary markers). "Publish to the issue tracker" means this.
- **Read** a ticket: full body plus comments. "Fetch the relevant ticket" means this.
- **List** tickets filtered by state and vocabulary markers.
- **Comment** on a ticket.
- **Mark / unmark**: apply or remove a vocabulary marker.
- **Close** a ticket, optionally with a closing comment.
- **Bootstrap**: idempotently ensure the vocabulary markers exist — run before the first marked create or mark in a repo, if the tracker requires markers to pre-exist.

### Structure operations

- **Parent/child**: link a ticket as a child of a parent — implementation tickets under their spec, which includes a wayfinder plan's pieces.
- **Blocking**: record that a ticket is blocked by another; a ticket is **unblocked** when every blocker is closed. Use the tracker's native dependency relationship (it shows the frontier in the tracker's UI), falling back to a body convention only where none exists. Edges may be added between closed tickets too — a decision's rests-on edges (per `/deciding`) are blocking edges added at resolution.
- **Dependents**: list the tickets a ticket blocks, open or closed — what would need re-checking if it changed.

### Spec decisions

A spec's implementation decisions are **addressable units**, `D1`…`Dn`, listed one line each in the spec body's Decision Index. Two operations:

- **Publish decision**: attach one decision (ID, title, body) to a spec, in index order.
- **Read**: reading a spec "in full" means the body plus every decision, in index order; a single decision is fetchable by ID. Decisions are **spec content**, distinct from process comments (wave summaries, review round summaries, spec-gap notes) — an implementation must keep the two tellable apart. A spec with no Decision Index is just its body.

### Workflow operations

- **Claim / unclaim**: apply / remove `in-progress`. **Claim check**: query which of a set of tickets are claimed.
- **Frontier query**: a parent's open **ticket** children, minus any with an open blocker, minus any claimed; first in parent order wins.
- **Plan link**: a risk, task, or decision carries a `Plan: <ref>` line at the top of its body; listing a plan's risks, tasks, or decisions is a query for that line plus the label.

## GitHub implementation (default)

Every vocabulary role is a GitHub **label** with the same string, on the current repo's issues; ticket operations, marking, and claiming are ordinary `gh issue` work.

### Bootstrap

Labeling with a label the repo lacks fails, on create and edit alike, so before the first labeled create **or** edit in a repo, ensure the set exists (idempotent — `--force` updates in place):

```sh
gh label create in-progress        --force -c "#fbca04" -d "A session is actively working this ticket"
gh label create spec               --force -c "#0e8a16" -d "Spec issue: what a change should deliver"
gh label create impl               --force -c "#1d76db" -d "Child ticket: a wayfinder piece or a review-finding fix"
gh label create review-finding     --force -c "#e99695" -d "Ticket published from a review-gate finding"
gh label create effort-seed        --force -c "#c2e0c6" -d "Idea parked for a future /iterate effort (/seed)"
gh label create hitl               --force -c "#d93f0b" -d "Waiting on the human"
gh label create afk                --force -c "#5319e7" -d "Agent can drive this alone"
gh label create friction           --force -c "#fbca04" -d "Decision strained by later work; reconsideration pending"
gh label create needs-triage       --force -c "#ededed" -d "Maintainer must evaluate"
gh label create needs-info         --force -c "#ededed" -d "Waiting on reporter"
gh label create ready-for-agent    --force -c "#bfd4f2" -d "Fully specified, ready for an AFK agent"
gh label create ready-for-human    --force -c "#f9d0c4" -d "Requires human implementation"
```

(`wontfix` ships with GitHub's defaults.)

### Structure operations

- **Parent/child**: GitHub **sub-issues** — `gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (`<child-db-id>` is the numeric database id: `gh api repos/<owner>/<repo>/issues/<n> --jq .id`). Where sub-issues aren't enabled, add the child to a task list in the parent body and put `Part of #<parent>` at the top of the child body.
- **Dependents**: `gh api repos/<owner>/<repo>/issues/<n>/dependencies/blocking` (or, on the fallback, issues whose `Blocked by` line names `#<n>`).
- **Blocking**: GitHub's **native issue dependencies**. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only — the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body.

### Spec decisions

One **issue comment per decision** on the spec issue, posted in index order immediately after the issue is created. Each opens with the marker line `<!-- spec-decision D<n> -->`, then the decision's `### D<n>: <title>` heading and body. The marker is the separator between spec content and process comments — a comment without it is never spec content, and no process comment (wave summary, review round summary, spec-gap note) ever carries it. Read a spec in full as the body plus the marked comments in ID order. One comment per decision also keeps each piece far below GitHub's 65,536-character cap on a single body or comment.

### Workflow operations

- **Frontier query**: the parent's open sub-issues (or task-list children); an open blocker shows as `issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line.

## Local markdown implementation (fallback)

Issues and specs live as markdown files in `.scratch/`. Vocabulary roles map to lines in each file: triage and claim state on a `Status:` line, mode on a `Mode:` line, and any role the path doesn't already encode (`review-finding`, …) on a `Labels:` line. Path encodes the rest: `spec.md` is the spec; files under `issues/` are its children, and being there is what makes a ticket `impl`. Standalone tickets — e.g. `/diff-review`'s adopt-as-rule cleanups — live outside every feature directory at `.scratch/review-findings/<NN>-<slug>.md`, with `Labels: review-finding` and `Status: needs-triage`. Seeds live in the main checkout at `.scratch/seeds/<slug>.md`, with `Labels: effort-seed` and `Status: open`.

### Ticket operations

- One feature per directory: `.scratch/<feature-slug>/`; the spec is `.scratch/<feature-slug>/spec.md`.
- **Create**: a new file under `.scratch/<feature-slug>/`. Implementation tickets are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined tickets file.
- **Read / List**: read the file; list by globbing the directory and filtering on the `Status:` and `Labels:` lines.
- **Mark / unmark**: edit the `Status:` line (triage roles, `in-progress`) or the `Labels:` line (everything else).
- **Close**: set `Status: closed`, optionally appending a closing comment under `## Comments`.
- **Comment**: append under a `## Comments` heading.
- **Bootstrap**: nothing to do — markers are just lines in files.

### Structure operations

- **Parent/child**: the directory is the parent — a spec's children live in its `issues/` subdirectory.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `closed`. **Dependents** are the files whose `Blocked by` line names it.
- **Spec decisions**: inline in `spec.md` — a `## Decisions` section after the kernel, one `### D<n>: <title>` heading per decision in index order. No size cap locally; the headings alone provide the addressability.

### Workflow operations

- **Claim**: set `Status: in-progress` and save before any work; unclaim by reverting it. **Claim check**: read the `Status:` lines.
- **Frontier query**: scan the spec's `issues/` directory for files that are open, unblocked, and unclaimed; first by number wins.

## Wayfinder efforts

A `/wayfinder` effort keeps its tickets in Sous Chef, the `sc` command — never GitHub, never `.scratch/`. Every operation of the contract is an `sc issue` command (`sc issue --help` lists them, and every read takes `--json`): `create|view|list|edit|comment|label|close` for tickets and marking, `--parent <plan>` for parent/child, `block` and `unblock` for blocking edges, and the `blocks` field of `sc issue view <n> --json` for dependents. Vocabulary roles are labels with the same string, with one exception: the claim is the issue's assignee (`sc issue assign`, `sc issue unassign`), never an `in-progress` label. The frontier is the pieces `sc issue list --parent <plan> --state ready` lists. There is nothing to bootstrap.

The **plan** is the issue labelled `wayfinder:plan`; its pieces are `impl` issues whose parent is the plan. Risks, tasks, and decisions are ordinary issues with the plan link line, never children. `/wayfinder` owns the bodies and comment markers.
