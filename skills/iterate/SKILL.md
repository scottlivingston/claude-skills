---
name: iterate
description: Grow a feature slice by slice — settle only what the next slice needs, hand its build to a background agent, look at what landed, and let that pick the next slice. One slice per invocation, resumable from an effort log in the repo. `/iterate <idea>` starts an effort.
disable-model-invocation: true
---

The iterative spine, beside `/wayfinder` → `/next`. Where a map settles every decision before code exists, an effort here settles decisions **just in time**: a slice settles what its own build needs, and everything else waits in the fog until a slice reaches it. Slices are discovered one at a time, never planned ahead — each chosen from what exists now and what the last one taught.

## The log

The **effort log** is the memory — a directory in the repo, an index plus one file per slice, format in [LOG-FORMAT.md](LOG-FORMAT.md). Read the index and only the slice file the stage at hand names; earlier slices' files stay closed unless a question reaches back into them. This session is its single writer, and it writes the moment something happens: a decision when it settles, a stage when it changes. A lost session costs at most the exchange in flight. The stage is never remembered — it is read off the log. Run the repo's formatter over the log files before each commit, so a build agent never inherits a red format check from them.

**Each effort has its own checkout** — a worktree at `.claude/worktrees/<slug>/` under the main checkout's root, gitignored, on the effort branch, named on the index's `Checkout:` line — so efforts run side by side and the human sees every one from the main checkout in their editor. Build agents work in their own throwaway worktrees and everything they build merges into this one. Enter it as this session's working directory (`EnterWorktree` with its path) before anything else, since a `cd` doesn't move the agents a workflow spawns; the main checkout is never touched for an effort.

**The checkout is shared while a workflow runs.** Build merges, the check agent, and review fixes all work in the effort's checkout. While one runs, every log write is committed the moment it's made, nothing else in that checkout is edited, and notes that aren't log yet (a scratch render, a probe) live in the scratchpad.

**Every stage change is announced in one line**: the slice, the stage it enters of choose · shape · build · review · reflect, what the stage that ended produced (merged and green, review fixes applied, the brief confirmed), whether the next stage needs the human or runs on its own, and that `/clear` is safe — always true at a stage boundary, since the log changed with the stage.

## Find the effort

Run [find-efforts.sh](find-efforts.sh) from this skill's directory, in the repo: it lists every active effort across all the repo's checkouts — its log, branch, checkout, current slice (the last slice line not `queued`) and that slice's stage — reading each index from the checkout that has its branch. `--all` adds finished efforts. An index it can't parse is reported on stderr; repair it to [LOG-FORMAT.md](LOG-FORMAT.md) before going on.

- The argument is an idea and no effort matches it → kick off, per [KICKOFF.md](KICKOFF.md).
- The argument is a ticket marked `effort-seed` → kick off from that seed, per Kickoff.
- The argument names an effort or a log path → that effort.
- No argument → one active effort → use it. Several → ask which, by name. None → offer any open seeds (per `/issue-tracker`) or ask for the idea, and kick off.

Enter the effort's checkout. A checkout marked `(no Checkout: line)` is an effort that predates the line, already running there: record the line and stay. `none` → make one per Kickoff and record it. Then route on the current slice, announcing it in one line ("Mood meter — slice 3 is mid-build; checking on it"):

| Current slice | Go to |
| --- | --- |
| none, or `done` | 1. Choose |
| `shaping` | 2. Shape — re-read its Decisions, say in a line what's settled, continue |
| `exploring` | 2. Shape, the spike/research branch |
| `building` | 3. Build — the resume rule |
| `reviewing` | 4. Review |
| `reflecting` | 5. Reflect |

## 1. Choose the next slice

Read the index — Destination, Where it stands, the Fog, any `queued` slices — and the last slice file's Learned, and any open review tickets `/diff-review` filed for this effort. Then load `/grilling` and put **one position** per its cadence: the slice you'd take next and the one reason that carries it. A queued slice is the default position: take it unless what the last slice taught changes it, and say so either way. The best next slice is the biggest step one build can carry toward the destination — or, while the way is unclear, the step that teaches how to build it. The first slice is a **tracer bullet** — the thinnest thing that runs end to end and can be seen.

A slice has a **kind**:

- **build** — the default: code that lands on the effort branch.
- **spike** — the human knows what they want but not how to build it; `/prototype` answers that, and the answer is the slice.
- **research** — a question of fact; `/research` answers it.

The human argues, redirects, or picks another. Once agreed, add the slice's line to the index (stage `shaping`, or `exploring` for a spike or research) — or, for a queued slice, move its line to the end and set its stage — and create its slice file with its Why now line.

When the destination looks reached, say so instead; on the human's agreement — and once no deferred review is left uncovered, running Review over any that are — set `Status: done`, commit the log, and offer to remove the effort's worktree — the branch stays.

## 2. Shape the slice

**Build slices.** Load `/grilling` and grill, rooted at this slice: the tree holds only the decisions this slice's build needs. A question a later slice will need goes into the Fog as one line, and the conversation moves on. Load `/domain-modeling` to ground terms. Reach for `/design` when the slice sets a structure later slices will build on, and `/prototype` when the human needs to see it before deciding. Append each decision to the slice's Decisions as it settles. When the slice chases a cause nobody knows yet — a flake, a slowdown — the decisions are what *fixed* looks like and how it's shown; the fix itself is the build's to find, unless the human wants a say in it.

Before the brief goes back, prove that anything the build needs from outside the repo — a running service, a credential, a GPU, a browser, a host — is reachable from a fresh build worktree. What isn't becomes a *Done when* check the session runs at Reflect, named as such.

Shaping is done when the **brief** is written — *Delivers*, *Done when* (every check observable: a test, a command, something the human can see), and *Not in this slice* — and fits one build agent's session per part. A slice whose work falls into **parts** — pieces an agent can build without waiting on another's result, meeting at a contract its Decisions pin (a URL, a function's shape) — lists them in the brief, each with its own *Done when*, so they build in parallel. Files every piece touches (a feature list, a task file, startup wiring, a shared source file) don't hold the work together: the build's collision check and serial merges reconcile them. Work that must happen in order — including a part whose tests need another part's code — stays one part. A brief bigger than one build splits: ask the human which part goes first, and put the rest in the Fog. A slice small and low-risk enough — config, copy, a rename, tests only — can carry *Review: deferred*, which folds it into the next slice's review rather than skipping it. Put the brief back to the human as one piece, naming its parts — or, for a single part, the ordering that keeps it whole — and whether review is deferred; on their confirmation, go to Build.

**Spike and research slices.** Run `/prototype` with the human, or launch `/research` in the background. Record the answer in the slice's Learned, set stage `reflecting`, and go to Reflect.

## 3. Build

1. Commit the log, then record **Base** (the effort branch's `HEAD` after that commit) and a **build branch** per part (`<effort branch>-slice-<n>`, or `…-slice-<n>-<part>` when the brief has several), set stage `building`, and commit again — build agents branch from the effort branch, so a log left uncommitted is a log they never see.
2. Run the build as **one background `Workflow`** (this skill is your authorization to use it). **Start from [build.template.js](build.template.js) — fill it, don't author from scratch**: every `FILL` slot per its comments, tiers resolved per `/model-policy` (load it), test notes per `/testing` (load it). The template owns every build agent's prompt. It runs `/ship`'s wave shape without the tracker or verification: a planner per part and a collision check over the plans (skipped for a one-part brief), one implementer per part in its own worktree, merges into the effort branch in completion order with the integration tests after each, never on red, and then a check agent that runs every *Done when* check an agent can on the merged branch.
3. Announce the stage change: the build runs on its own, and `/iterate` resumes here.
4. When the workflow returns, record each part's report under Build — what was built, how to see it, deviations, the merge sha (an empty or placeholder sha is looked up on the effort branch, never recorded as given) — and the check agent's results: each *Done when* check as passed, failed, or not run. A deviation that contradicts a recorded Decision, or a design call the brief left open (a tuning value, a size, a range), is put to the human before Review. Then, by what each **parked** part names:
   - **A gap in the brief** — something that changes what the slice delivers → set stage `shaping` and sit with the human on it, merged parts staying merged.
   - **A blocked environment** — a denied permission, a missing tool or credential, a merge the agent couldn't run → clear it yourself where you can (run the merge, start the service), or ask the human for that one thing, then run the checks the build skipped yourself and carry on as if it had merged.

   All **done** → a red test run is brought green before anything else, and a test that fails and then passes on a rerun is red (never leave the effort branch red or flaky); then set stage `reviewing` and go to Review, or, when the brief deferred review, set stage `reflecting` and go to Reflect.

**Resume rule.** Stage `building` with a part missing its Build report means the build died with its session. Fill the template again with only those parts, marking `resume` on any whose build branch has commits.

## 4. Review

Run `/diff-review` with **Base** as the fixed point, the slice file as the spec source, the effort log's directory as a path to leave out of the material, and Slice <n> as its spec scope — naming any *Done when* checks the build left not run as Reflect's to run, not findings. When earlier slices deferred their review and no later review has covered them, the review covers them too: the fixed point is the oldest such slice's Base, the spec sources are every covered slice's file, and the spec scope names those slices. Name Slice <n>'s Decisions as where its spec comments land: an answer to a "spec unclear" question becomes one more decision line, tagged `(review)`. Commit the log before launching — review fixes apply nothing on a dirty tree.

The review's pipeline runs as a background workflow; **while it runs, hold Reflect's conversation** — show what landed and ask what the human makes of it, per Reflect — appending to the slice's Learned as it comes, so a resumed session sees the conversation already happened. Review fix agents may commit to the effort branch while the human looks; say so if the app is running. When the workflow returns, its question loop is the human's part of this stage. Record the outcome under Review — fixes applied, tickets filed, the answers given — note "covered by Slice <n>'s review" under each deferred slice's Review, and set stage `reflecting`.

## 5. Reflect

First run every *Done when* check the build's check agent left not run — confirming the brief approved them, so they run without a fresh go-ahead — and record each result under the slice's Build; a check you inferred rather than ran is recorded not run. Then, unless it already happened during Review, show the human what landed, the check results, and how to see it running — offering to run it per `/run` — and ask what they make of it: this conversation is the input the next slice is chosen from. A human who moves on without looking is taken at their word: the checks only their eyes can run go into the Fog as one owed line each, and the slice closes.

A change the human asks for here is a **tweak** when it's a few lines in files this slice touched — a colour, a value, a label: make it in this session, run the scoped tests, commit it, and record it under Build. Anything bigger is a slice of its own, and it heads the next Choose.

Record **Learned** in the slice file and the rest in the index:

- **Learned** — what surprised, and what it changes.
- **Where it stands** — rewritten to describe the code as it is now.
- **Fog** — lines this slice cleared or made shapeable, dropped or sharpened; new ones added.
- **Destination** — edited only when the human's picture moved, with the reason in Learned.

Set stage `done` and commit the log. A finished slice is a natural PR point: ask once per effort whether the human wants a PR per slice, and record the answer on the index's `Branch:` line.

## Rules

- **One slice per invocation, with the budget call made out loud.** After a slice, a light session invites another `/iterate` here; a heavy one recommends `/clear` first. Grilling and building never share a context: the build always goes to the workflow, and only a Reflect tweak is made in this session.
- **Shaping ahead.** While a build or review runs, the human may choose and shape the next slice. It gets its index line, stage `queued`, and its slice file with Decisions and brief, each committed as it settles; the current slice's stages carry on around it, and the next Choose starts from it. An idea that belongs to no slice of this effort is a `/seed` instead.
- **The human owns every decision**, put per `/hitl-questions` — loaded before the session's first question, whatever stage it resumes at; facts come from the code and the effort log, looked up by you before any question leans on them.
