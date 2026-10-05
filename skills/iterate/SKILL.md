---
name: iterate
description: Grow a feature slice by slice — settle only what the next slice needs, hand its build to a background agent, look at what landed, and let that pick the next slice. One slice per invocation, resumable from an effort log in the repo. `/iterate <idea>` starts an effort.
disable-model-invocation: true
---

The iterative spine, beside `/wayfinder` → `/next`. Where a map settles every decision before code exists, an effort here settles decisions **just in time**: a slice settles what its own build needs, and everything else waits in the fog until a slice reaches it. Slices are discovered one at a time, never planned ahead — each chosen from what exists now and what the last one taught.

## The log

The **effort log** is the memory — one markdown file in the repo, format in [LOG-FORMAT.md](LOG-FORMAT.md). This session is its single writer, and it writes the moment something happens: a decision when it settles, a stage when it changes. A lost session costs at most the exchange in flight. The stage is never remembered — it is read off the log.

## Find the effort

- The argument is an idea and no log matches it → kick off, per [KICKOFF.md](KICKOFF.md).
- The argument names an effort or a log path → that effort.
- No argument → the logs with `Status: active` under the repo's effort-log directory (`docs/efforts/` unless KICKOFF chose otherwise). One → use it. Several → ask which, by name. None → ask for the idea and kick off.

Check out the effort's branch (the log's `Branch:` line), then route on the **last slice's stage**, announcing it in one line ("Mood meter — slice 3 is mid-build; checking on it"):

| Last slice | Go to |
| --- | --- |
| none, or `done` | 1. Choose |
| `shaping` | 2. Shape — re-read its Decisions, say in a line what's settled, continue |
| `exploring` | 2. Shape, the spike/research branch |
| `building` | 3. Build — the resume rule |
| `reviewing` | 4. Review — `/diff-review` resumes from its gate file when questions are pending |
| `reflecting` | 5. Reflect |

## 1. Choose the next slice

Read the Destination, Where it stands, the Fog, the last slice's Learned, and any open review tickets `/diff-review` filed for this effort. Then put **one position**, per `/grilling`'s cadence: the slice you'd take next and the one reason that carries it. The best next slice is the smallest step that either moves toward the destination or teaches how to build it. The first slice is a **tracer bullet** — the thinnest thing that runs end to end and can be seen.

A slice has a **kind**:

- **build** — the default: code that lands on the effort branch.
- **spike** — the human knows what they want but not how to build it; `/prototype` answers that, and the answer is the slice.
- **research** — a question of fact; `/research` answers it.

The human argues, redirects, or picks another. Once agreed, append the slice heading (stage `shaping`, or `exploring` for a spike or research) with its Why now line.

When the destination looks reached, say so instead; on the human's agreement set `Status: done` and stop.

## 2. Shape the slice

**Build slices.** Grill per `/grilling`, rooted at this slice: the tree holds only the decisions this slice's build needs. A question a later slice will need goes into the Fog as one line, and the conversation moves on — that line is what keeps the effort from front-loading. Ground terms per `/domain-modeling`. Reach for `/design` when the slice sets a structure later slices will build on, and `/prototype` when the human needs to see it before deciding. Append each decision to the slice's Decisions as it settles.

Shaping is done when the **brief** is written — *Delivers*, *Done when* (every check observable: a test, a command, something the human can see), and *Not in this slice* — and fits one build agent's session. A brief bigger than that splits: keep the first part, put the rest in the Fog. Put the brief back to the human as one piece; on their confirmation, go to Build.

**Spike and research slices.** Run `/prototype` with the human, or launch `/research` in the background. Record the answer in the slice's Learned, set stage `reflecting`, and go to Reflect.

## 3. Build

1. Record **Base** (the effort branch's `HEAD`) and the **build branch** (`<effort branch>-slice-<n>`), set stage `building`, and commit the log — the build agent's worktree is cut from `HEAD`, so a log left uncommitted is a log it never sees.
2. Launch **one background `Agent`** with `isolation: "worktree"`, on the **executor tier** per `/model-policy` (say which model in one line), with the brief below.
3. Tell the human the build is running and that the log holds everything — `/clear` now is safe, and `/iterate` resumes here.
4. When the agent returns, record its report under Build. **Parked** → set stage `shaping` and sit with the human on the gap it names. **Done** → merge the build branch into the effort branch, run the change's scoped tests per `/testing` (never leave the effort branch red), record the merge, set stage `reviewing`, and go to Review.

**Resume rule.** Stage `building` with no Build report means the agent died with its session. Look at the build branch: missing or empty → relaunch; carrying commits → relaunch with one added line, "the build branch already holds prior progress on this brief; check it out and continue."

The build agent's brief:

> You are building one slice of a feature that is being grown iteratively. Read the effort log at `<log path>`: its Destination and Where it stands are context; **Slice <n>**'s Decisions and Brief are your spec. First run `git checkout -b <build branch>`. Build test-first per `/tdd`, at the seams the decisions name, with test recipes resolved per `/testing`. Stay inside the brief: a detail it leaves open that you need, take the smallest reversible option and note it as a deviation; something that would change what the slice delivers, stop and park. Leave the log untouched. Commit as you go. Report: status (`done` or `parked`), the branch, what was built, how to see it running, deviations — or, when parked, exactly what's missing.

## 4. Review

Run `/diff-review` with **Base** as the fixed point, the log as the spec source, and Slice <n> as its spec scope. Its question loop is the human's part of this stage; the questions wait in its gate file beside the log (`<slug>.review.md`), so a session lost mid-loop resumes there. Name Slice <n>'s Decisions as where its spec comments land: an answer to a "spec unclear" question becomes one more decision line, tagged `(review)`, which the next slice's shaping and the next round's reviewers both read. Record the outcome under Review — fixes applied, tickets filed, the answers given — and set stage `reflecting`.

## 5. Reflect

Show the human what landed and how to see it running — run it per `/run` when they want to look. Then ask what they make of it: this conversation is the input the next slice is chosen from. Record, in the log:

- **Learned** — what surprised, and what it changes.
- **Where it stands** — rewritten to describe the code as it is now.
- **Fog** — lines this slice cleared or made shapeable, dropped or sharpened; new ones added.
- **Destination** — edited only when the human's picture moved, with the reason in Learned.

Set stage `done` and commit the log. A finished slice is a natural PR point: ask once per effort whether the human wants a PR per slice, and record the answer on the log's `Branch:` line.

## Rules

- **One slice per invocation, with the budget call made out loud.** After a slice, a light session invites another `/iterate` here; a heavy one recommends `/clear` first. Grilling and building never share a context: the build always goes to the agent.
- **The human owns every decision**, put per `/hitl-questions`; facts come from the code, looked up by you.
