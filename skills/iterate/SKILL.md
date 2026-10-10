---
name: iterate
description: Grow a feature slice by slice — settle only what the next slice needs, hand its build to a background agent, look at what landed, and let that pick the next slice. One slice per invocation, resumable from an effort log in the repo. `/iterate <idea>` starts an effort.
disable-model-invocation: true
---

The iterative spine, beside `/wayfinder` → `/next`. Where a map settles every decision before code exists, an effort here settles decisions **just in time**: a slice settles what its own build needs, and everything else waits in the fog until a slice reaches it. Slices are discovered one at a time, never planned ahead — each chosen from what exists now and what the last one taught.

## The log

The **effort log** is the memory — a directory in the repo, an index plus one file per slice, format in [LOG-FORMAT.md](LOG-FORMAT.md). Read the index and only the slice file the stage at hand names; earlier slices' files stay closed unless a question reaches back into them. This session is its single writer, and it writes the moment something happens: a decision when it settles, a stage when it changes. A lost session costs at most the exchange in flight. The stage is never remembered — it is read off the log.

**Every stage change is announced in one line**: the slice, the stage it enters of choose · shape · build · review · reflect, what the stage that ended produced (merged and green, review fixes applied, the brief confirmed), whether the next stage needs the human or runs on its own, and that `/clear` is safe — always true at a stage boundary, since the log changed with the stage.

## Find the effort

- The argument is an idea and no log matches it → kick off, per [KICKOFF.md](KICKOFF.md).
- The argument names an effort or a log path → that effort.
- No argument → the effort indexes with `Status: active` under the repo's effort-log directory (`docs/efforts/` unless KICKOFF chose otherwise). One → use it. Several → ask which, by name. None → ask for the idea and kick off.

Check out the effort's branch (the index's `Branch:` line), then route on the **last slice's stage** from the index, announcing it in one line ("Mood meter — slice 3 is mid-build; checking on it"):

| Last slice | Go to |
| --- | --- |
| none, or `done` | 1. Choose |
| `shaping` | 2. Shape — re-read its Decisions, say in a line what's settled, continue |
| `exploring` | 2. Shape, the spike/research branch |
| `building` | 3. Build — the resume rule |
| `reviewing` | 4. Review |
| `reflecting` | 5. Reflect |

## 1. Choose the next slice

Read the index — Destination, Where it stands, the Fog — and the last slice file's Learned, and any open review tickets `/diff-review` filed for this effort. Then load `/grilling` and put **one position** per its cadence: the slice you'd take next and the one reason that carries it. The best next slice is the smallest step that either moves toward the destination or teaches how to build it. The first slice is a **tracer bullet** — the thinnest thing that runs end to end and can be seen.

A slice has a **kind**:

- **build** — the default: code that lands on the effort branch.
- **spike** — the human knows what they want but not how to build it; `/prototype` answers that, and the answer is the slice.
- **research** — a question of fact; `/research` answers it.

The human argues, redirects, or picks another. Once agreed, add the slice's line to the index (stage `shaping`, or `exploring` for a spike or research) and create its slice file with its Why now line.

When the destination looks reached, say so instead; on the human's agreement set `Status: done` and stop.

## 2. Shape the slice

**Build slices.** Load `/grilling` and grill, rooted at this slice: the tree holds only the decisions this slice's build needs. A question a later slice will need goes into the Fog as one line, and the conversation moves on. Load `/domain-modeling` to ground terms. Reach for `/design` when the slice sets a structure later slices will build on, and `/prototype` when the human needs to see it before deciding. Append each decision to the slice's Decisions as it settles.

Shaping is done when the **brief** is written — *Delivers*, *Done when* (every check observable: a test, a command, something the human can see), and *Not in this slice* — and fits one build agent's session per part. A slice whose work falls into **parts** that touch separate files and meet only at a contract its Decisions pin (a URL, a function's shape) lists them in the brief, each with its own *Done when*, so they build in parallel; work that must happen in order stays one part. A brief bigger than that splits: keep the first part, put the rest in the Fog. Put the brief back to the human as one piece; on their confirmation, go to Build.

**Spike and research slices.** Run `/prototype` with the human, or launch `/research` in the background. Record the answer in the slice's Learned, set stage `reflecting`, and go to Reflect.

## 3. Build

1. Record **Base** (the effort branch's `HEAD`) and a **build branch** per part (`<effort branch>-slice-<n>`, or `…-slice-<n>-<part>` when the brief has several), set stage `building`, and commit the log — every build agent's worktree is cut from `HEAD`, so a log left uncommitted is a log they never see.
2. Run the build as **one background `Workflow`** (this skill is your authorization to use it). **Start from [build.template.js](build.template.js) — fill it, don't author from scratch**: every `FILL` slot per its comments, tiers resolved per `/model-policy` (load it), test notes per `/testing` (load it). The template owns every build agent's prompt. It runs `/ship`'s wave shape without the tracker or verification: a planner per part and a collision check over the plans (skipped for a one-part brief), one implementer per part in its own worktree, and merges into the effort branch in completion order, never on red.
3. Announce the stage change: the build runs on its own, and `/iterate` resumes here.
4. When the workflow returns, record each part's report under Build — what was built, how to see it, deviations, the merge sha. Any part **parked** → set stage `shaping` and sit with the human on the gap it names, merged parts staying merged. All **done** → run the slice's scoped tests per `/testing` on the effort branch (never leave it red), set stage `reviewing`, and go to Review.

**Resume rule.** Stage `building` with a part missing its Build report means the build died with its session. Fill the template again with only those parts, marking `resume` on any whose build branch has commits.

## 4. Review

Run `/diff-review` with **Base** as the fixed point, the slice file as the spec source, and Slice <n> as its spec scope. Its question loop is the human's part of this stage. Name Slice <n>'s Decisions as where its spec comments land: an answer to a "spec unclear" question becomes one more decision line, tagged `(review)`. Record the outcome under Review — fixes applied, tickets filed, the answers given — and set stage `reflecting`.

## 5. Reflect

Show the human what landed and how to see it running — run it per `/run` when they want to look. Then ask what they make of it: this conversation is the input the next slice is chosen from. Record **Learned** in the slice file and the rest in the index:

- **Learned** — what surprised, and what it changes.
- **Where it stands** — rewritten to describe the code as it is now.
- **Fog** — lines this slice cleared or made shapeable, dropped or sharpened; new ones added.
- **Destination** — edited only when the human's picture moved, with the reason in Learned.

Set stage `done` and commit the log. A finished slice is a natural PR point: ask once per effort whether the human wants a PR per slice, and record the answer on the index's `Branch:` line.

## Rules

- **One slice per invocation, with the budget call made out loud.** After a slice, a light session invites another `/iterate` here; a heavy one recommends `/clear` first. Grilling and building never share a context: the build always goes to the workflow.
- **The human owns every decision**, put per `/hitl-questions` — loaded before the session's first question, whatever stage it resumes at; facts come from the code, looked up by you.
