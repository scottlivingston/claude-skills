# Issue tracker

Shared tracker wiring for the wayfinder → drain → to-spec → to-tickets → ship (or implement) → two-axis-review workflow. Default: **GitHub issues** on the current repo (infer from `git remote -v`; `gh` does this automatically inside a clone). If the repo has no GitHub remote or `gh` is unavailable, fall back to **local markdown** below. A repo-level tracker doc (e.g. `docs/agents/issue-tracker.md`) overrides this file.

## GitHub conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments` with appropriate `--label` and `--state` filters.
- **Comment**: `gh issue comment <number> --body "..."`
- **Labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`
- **Sub-issue**: link a child to its parent via the sub-issues endpoint — `gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (`<child-db-id>` is the numeric database id: `gh api repos/<owner>/<repo>/issues/<n> --jq .id`). Used for wayfinder map children and for implementation tickets under a spec issue.
- "Publish to the issue tracker" = create a GitHub issue. "Fetch the relevant ticket" = `gh issue view <number> --comments`.

## Triage labels

Skills speak in five canonical triage roles; the label strings here are used verbatim:

`needs-triage` (maintainer must evaluate), `needs-info` (waiting on reporter), `ready-for-agent` (fully specified, ready for an AFK agent), `ready-for-human` (requires human implementation), `wontfix` (will not be actioned).

## Workflow labels

Beyond triage, the workflow uses these label strings verbatim:

- `in-progress` — a session is actively working the ticket. Adding it is the **claim** (always the first write, before any work); removing it unclaims. An open ticket without `in-progress` is up for grabs.
- `spec` — a spec issue published by `/to-spec`.
- `impl` — an implementation ticket published by `/to-tickets` (a sub-issue of its spec).
- `hitl` / `afk` — a wayfinder ticket's mode: worked live with the human, or agent-alone. Every wayfinder child carries exactly one.
- `wayfinder:map` and `wayfinder:<type>` — see Wayfinding operations below.

### Label bootstrap

`gh issue create --label X` fails if the label doesn't exist in the repo, so before the first labeled create in a repo, ensure the set exists (idempotent — `--force` updates in place):

```sh
gh label create in-progress        --force -c "#fbca04" -d "A session is actively working this ticket"
gh label create spec               --force -c "#0e8a16" -d "Spec issue (published by /to-spec)"
gh label create impl               --force -c "#1d76db" -d "Implementation ticket (published by /to-tickets)"
gh label create hitl               --force -c "#d93f0b" -d "Needs the human in the loop"
gh label create afk                --force -c "#5319e7" -d "Agent can drive this alone"
gh label create wayfinder:map      --force -c "#006b75" -d "Wayfinder map"
gh label create wayfinder:research --force -c "#c5def5" -d "Wayfinder ticket: research"
gh label create wayfinder:prototype --force -c "#c5def5" -d "Wayfinder ticket: prototype"
gh label create wayfinder:grilling --force -c "#c5def5" -d "Wayfinder ticket: grilling"
gh label create wayfinder:task     --force -c "#c5def5" -d "Wayfinder ticket: task"
gh label create needs-triage       --force -c "#ededed" -d "Maintainer must evaluate"
gh label create needs-info         --force -c "#ededed" -d "Waiting on reporter"
gh label create ready-for-agent    --force -c "#bfd4f2" -d "Fully specified, ready for an AFK agent"
gh label create ready-for-human    --force -c "#f9d0c4" -d "Requires human implementation"
```

(`wontfix` ships with GitHub's defaults.)

## Wayfinding operations (GitHub)

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`) plus its mode, `hitl` or `afk`.
- **Blocking**: GitHub's **native issue dependencies** — the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only — the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or the `in-progress` label; first in map order wins.
- **Claim**: `gh issue edit <n> --add-label in-progress` — the session's first write. Unclaim: `--remove-label in-progress`.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>` and remove the `in-progress` label, then append a context pointer (gist + link) to the map's Decisions-so-far.

## Local markdown (fallback)

Issues and specs live as markdown files in `.scratch/`.

- One feature per directory: `.scratch/<feature-slug>/`; the spec is `.scratch/<feature-slug>/spec.md`.
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined tickets file.
- Triage state is a `Status:` line near the top of each issue file (role strings above).
- Comments append under a `## Comments` heading.
- "Publish to the issue tracker" = create a new file under `.scratch/<feature-slug>/`.

### Wayfinding operations (local)

- **Map**: `.scratch/<effort>/map.md` — the Notes / Decisions-so-far / Fog body.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`), a `Mode:` line records `hitl`/`afk`, and a `Status:` line records `in-progress`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: in-progress` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.
