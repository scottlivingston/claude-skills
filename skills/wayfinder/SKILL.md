---
name: wayfinder
description: Build something too big for one agent session, unattended, from the destination, principles, and design the human sets at the start — a lead session plans it as a graph of pieces in `sc`, the local forge, proves only the risks that could sink it, builds every ready piece as its own workflow with a change proposed for the effort branch, gates each change with review agents and CI run on this machine, drives the real app to verify it, steers from what landed, and hands back one branch to merge. Needs no GitHub and no remote. `/wayfinder <idea>` shapes an effort; `/wayfinder <slug>` runs or resumes its lead. Invoke only when the user explicitly asks for it — never spontaneously.
---

The human gives an effort its **destination**, its **acceptance behaviors**, its principles, and its high-level design in one **Shape** session. From then on one **lead** session runs it unattended to a single effort branch and a closing report, which the human reviews at **Close**. Those are the only two places the human is in the loop. In between, agents decide the details per `/deciding` and reach the human only for its three escalation cases and for work only the human can do.

**Done is behaviors you can watch.** An effort is done when every acceptance behavior set at Shape is driven and proven on the real app through its `verify-<app>` skill (per `/create-verification-skill`). There is no test-first rule: tests follow the repo's `TESTING.md`, and proof is the app doing the thing.

## The stages

Every stage runs as a workflow filled from a template beside this file — the template owns its prompts, so the rails are reviewed code, never improvised. Only Shape and the lead are sessions.

| Stage | Runs as | Does |
| --- | --- | --- |
| Shape | the human's session, per [SHAPE.md](SHAPE.md) | Writes the charter, settles the verification harness, passes preflight, hands off to the lead. |
| Plan | [plan.template.js](plan.template.js) | Cuts the charter into pieces, risks, human tasks, and shared decisions; checks the graph; a critic attacks it; publishes it. |
| Prove | [spike.template.js](spike.template.js), one per risk | Answers the risk with the cheapest experiment, records the answer as a decision. |
| Build | [build.template.js](build.template.js), one per piece | Builds the piece until its behaviors verify, opens its change, waits for CI and fixes red CI in place; in fix mode, answers review findings or resolves a merge conflict. |
| Review | [review.template.js](review.template.js), one per green change | Spec and standards reviewers through `/finding-pipeline`; posts the reviewer statuses. |
| Verify | [verify.template.js](verify.template.js) | Drives every built behavior on one pinned commit of the effort branch; files a defect piece per failure. |
| Steer | [steer.template.js](steer.template.js) | Replans, reviews recent decisions and reconsiders strained ones, checks progress and completion. |
| Close | [close.template.js](close.template.js) | Whole-diff review, then the closing report. |

The lead's loop, which launches all of these, is [LEAD.md](LEAD.md).

## The local forge

An effort needs no GitHub, no remote, and no hosted CI. Its forge is Sous Chef, the `sc` command on `PATH`: every agent reaches the tracker, the changes, the statuses and the build queue through `sc` and nothing else. `sc --help` and each `sc <noun> <verb> --help` are the reference, and every read takes `--json`. `sc` keeps one record per repo, shared by every worktree and by every effort in the repo.

- **An issue** is the plan, a piece, a risk, a human task, a shared decision, or a repo-wide review finding. Labels are `/issue-tracker`'s vocabulary.
- **A change** is a piece branch proposed for the effort branch — what a pull request would be. It has a body, comments, and the statuses of its head commit. Changes are numbered apart from issues.
- **CI** is the jobs in the `sc.toml` at the repo root: named shell commands, each run from the root of a clean checkout.
- **The gate** runs inside `sc`'s daemon, which any `sc` command starts. It runs every CI job on each open change's head, and squash-merges a change into the effort branch once every required status passes and its piece has no open blocker. A change that conflicts with the effort branch gets a failing `sc/merge` status instead, and no CI until it is resolved.
- **Protection** is `sc`'s git hook: only the gate moves a protected branch, and `effort/<slug>` is one. Nothing checks the effort branch out.
- **Pools** cap what the machine runs at once. Every build and test goes through `sc run --pool build`, as CI jobs do, and every running copy of the app through `sc run --pool drive-<app>`. Only the human resizes a pool, in `sc tui`.
- **A question** (`sc question ask --issue <n>`) is how an issue is shown to the human as waiting on them: it lists on the Questions screen of `sc tui` and makes the issue `waiting` until it is answered.

What `sc` leaves to the workflow is [effort.py](effort.py), beside this file: `setup` and `finish` for the effort branch, `show`, `pieces` for each piece's state, `fill` for the build and review templates, and `pr-lint` for the change body. Each takes `--effort <slug>`.

## Where state lives

Everything the lead needs to resume is in `sc` or the repo — never only in a session — so the lead can compact or die and pick up from the record alone.

- **The repo, on the effort branch:** the charter at `docs/wayfinder/<slug>.md` (format: [CHARTER.md](CHARTER.md)), `sc.toml` with the CI jobs and the effort branch's gate, and the `verify-<app>` skill with its feature map. All merge with the effort.
- **Issues:** the plan, its pieces, risks, human tasks, and shared decisions.
- **Changes:** a piece's code, its evidence, review comments, the reviewer statuses, and CI.

`sc`'s record is not part of any commit: it stays on this machine, and what must outlive the effort — the code, the charter, the closing report's follow-ups — leaves through the effort branch and the report.

### Names

- **Effort branch** `effort/<slug>`, protected: only the gate moves it. **Piece branch** `piece/<slug>/<n>`, where `<n>` is the piece's issue number; **spike branch** `spike/<slug>/<n>`, which keeps a spike's evidence and never merges. All are local branches of the one repo, so a commit is visible to every worktree at once.
- **Worktrees** under `.claude/worktrees/<slug>/`: `piece-<n>` and `spike-<n>` (one per workflow, shared by its stages, removed when the piece merges or parks), `verify`, and `review-<change>`.
- **Required statuses** on a change: one `ci/<job>` per CI job, `wayfinder/pr-format`, `wayfinder/spec`, and `wayfinder/standards`, listed under `[gates."effort/<slug>"]` in `sc.toml`, plus `sc/merge`, which `sc` always requires. Only the gate posts `ci/*` and `sc/merge`; only `effort.py pr-lint` posts the format status; only the review workflow posts the other two. A status is `pass`, `fail`, or `pending`.
- **A claim** is the issue's assignee: `sc issue assign <n> lead` takes it and `sc issue unassign <n>` releases it. This is `/issue-tracker`'s `in-progress`.
- **A comment's id** is its position among its issue's or change's comments, counted from 1: `sc` numbers none and replaces none, so the newest comment carrying a marker is the one that counts.
- **Behaviors** are numbered `B<n>` in the charter, and the same IDs head their feature-map files and every piece's acceptance.

### Issues and their markers

All labels are `/issue-tracker` vocabulary.

- **The plan** — labelled `wayfinder:plan`, one per effort, in this body shape. Plan and Steer rewrite the behavior map and Where it stands, and nothing else:

  ```markdown
  Effort branch: effort/<slug>
  Charter: docs/wayfinder/<slug>.md

  ## Destination
  <copied from the charter>

  ## Behavior map
  - **B<n>** <behavior> — <the pieces that cover it, or "not covered yet">

  ## Where it stands
  <what runs now, what landed and was learned lately, what's next>
  ```
- **A piece** — an `impl` issue whose parent is the plan, in this body shape, which [effort.py](effort.py) and every template read:

  ```markdown
  ## Goal
  <what this piece delivers, in a paragraph>

  ## Acceptance
  - B<n>: <behavior> — <the observable end state that proves it>
  - <any further criterion an agent can check>

  ## Builds on
  - #<decision issue> <title>
  ```

  A defect Verify filed also carries `wayfinder:defect`. A parked piece carries `wayfinder:parked` and a `<!-- wayfinder park -->` comment with the reason.
- **A risk** (`wayfinder:risk` + `afk`) and **a human task** (`wayfinder:task` + `hitl`) — linked to the plan by a `Plan: #<plan>` first line, never children, so the frontier never holds them. Each blocks only the pieces that rest on it.
- **A shared decision** — a call two or more pieces need — is its own issue labelled `wayfinder:decision`, linked the same way, its body the decision record per `/deciding`. Friction notes are comments on it. Every piece that builds on it lists it under **Builds on** and is blocked by it until it is closed, which it is when published. A call only one piece needs is a `<!-- decision-record -->` comment on that piece.
- **Escalations** are `<!-- escalation -->` comments on the issue they concern, which is switched to `hitl` and named by a question in `sc`. A human task carries a question the same way from the moment it is filed.

Plan-level records are comments on the plan: `<!-- wayfinder verify <sha> -->` for each Verify report, `<!-- wayfinder steer <n> -->` for each Steer summary, `<!-- wayfinder reconsider <n> -->` for each decision Steer `<n>` reconsidered (on the decision issue), `<!-- wayfinder close <k> -->` for each Close review pass, `<!-- wayfinder report -->` for the closing report, `<!-- wayfinder redirect -->` for the human's redirects, and `<!-- wayfinder lead -->` when a lead starts. A review round is a `<!-- wayfinder review <round> -->` comment on its change; a piece's build plan is a `<!-- wayfinder build-plan -->` comment on the piece.

### A piece's state is derived, never stored

`sc` works each issue's state out from its record, and `effort.py pieces` lays `parked` over it and adds each piece's open change, that change's statuses, and `conflict`. Every reader uses it rather than its own reckoning. The first row that holds wins:

| State | Derived from |
| --- | --- |
| `done` | closed by the gate when its change landed |
| `dropped` | closed as not planned (Steer dropped it) |
| `parked` | the `wayfinder:parked` label |
| `blocked` | an open blocker |
| `waiting` | an open question names it: it waits on the human |
| `landing` | its open change has every required status passing: the gate lands it next |
| `in-review` | an open change from its piece branch; `conflict` is set when `sc/merge` is failing on its head |
| `working` | claimed, no open change |
| `ready` | none of the above |

## Refer by name

In everything a human reads, refer to the plan, a piece, a risk, or a decision by its title followed by its number — `Core VM skeleton (#12)` — and a change the same way — `Core VM skeleton (change 5)`. Never a bare number or slug.
