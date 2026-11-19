# claude-skills

An opinionated, end-to-end workflow for Claude Code: set an effort's destination, the behaviors that prove it works, your principles, and its high-level design with you, then let agents build it unattended — a lead session plans it as a graph of pieces, proves only the risks that could sink it, builds every ready piece as its own workflow with a change proposed for the effort branch, gates each change with review agents and CI, drives the real app to verify it, and reviews its own decisions as it goes so a bad call is corrected before more is built on it. It all runs on your machine, with no GitHub and no hosted CI. You're in the loop twice: at the start, and when one branch comes back for you to merge.

Packaged as a Claude Code plugin (`scott-skills`).

## The workflow

A loose idea goes in; one branch of running, verified code comes out.

### 1. Shape it — `/wayfinder <idea>`

Shape is the one session that's yours. It pins down the **destination** — the working thing — and the **acceptance behaviors**: what you'll see when it works, each written as how a user reaches it and the observable end state that proves it. Those behaviors are the definition of done, proven later by driving the real app through its `verify-<app>` skill (built now by `create-verification-skill` if the app has none, or as the first piece of a greenfield effort). Then the **principles** the effort's calls follow, the **high-level design** and what's out of scope, and the run's limits, among them the proof bar: how hard a piece is proven before it lands, and which long runs wait for Verify or Close. Two checks close it: a prediction test, where you correct how the agent would decide the hardest calls, and a cold read, where a fresh agent lists every question the charter leaves it guessing on. A preflight proves the factory can run — GitHub auth, CI running on PRs into the effort branch, branch protection with its required checks. The charter is committed to an effort branch, and a lead session takes over.

### 2. The run — one lead, many workflows

The **lead** is the only agent you talk to. It never builds or reviews anything; it launches workflows, reads their typed results, and reacts to what changes in the effort's store. Every stage runs as a workflow filled from a template, so the agents stay on rails:

- **Plan** cuts the charter into pieces sized to one agent session, with blocking edges only where one piece needs another's code, plus the risks that could sink it and the tasks only you can do. Script checks prove the graph covers every behavior; a critic tries to break it.
- **Prove** answers each risk with the cheapest spike, and only the pieces resting on it wait.
- **Build** runs one workflow per ready piece, up to a limit: plan, build, drive the piece's behaviors through the verify skill, open a change for the effort branch, wait for CI, and fix red CI in place.
- **Review** gates each green change with spec and standards reviewers through the finding pipeline. The spec reviewer re-drives a behavior itself. Their verdicts are required statuses, so the gate merges a change the moment they pass, and findings send the piece back through its build in fix mode.
- **Verify** drives every built behavior on one pinned commit of the effort branch and files a defect piece for each failure — it's how pieces that each passed review but break each other get caught.
- **Steer** replans from what landed, fills parked pieces' gaps, and reviews recent decisions.

Builds and tests from every agent queue for a fixed number of host-wide build slots, and running copies of the app for drive slots, so the machine is never oversubscribed. A status pane beside the lead shows every piece's state, worked out from the store, and a second pane runs the gate: the one process that runs CI on every change and merges what passes.

**Prove what could sink it, guess the rest.** A question becomes a risk only when building on a wrong guess would waste real work. Everything else is decided by best guess — the call the principles and design most plainly imply — by whichever agent needs it, and the code corrects it if it was wrong.

**Agents decide, citing their grounds.** Every call follows the `deciding` contract: a **decision record** citing the principle, the design line, the prior art, or the earlier decision that settled it, with what it rejected and whether it's a one-way door. You're pulled in for exactly three cases — no grounds settle it, it's a one-way door, or it would change your principles or design — and for your tasks. The lead puts each to you in its session, and the run builds around it while it waits.

### 3. Catch compounding — friction and reconsideration

Autonomy's characteristic failure is a confident early call that later code quietly builds around. When any agent has to bend around an earlier decision, it posts a **friction note** on it. Each Steer cross-reads the decisions made since the last one — contradictions, broken inputs, calls built around without a note, decisions resting on facts since disproved — and **reconsiders** any decision with friction from real code: stands, amend, or supersede, each attacked by a fresh agent before it applies. Code already built on a superseded call gets a rework piece, so a bad call costs at most what was built before it was caught.

### 4. Close

When every behavior is proven and nothing is open, a whole-diff review hunts the drift between pieces built in parallel and checks every requirement landed somewhere; `/tend` cleans the docs the effort touched; a last Verify runs on the exact commit; and the lead hands you the effort branch with a closing report — each behavior with its evidence, the decisions that mattered, deviations, known issues, follow-ups. What you say back becomes pieces and the run carries on; your merge ends it.

## The other way: `/iterate`

`/wayfinder` hands decisions to agents under rules you set up front, which earns its cost on a big effort whose principles you can state. `/iterate` is the human-driven spine beside it: you make the decisions **just in time**, one slice at a time, and the next slice is chosen from what the last one taught.

`/iterate <idea>` kicks off an effort: a short conversation that stops once what you want fits in a confirmed **Destination** paragraph, with early detail parked in a **Fog** list instead of settled. After that, each `/iterate` runs one slice:

1. **Choose** — the agent proposes the next slice and you push back; it's the biggest step one build can carry toward the destination, or, while the way is unclear, the step that teaches how to build it, and the first is a tracer bullet. A slice you shaped ahead while the last one built is the default pick. A slice is a *build*, a *spike* (`/prototype`, for when you know what but not how), or *research*.
2. **Shape** — grill only the decisions this slice's build needs; anything a later slice needs goes to the Fog. Anything the build needs from outside the repo — a service, a credential, a browser — is proved reachable first. Ends in a short brief: what it delivers, how you'll know it's done, what's left out — and, for a small low-risk slice, whether its review waits to be folded into the next slice's.
3. **Build** — a background workflow builds the brief test-first, so the grilling session never holds the implementation: one implementer for a brief that must happen in order, or one per independent part in its own worktree, planned, collision-checked, and merged onto the effort branch in completion order — each merge running the tests once — then a check agent runs every done-when check it can on the merged result, passing only what it saw itself. A part blocked by its environment rather than its brief is unblocked by the session, not sent back to shaping.
4. **Review** — `/diff-review` against the slice's brief (and any deferred slices' briefs), with the effort log left out of the diff, its questions saved to a gate file beside the log and its answers landing as decisions on the slice. While its pipeline runs in the background, you and the agent hold Reflect's conversation about what landed.
5. **Reflect** — you look at it running, with the check results in hand; a few-line tweak you ask for is made on the spot, anything bigger becomes the next slice, and what you learned rewrites the log's picture of where things stand and reshapes the Fog. Each slice is one session: only once it closes does the agent recommend `/clear` before the next `/iterate`.

The memory is an **effort log** in the repo (`docs/efforts/<slug>/` by default) — an index of the destination, the state and the fog, plus one file per slice, so a session reads only what the current slice needs — written the moment anything settles and committed before every build, so a lost session costs at most the exchange in flight and `/iterate` resumes from whatever stage the last slice reached. Each effort runs in its own gitignored worktree at `.claude/worktrees/<slug>/` inside the repo, which build agents merge their work into, so several efforts can be under way at once, all visible from the main checkout in your editor, while the main checkout stays free. Run inside an agent multiplexer — [Herdr](https://herdr.dev) or Rex — kickoff opens the new worktree as its own workspace and hands the effort to a fresh Claude Code session there. An idea that turns up mid-effort but belongs to an effort of its own goes to `/seed`, which parks it as a ticket marked `effort-seed`; `/iterate <ticket>` later kicks off from it. The opinions below are `/wayfinder`'s; apart from seeds, `/iterate` keeps the tracker out of the loop and trades the up-front map for a slice at a time.

## The opinions

**The store is the memory, not the chat.** A big effort outlives any one context window, so all durable state — the plan, pieces, decisions, blocking edges, claims, changes, reviews — lives in a local store inside the repo's git directory, written only through `wf.py`, and every piece's state is worked out from it rather than stored. The lead compacts freely and can die; a new one picks up from the store alone.

**Behaviors you can watch are the measure.** Plans, decisions, and reviews exist only to get the right code built, and done means the app doing the thing, driven and observed — not a test suite written up front. A Steer cycle that lands nothing is a stall to diagnose, never a lap to repeat.

**Everything is sized to a context window.** Each piece is sized to one agent session, and a build workflow never holds two. Fresh context per unit of work is the point, not an inconvenience.

**The human sets the rules; agents make the calls.** Your time goes into the destination, the principles, and the design — the inputs every decision stands on — and into the three kinds of call no input can settle: a question the grounds leave open, a one-way door, and a change to the inputs themselves. Everything else is decided by agents, and every decision cites the principle, design line, prior art, or earlier decision that settled it, so any call can be audited and overridden after the fact.

**Strain is reported, never absorbed.** A later decision that has to bend around an earlier one says so on the earlier one, and accumulated strain triggers a reconsideration that plans the correction across everything that rests on the decision. Correcting a decision is routine work, not a failure — what the workflow refuses is building quietly on top of one that no longer holds.

**Questions to the human speak the domain language.** A human engages with capabilities and concepts — the project's ubiquitous language (`CONTEXT.md`) — not with file paths; prose dense with code references pushes them out of the decision instead of into it. Reading the code is the agent's job; the human gets the digest. When they ask to see the source, it arrives as verified `path:line` references they can open in their editor.

**Work merges the way a team's does.** Every piece is a change proposed for the effort branch, gated by required statuses — CI, the change's format, and the two reviewers' verdicts — and merged by the gate, never by an agent: a git hook refuses any other move of the branch. The effort comes back as one branch you review and merge.

**Pieces are vertical slices, built in parallel.** A piece is a narrow but complete path through every layer, not a horizontal layer, built in its own worktree by its own workflow. Never merge on red: CI is a required check, and the build workflow waits for it and fixes it. However many pieces are in flight, builds and tests queue for a fixed number of host-wide build slots.

**Review runs on two axes that are never merged.** Standards and Spec are reviewed by separate sub-agents and reported side by side — code can pass one axis and fail the other, and a single ranked list lets one axis mask the other. Every outcome is recorded on the change, so no finding is re-asked across review rounds.

**Standards live in `CONVENTIONS.md`, and the loop sharpens it.** Reviewable coding standards get one canonical home — `CONVENTIONS.md` at the repo root, with per-directory files as deltas in monorepos, nearest scope winning (the `conventions` skill holds the convention; repos without one fall back to whatever standards docs exist). Adopted pervasive-pattern findings append their rediscovered rule there, so judgement calls review keeps re-finding become documented standards the next round enforces — the standards doc gets sharper every lap. `CLAUDE.md` points at it, never duplicates it.

**Tests follow the repo, proof follows the user.** Agents test the way the repo's `TESTING.md` says, with no test-first rule; what proves a piece is driving its behaviors through the verify skill. `/tdd` is there when you want red–green at seams agreed up front.

## The assumptions

What must be true of your project and working style for this workflow to fit:

- **Your CI runs as commands on your machine.** `/wayfinder` needs git and Python 3 and nothing hosted: the charter lists the CI jobs as shell commands, and `wf.py` supplies the tracker, the changes, the statuses, the branch protection, and the gate that runs CI and merges. The `issue-tracker` skill defines the tracker contract the other skills speak, on GitHub or in local markdown.
- **The effort is bigger than one context window.** That's what the plan is for. If the whole thing fits one session, Shape tells you to use `/iterate` instead.
- **You can state your principles.** Agents decide against the destination, principles, and design you give at setup; where you can't yet say which way you lean on the effort's big trade-offs, the decisions will escalate or drift. A feature whose shape you need to discover by building it belongs in `/iterate`.
- **Your app can be driven by an agent.** Done is proven through a `verify-<app>` skill that launches the real app and exercises it the way a user does. A `TESTING.md` (the `testing` skill holds the convention) tells agents which slice of the suite a change has to pass.
- **Fan-outs never inherit the session's model by accident.** Every spawned agent runs on a tier — executors (mechanics, verification drives, PRs) default to Sonnet; deciders (builders, reviewers, validators, spikes), auditors (the run-once reads whose misses nothing catches, like Close's whole-diff review), and planners (planning, reconsidering decisions) default to the session's model unless a policy file pins them. Put `decider: opus`, `auditor: fable`, and `planner: fable` in `~/.claude/model-policy.md` to run them there.
- **Sessions are disposable; only the store and the repo are durable.** Anything worth keeping lands on an issue or change before context clears, so a restarted lead picks the effort up cold.
- **Concurrency is normal.** Many workflows write the store at once, each write under its lock; one lead per effort, one claim per workflow, and each record having a single writer keep them from colliding.

## Standalone skills

Used by the workflow, and useful on their own:

- **grilling** — you lay out your picture first, then it holds a position on one decision at a time until the design holds; facts get looked up, never asked
- **seed** — `/seed <idea>` parks an idea for a future `/iterate` effort as a tracker ticket, outside every worktree; `/seed <ticket>` preps its Destination further
- **triage** — `/triage <feedback>` turns a batch of client, tester or playtest feedback into work: one item per change, each checked against the code (catching what the reporter meant versus what's there), sorted into fixes, defects, design calls and questions for the reporter, each defect given a "reproduce and fix, or else instrument" goal, and a message to the reporter drafted; it then kicks off an `/iterate` effort from it, or adds the items to the effort already running
- **snag** — `/snag <what went wrong>` in any session files the friction, with the session's transcript and skill version, to `~/.claude/snags/` and carries on
- **autopsy** — run here: trace open snags, or a sweep of a skill's recent transcripts, back to the skill text that caused them, replay each one as an eval against the version that ran, and fix that text with your sign-off, the before/after run in front of you
- **rsi** — run here weekly: grade the sessions since the last run — Claude Code, Codex, Warp, Pi, Grok Build, ZCode and Hermes, sub-agent sessions and the agents a workflow spawns included, through skill-doctor's vendored collector — on efficiency, code quality, procedure compliance and verbosity (rubrics adapted from Warp's skill-doctor), track each skill's grades run over run in `.rsi/history.jsonl`, and file every failure one of these skills caused as a snag for `/autopsy` — so the loop finds friction you never stopped to flag, and the next run shows whether the fixes moved the grades. In this repo, a session-start reminder says when a run is a week overdue or snags are waiting
- **maintain-iterate** — run here whenever a batch of slices has gone by: a reader per `/iterate` session since the last pass, its build and review workflows timed, recurring friction and waste traced to the skill text behind it, and the fixes you pick applied
- **wait-what** — stop and re-pitch the last message in plain language, using the project's ubiquitous language
- **domain-modeling** — build and sharpen the project's domain model (`CONTEXT.md`, ADRs)
- **design** — decide the shape of code before it's built — module boundaries, interfaces, data shapes, and the seams tests will live at — captured as contract snippets that flow into the spec
- **codebase-design** — shared vocabulary for deep modules: module, interface, depth, seam, adapter, leverage, locality
- **prototype** — throwaway code that answers a design question (a shareable single-file HTML logic demo, or switchable UI variants)
- **wizard** — generate an interactive bash wizard that walks a human through steps only they can perform (credentials, provisioning, cutovers)
- **baseline** — `/baseline` seeds a repo with the default rules — mise for every command, the lint gate, comment and test standards, the doc set — from global defaults plus one file per language (Rust today), so the repo enforces them itself; run it again to bring a seeded repo back to the defaults
- **create-verification-skill** — generate a `verify-<app>` skill per app (monorepo apps included, all in the root `.claude/skills/`) that launches the real app, drives it the way a user does, and captures evidence, seeded with a feature map and proved by one end-to-end run before hand-off
- **maintain-verification-skill** — the upkeep pass for a verification skill: one source reader per feature, one live pass driving every feature, and at most one PR of proven map and harness corrections, with product regressions reported to you instead of papered over
- **research** — background-agent research against primary sources, captured as a cited markdown file in the repo
- **tdd** — the red–green loop, seams, mocking guidance, and test anti-patterns
- **evals** — test whether skill text changes what an agent does: cases under `evals/<skill>/`, graded by lookups before judgement, run through one script that also A/Bs a skill edit against the text at `HEAD` and replays real sessions with either side's skill text
- **writing-for-agents** — reference for writing documents agents consume: skills, `AGENTS.md`/`CLAUDE.md`, and the docs they point at
- **cold-read** — repair a document many agent sessions have edited so it reads to someone holding only the doc and what it points at: ghosts, broken pointers, changelog prose, aliases, undefined terms, residue, stale caches, contradictions — every repair proved by a lookup, only the rest asked
- **tend** — keep the repo's defined docs (`CONVENTIONS.md`, `TESTING.md`, `PRINCIPLES.md`, `CONTEXT.md`, `CONTEXT-MAP.md`, ADRs) clean and on purpose, as a document gate: cold-read's defects plus each owning skill's `TENDING.md` checks — misfiled entries, uncheckable or tool-enforced rules, dead test commands, copies where deltas belong — provable repairs landed, the rest asked. `/diff-review` and `/wayfinder`'s Close run it `--since` the change, so the docs a change bears on are cleaned as part of the work; `/tend` alone sweeps the whole repo
- **diff-review** — review any branch, PR, or diff since a fixed point; works outside the chain with any issue as the Spec source
- **finding-pipeline** — the find → validate → propose → validate → route contract every review gate above runs; consult it when authoring or resuming one
- **hitl-questions** — the presentation contract for every question put to the human: the opening where the human states their design before the agent proposes anything, facts vs decisions, cold-reader blocks, one topic per block, domain language, recommendations, escape hatches
- **multiplexer** — open a hand-off session or a side pane in whichever agent multiplexer you're running inside (Herdr or Rex), or carry on without one; `/iterate` kickoff and `/wayfinder`'s Shape hand their effort to a session of its own through it, and the lead opens its status pane with it
- **issue-tracker** — the tracker contract every workflow skill speaks, with GitHub and local-markdown implementations and a per-repo override
- **model-policy** — which model every spawned agent runs on: four tiers (executor, decider, auditor, planner) resolved from `.claude/model-policy.md`, then `~/.claude/model-policy.md`, then defaults — so a session on an expensive model never fans it out by accident
- **deciding** — the contract for an agent deciding on your behalf: the grounds it cites, the decision record, the three escalation cases, friction notes, agent-answered gates
- **principles** — where a repo's core principles and reference solutions live (`PRINCIPLES.md`, per-directory deltas, plan-specific additions), the rules agents decide against
- **conventions** — where a repo's reviewable coding standards live (`CONVENTIONS.md`, per-directory deltas, nearest scope wins) and how reviewers find them
- **testing** — where a repo's test recipes live (`TESTING.md`, per-directory deltas, nearest scope wins) and how implementing agents scope a test run to the change instead of running everything

## Output styles

The plugin ships one output style, selectable with `/output-style`:

- **Simple** — short plain prose a cold reader can follow: lead with the answer, no bullet walls, no headers, no preamble

## Install

```
claude plugin marketplace add scottlivingston/claude-skills
claude plugin install scott-skills@claude-skills
```

Update after pushing changes:

```
claude plugin marketplace update claude-skills
```
