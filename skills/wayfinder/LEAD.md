# The lead

`/wayfinder <slug>` makes this session the effort's lead: the one agent the human talks to, which runs every other stage as a workflow and never builds, reviews, or plans anything itself. Its context holds the run, not its substance — so it stays small, is compacted by the harness at the size its hand-off set, and re-reads state from `sc` at every cycle instead of remembering it. What it tells the human is read the same way: a question about what an agent did, or why something happened, is answered from that workflow's transcripts and `sc`, looked up before replying. Never answer one with a guess at likely causes.

Every `sc` command below is the local forge SKILL.md describes, run from anywhere in the repo; `effort.py` is [effort.py](effort.py), run as `effort.py --effort <slug> …`.

## Starting

**Leave the multiplexer session's name alone.** Shape starts the lead in a tab of the human's own multiplexer session, already labelled with the plan's title. A startup hook that asks this session to name or rename the multiplexer session does not apply here: that name is the human's.

Every start is the same, whether the effort is new or the last lead died:

1. Load `/deciding`, `/issue-tracker`, `/model-policy`, `/hitl-questions`, `/testing`, and `/conventions`. Resolve the model tiers once and say in one line which models they resolved to.
2. Find the plan: the `wayfinder:plan` issue whose body opens `Effort branch: effort/<slug>` (`sc issue list --label wayfinder:plan --search`). Read it (`sc issue view <plan>`), the charter its body names (`git show effort/<slug>:<charter>`), the branch's head, CI jobs, and required statuses (`sc gate view effort/<slug>`), and the pieces (`sc issue list --parent <plan> --json`).
3. **Free every claim.** Nothing this lead launched is running yet, so every assignee on the plan's pieces, risks, and the plan itself belongs to a lead that's gone: unassign them. Each build or spike workflow picks up where its piece left off when it's relaunched.
4. Post `<!-- wayfinder lead -->` on the plan, saying a lead started and what it found.
5. Load `/multiplexer` and open a side pane running `sc tui`, labelled with the plan's title: its Work screen shows every piece's state and every change's statuses, and its Questions screen what waits on the human. With no multiplexer, tell the human the command. The gate needs no pane: it runs in `sc`'s daemon, which any `sc` command starts.
6. Start the watcher: `sc watch --json --kind landed --kind conflict --kind question --kind answered` with `run_in_background`. It exits when the gate lands a change, when a change comes into conflict, and when a question is asked or answered. Name the kinds: an unfiltered watch also exits on every comment an agent posts.
7. Run a cycle.

## The cycle

Run one on every event — a workflow finishing, the watcher exiting, the human saying something — and tell the human about it once, in one line written after the cycle's actions: what happened, what's building and what's being proved. Write nothing before those actions: a line on the way in and a fuller one on the way out is the same news twice. While an escalation is unanswered, end the message by putting it again, whole, per `/hitl-questions`: the human comes back to the latest message alone, so it has to stand without the ones above it. With several unanswered, put the one that blocks the most work and say how many wait behind it. A human who is away has not passed a question over; it stays open until they answer.

1. **Read state**: the pieces (`sc issue list --parent <plan> --json`), the plan's open risks, tasks, and decisions (`sc issue list --linked <plan> --label …`), the open questions (`sc question list`), and the comments since the last cycle.
2. **Take in answers.** The human answering an escalation, or saying a task of theirs is done: record the answer with `sc question answer`, which ends the issue's `waiting`, and as a decision record whose ground is the human (per `/deciding`); switch the issue back to `afk`, or close the task; and let what it blocked unblock. A question the human answered themselves, in `sc tui` or another terminal, reaches the lead as the watcher's `answered` event: take its answer from `sc question view` and act on it the same way.
3. **Act on what finished** — each workflow's typed return, per the table below.
4. **Launch what's ready**, each its workflow's single claim (below):
   - **Plan**, when the plan has no pieces yet and no escalation on it is waiting on the human.
   - **Build**, for each `ready` piece in plan order, until the charter's *Pieces at once* builds are running. Fix-mode builds count toward the limit. No first build of a piece launches while a Steer is running: Steer edits, splits and drops ready and blocked pieces from the state it was filled with, so a build started under it can be building a scope Steer has just changed. Fix-mode builds still launch.
   - **Spike**, for each open, unblocked, unclaimed risk labelled `afk` — one switched to `hitl` is waiting on the human.
   - **Review**, for each `in-review` piece whose change has every `ci/*` status passing and no `wayfinder/spec` status yet.
   - **Build in fix mode**, for each `in-review` piece whose open change has `sc/merge` failing and no build running: its one finding is that the change conflicts with the effort branch, to be fixed by merging the effort branch into the piece branch. The gate runs no CI on a head in conflict, so the new head gets CI and a review round of its own.
   - **Verify**, when the effort branch has landings since the last `<!-- wayfinder verify <sha> -->` report and no Verify is running. Changes that land during a run wait for the next one.
   - **Steer**, when a Steer trigger has fired since the last `<!-- wayfinder steer <n> -->` summary and none is running: a Verify report that filed a defect (its `filed` is not empty), a parked piece, a spike's answer, a decision labelled `friction`, the human's redirect, or a Verify report on the effort branch's head while no piece or risk is open, which is the Steer that returns `complete`. Any other Verify report triggers nothing: Steer would have no defect, park, or answer to turn into ops.
5. **Restart the watcher** if it exited.

### One claim per workflow

What's in flight is read off `sc`, never remembered, so a compacted or restarted lead can tell. Every workflow holds exactly one claim, taken by the lead as it launches. An assignee claim (`sc issue assign <n> lead`) is released by the lead when the workflow returns — whatever it returns, and also when it fails. A status claim is released by the workflow itself, whose final statuses replace the `pending` ones; when that workflow fails, the lead sets those statuses to `fail`, saying the workflow died, and relaunches it explicitly, since the trigger that launched it no longer fires:

| Workflow | Its claim |
| --- | --- |
| Build (either mode) | the piece's assignee |
| Spike | the risk's assignee |
| Review | `pending` on `wayfinder/spec` and `wayfinder/standards` at the change's head (`sc status set`) |
| Verify | `pending` on `wayfinder/verify` at the pinned commit |
| Plan, Steer, Close | the plan's assignee |

A workflow that fails is relaunched once with the same inputs. A second failure parks its piece, with `sc issue hold` and a `<!-- wayfinder park -->` comment saying what failed; for a risk, the lead records a best guess per `/deciding` and closes it with a note saying what failed.

### Filling and launching

The lead never fills a workflow in its own context, and never edits a filled script.

- **Build and Review** are filled by `effort.py fill build <piece>` and `effort.py fill review <change>`, which read every slot from `sc`, the charter, and the model policy, and print the script's path. A build in fix mode takes `--fix-input <file>` holding the review round's number, its findings with their validated repairs, and every answer to its questions, verbatim — or, for a conflict, the failing `sc/merge` status's description. `effort.py fill --help` lists the overrides for what the record can't settle.
- **Every other workflow** is filled from its template by a **fill agent** (executor tier, via the `Agent` tool). Its brief names the template, the effort's slug, and the one risk or commit in hand; the fill agent reads every input through `sc` and the effort branch, fills every `FILL` slot per the template's header, writes the script to `$TMPDIR/wayfinder/<slug>/<kind>-<id>.js`, and returns that path plus a one-line manifest. Every fill gets a new fill agent: one messaged again for a later fill re-reads all its earlier fills, at full price once its cache has lapsed.

The lead launches the script with `Workflow({scriptPath})` in the background. Its return comes back as a notification; the lead reads only the typed return.

### What each return means

| Workflow returns | The lead |
| --- | --- |
| Plan `published` | Nothing more: the next cycle sees the pieces. |
| Plan `escalate` | Escalates the charter gap it names (below); the parts of the plan that don't touch it were published. |
| Build `green` | Nothing more: the next cycle launches its review. |
| Build `parked` | Nothing more: the workflow posted the park, and Steer picks it up. |
| Review `pass` | Nothing more: the gate lands it once every status passes. |
| Review `changes` | Launches the piece's build in fix mode with the findings — unless this was the third round, in which case it parks the piece and posts a friction note on the decision the findings trace to. |
| Review `questions` | Has each question answered by one decider subagent per `/deciding`'s *Answering a gate*, which posts the answers on the change as one comment opening `<!-- wayfinder review-answers <round> -->` — where later rounds read them as binding — then launches fix mode with them. What that escalates waits on the human; the rest of the change's findings still go to fix mode. |
| Spike `answered` | Nothing more: the decision is published and the risk closed. |
| Spike `design-breaks` | Puts the escalation the spike posted on its risk to the human: the answer breaks the design, which only the human changes, or hits another of `/deciding`'s escalation cases, as its summary says. |
| Verify `reported` | Nothing more: defects are already pieces, and a report that filed one triggers Steer. |
| Steer `continue` | Nothing more. |
| Steer `stalled` | Escalates its stall report: the cycle landed no piece and retired no risk. |
| Steer `complete` | Starts Close. |
| Close review `clean` | Goes on to the next step of Close. |
| Close review `findings` | Without `systemic`: nothing more — the findings are pieces, back in the cycle. With `systemic`: goes straight on to Close's report step, whose report names the gap and the open pieces as known issues. |
| Close report `reported` | Hands the effort to the human (below). |

## Escalations

An escalation is posted durably on the issue it concerns per `/deciding`, asked in `sc` (`sc question ask "…" --issue <n>`, unless the workflow that posted it already did) so the issue shows `waiting` and the question lists in `sc tui`, and also put to the human here, in this session, per `/hitl-questions`. The run never waits on it: everything that doesn't depend on the answer keeps building. When the human answers here, post their answer on the issue and record it with `sc question answer` before acting on it, so the record stays whole.

A human telling the lead to redirect, stop, or change course is recorded as a `<!-- wayfinder redirect -->` comment on the plan, which triggers Steer. Only the human changes the charter; a redirect that does commits the change to it on a branch of its own and lands it through a change like any other, attached to a piece filed for it.

## Close

When Steer returns `complete`:

1. Launch the Close workflow in review mode over the whole branch. Findings come back as pieces, which puts the run back in the cycle; Steer returns `complete` again once they land.
2. Clean: load `/tend` and run it `--since` the effort's merge-base with the default branch, with the plan issue as its gate home, answering its gate per `/deciding`.
3. Launch Verify once more, pinned to the effort branch's head.
4. Launch the Close workflow in report mode. It posts the closing report as the newest `<!-- wayfinder report -->` comment on the plan.
5. Hand the effort to the human: show them the report, and give them the two commands that take it — `git diff <base>...effort/<slug>` to review, and `git merge effort/<slug>` on the base branch to accept — or, when `sc` protects the base branch too, `sc change open --target <base>` from a branch at the effort's head. What they say back is a redirect: Steer turns it into pieces and the run continues. When they say it's merged, post a final `<!-- wayfinder lead -->` saying the effort is done, and retire the branch: `sc branch delete effort/<slug>`, with `--force` when changes into it are still open, then `sc gate retire effort/<slug>`, which closes those changes. Delete it only once `git merge-base --is-ancestor effort/<slug> <base>` holds, or the human has said they squashed it or are abandoning it. Then stop the watcher, and stop.

Two Close passes in a row that each find new problems mean the plan or the standards have a systematic gap: the second report says so, and the effort goes to the human with its known issues rather than looping again.
