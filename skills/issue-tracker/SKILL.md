---
name: issue-tracker
description: The issue-tracker contract every workflow skill speaks — vocabulary, ticket/structure/workflow operations — with GitHub and local-markdown implementations and a per-repo override. Consult before creating, reading, labeling, linking, or querying tickets on the tracker.
---

# Issue tracker

Shared tracker wiring for the wayfinder → drain → slice → map-review → specify → spec-review → tickets → ship (or implement) → review workflow. Skills speak in the **contract** below — its vocabulary and operations; how each operation is performed depends on which implementation is in effect.

## Which tracker?

Resolve once per session, in this order:

1. **Repo override**: if `.claude/issue-tracker.md` exists in the repo, follow it. An override may implement the whole contract or just a delta — where it speaks, it wins; anything it doesn't cover falls through to the resolution below. A delta can be a few lines, e.g. "As the GitHub implementation, except: claim by assigning yourself instead of the `in-progress` label."
2. **GitHub** (default): the repo has a GitHub remote (infer from `git remote -v`; `gh` does this automatically inside a clone) and `gh` is available → the GitHub implementation below.
3. **Local markdown** (fallback): no GitHub remote, or no `gh` → the local implementation below.

## The contract

What every implementation must define. A repo override implements (or overrides pieces of) exactly this.

### Vocabulary

Skills use these role names verbatim; an implementation maps each to a concrete marker — a label, a status field, an assignee, whatever the tracker has.

Triage roles: `needs-triage` (maintainer must evaluate), `needs-info` (waiting on reporter), `ready-for-agent` (fully specified, ready for an AFK agent), `ready-for-human` (requires human implementation), `wontfix` (will not be actioned).

Workflow roles:

- `in-progress` — a session is actively working the ticket. Applying it is the **claim** (always the session's first write, before any work); removing it unclaims. An open ticket without it is up for grabs.
- `map-reviewed` — applied to a map by `/map-review` when its resolutions survive the whole-map cross-read. `/next` routes a completed map without it to `/map-review`, with it to `/specify`. Reopening any child ticket removes it.
- `slice-reviewed` — the same marker one altitude down: applied to a **sealed slice** by `/map-review` when that slice's decisions survive their cross-read. `/next` routes a sealed slice without it to `/map-review`, with it to `/specify`. Reopening the slice removes it.
- `spec` — a spec issue published by `/specify`.
- `spec-reviewed` — applied to a spec by `/spec-review` when it survives the full read and the codebase grounding. `/next` routes a spec without it to `/spec-review`, with it to `/tickets`.
- `impl` — an implementation ticket published by `/tickets` (a child of its spec).
- `review-finding` — a ticket published from a `/diff-review` finding: carried by spec-child fix tickets (alongside `impl`) and by standalone repo-wide cleanup tickets.
- `hitl` / `afk` — a wayfinder ticket's mode: worked live with the human, or agent-alone. Every wayfinder child carries exactly one.
- `wayfinder:map`, `wayfinder:slice`, and `wayfinder:<type>` (`research`/`prototype`/`grilling`/`design`/`task`) — wayfinder's map, its delivery slices, and its ticket types. A map's children are its tickets *and* its slices; only the type-labelled ones are tickets.

### Ticket operations

- **Create** a ticket (title, body, vocabulary markers). "Publish to the issue tracker" means this.
- **Read** a ticket: full body plus comments. "Fetch the relevant ticket" means this.
- **List** tickets filtered by state and vocabulary markers.
- **Comment** on a ticket.
- **Mark / unmark**: apply or remove a vocabulary marker.
- **Close** a ticket, optionally with a closing comment.
- **Bootstrap**: idempotently ensure the vocabulary markers exist — run before the first marked create or mark in a repo, if the tracker requires markers to pre-exist.

### Structure operations

- **Parent/child**: link a ticket as a child of a parent — implementation tickets under their spec, wayfinder tickets and slices under their map.
- **Blocking**: record that a ticket is blocked by another; a ticket is **unblocked** when every blocker is closed. Prefer the tracker's native dependency relationship — it renders the frontier visually in the tracker's own UI — and fall back to a body convention only where none exists.

### Spec decisions

A spec's implementation decisions are **addressable units**, `D1`…`Dn`, listed one line each in the spec body's Decision Index (see `/specify`). Two operations:

- **Publish decision**: attach one decision (ID, title, body) to a spec, in index order.
- **Read**: reading a spec "in full" means the body plus every decision, in index order; a single decision is fetchable by ID. Decisions are **spec content**, distinct from process comments (wave summaries, review round summaries, spec-gap notes) — an implementation must keep the two tellable apart. A spec with no Decision Index is just its body (the pre-index format).

### Workflow operations

- **Claim / unclaim**: apply / remove `in-progress`. **Claim check**: query which of a set of tickets are claimed — a verifiable checkpoint (e.g. `/ship` refuses to spawn agents until every frontier ticket passes it).
- **Frontier query**: a parent's open **ticket** children, minus any with an open blocker, minus any claimed; first in parent order wins. On a map, ticket children are the `wayfinder:<type>`-labelled ones — slices are children too and are never on the frontier.
- **Resolve** (wayfinding): comment the answer on the ticket, close it, remove the claim, then append a context pointer (gist + link) to the map's Decisions-so-far.

## GitHub implementation (default)

Every vocabulary role is a GitHub **label** with the same string, on the current repo's issues.

### Ticket operations

- **Create**: `gh issue create --title "..." --body "..."` (heredoc for multi-line bodies), `--label` for markers.
- **Read**: `gh issue view <number> --comments`.
- **List**: `gh issue list --state open --json number,title,body,labels,comments` with appropriate `--label` and `--state` filters.
- **Comment**: `gh issue comment <number> --body "..."`
- **Mark / unmark**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

### Bootstrap

`gh issue create --label X` and `gh issue edit --add-label X` both fail if the label doesn't exist in the repo, so before the first labeled create **or** edit in a repo, ensure the set exists (idempotent — `--force` updates in place):

```sh
gh label create in-progress        --force -c "#fbca04" -d "A session is actively working this ticket"
gh label create map-reviewed       --force -c "#0e8a16" -d "Map resolutions cross-read and coherent (/map-review)"
gh label create spec               --force -c "#0e8a16" -d "Spec issue (published by /specify)"
gh label create spec-reviewed      --force -c "#0e8a16" -d "Spec read whole and grounded against the code (/spec-review)"
gh label create impl               --force -c "#1d76db" -d "Implementation ticket (published by /tickets)"
gh label create review-finding     --force -c "#e99695" -d "Ticket published from a review finding (/diff-review)"
gh label create hitl               --force -c "#d93f0b" -d "Needs the human in the loop"
gh label create afk                --force -c "#5319e7" -d "Agent can drive this alone"
gh label create slice-reviewed     --force -c "#0e8a16" -d "Sealed slice cross-read and coherent (/map-review)"
gh label create wayfinder:map      --force -c "#006b75" -d "Wayfinder map"
gh label create wayfinder:slice    --force -c "#006b75" -d "Wayfinder delivery slice (one spec's worth of decisions)"
gh label create wayfinder:research --force -c "#c5def5" -d "Wayfinder ticket: research"
gh label create wayfinder:prototype --force -c "#c5def5" -d "Wayfinder ticket: prototype"
gh label create wayfinder:grilling --force -c "#c5def5" -d "Wayfinder ticket: grilling"
gh label create wayfinder:design   --force -c "#c5def5" -d "Wayfinder ticket: design"
gh label create wayfinder:task     --force -c "#c5def5" -d "Wayfinder ticket: task"
gh label create needs-triage       --force -c "#ededed" -d "Maintainer must evaluate"
gh label create needs-info         --force -c "#ededed" -d "Waiting on reporter"
gh label create ready-for-agent    --force -c "#bfd4f2" -d "Fully specified, ready for an AFK agent"
gh label create ready-for-human    --force -c "#f9d0c4" -d "Requires human implementation"
```

(`wontfix` ships with GitHub's defaults.)

### Structure operations

- **Parent/child**: GitHub **sub-issues** — `gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (`<child-db-id>` is the numeric database id: `gh api repos/<owner>/<repo>/issues/<n> --jq .id`). Where sub-issues aren't enabled, add the child to a task list in the parent body and put `Part of #<parent>` at the top of the child body.
- **Blocking**: GitHub's **native issue dependencies**. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only — the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body.

### Spec decisions

One **issue comment per decision** on the spec issue, posted in index order immediately after the issue is created. Each opens with the marker line `<!-- spec-decision D<n> -->`, then the decision's `### D<n>: <title>` heading and body. The marker is the separator between spec content and process comments — a comment without it is never spec content, and no process comment (wave summary, review round summary, spec-gap note) ever carries it. Read a spec in full with `gh issue view <n> --comments`, taking the body plus the marked comments in ID order. The convention is also what keeps a spec clear of GitHub's 65,536-character cap on any single body or comment: the kernel and each decision sit far below the cap individually, so nothing is ever trimmed to fit.

### Workflow operations

- **Claim** / **unclaim**: `gh issue edit <n> --add-label in-progress` / `--remove-label in-progress`. **Claim check**: `gh issue list --label in-progress`.
- **Frontier query**: list the parent's open children (`gh issue list --state open`, scoped to the parent's sub-issues / task list); on a map, keep only the `wayfinder:<type>`-labelled ones, so slices never appear. Drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or the `in-progress` label; first in parent order wins.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>` and remove the `in-progress` label, then append a context pointer (gist + link) to the map's Decisions-so-far.

### Wayfinding specifics

The **map** is a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Slices / Map-wide / Fog body. Each **child ticket** is a sub-issue of the map, labelled `wayfinder:<type>` plus its mode, `hitl` or `afk`.

Each **slice** is also a sub-issue of the map, labelled `wayfinder:slice` and carrying no type or mode label — that absence is what keeps it off the frontier. Ship order between slices uses the same native dependency edges as ticket blocking. A slice is **sealed** by closing it (`gh issue close`), and `slice-reviewed` is applied after it closes; a breach reopens it (`gh issue reopen`), which removes the marker.

## Local markdown implementation (fallback)

Issues and specs live as markdown files in `.scratch/`. Vocabulary roles map to lines in each file: triage and claim state on a `Status:` line, wayfinder type on a `Type:` line, mode on a `Mode:` line, and any role the path doesn't already encode (`impl`, `review-finding`, …) on a `Labels:` line. Path encodes the rest: `spec.md` is the spec; files under `issues/` are its children. Standalone tickets — e.g. `/diff-review`'s adopt-as-rule cleanups — live outside every feature directory at `.scratch/review-findings/<NN>-<slug>.md`, with `Labels: review-finding` and `Status: needs-triage`.

### Ticket operations

- One feature per directory: `.scratch/<feature-slug>/`; the spec is `.scratch/<feature-slug>/spec.md`.
- **Create**: a new file under `.scratch/<feature-slug>/`. Implementation tickets are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined tickets file.
- **Mark / unmark**: edit the `Status:` line (triage roles, `in-progress`) or the `Labels:` line (everything else).
- **Close**: set `Status: closed`, optionally appending a closing comment under `## Comments`.
- **Comment**: append under a `## Comments` heading.
- **Bootstrap**: nothing to do — markers are just lines in files.

### Structure operations

- **Parent/child**: the directory is the parent — a spec's children live in its `issues/` subdirectory, a map's tickets in `map/`, a map's slices in `slices/`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `closed`.
- **Spec decisions**: inline in `spec.md` — a `## Decisions` section after the kernel, one `### D<n>: <title>` heading per decision in index order. No size cap locally; the headings alone provide the addressability.

### Workflow operations

- **Claim**: set `Status: in-progress` and save before any work; unclaim by reverting it. **Claim check**: read the `Status:` lines.
- **Frontier query**: scan the parent's ticket directory — `map/` for a map, `issues/` for a spec — for files that are open, unblocked, and unclaimed; first by number wins. `slices/` is never scanned, which is what keeps slices off the frontier.
- **Resolve**: append the answer under an `## Answer` heading, then Close (`Status: closed`), then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

### Wayfinding specifics

The **map** is `.scratch/<effort>/map.md` — the Notes / Decisions-so-far / Slices / Map-wide / Fog body. Each **child ticket** is `.scratch/<effort>/map/NN-<slug>.md` — its own directory, so wayfinder tickets never mix with the spec's `issues/` — with the question in the body, a `Type:` line (`research`/`prototype`/`grilling`/`design`/`task`), a `Mode:` line (`hitl`/`afk`), and a `Status:` line.

Each **slice** is `.scratch/<effort>/slices/NN-<slug>.md`, numbered in ship order, with the Ships / Decisions body, `Labels: wayfinder:slice`, a `Blocked by: NN, NN` line naming the slices it ships after, and a `Status:` line. Sealing sets `Status: closed`; `slice-reviewed` goes on the `Labels:` line. A slice's spec is `.scratch/<effort>/<slice-slug>/spec.md` — one feature directory per slice, so each slice's tickets stay separate.
