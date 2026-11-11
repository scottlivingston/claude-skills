# claude-skills

An opinionated, end-to-end workflow for Claude Code: take a loose idea, set its destination, principles, and high-level design with you, then let agents build it on their own — planning it as a graph of pieces on your issue tracker, proving only the risks that could sink it, building every ready piece in parallel with each wave verified on two axes, making the detailed calls as they go with each decision citing the principle, design, or prior art that settled it, and reviewing their own decisions every round so a bad call is corrected before more is built on it. You are pulled back only for the few calls that are genuinely yours.

Packaged as a Claude Code plugin (`scott-skills`).

## The workflow

A loose idea goes in; running code comes out.

### 1. Set it up — `/wayfinder <idea>`

Setup is the one session that is yours. Wayfinder grills you to pin down the **destination** — the working thing, what you'll run when it's done, and the check that shows it runs — the **principles** the effort's calls should follow (kept in the repo's `PRINCIPLES.md`, or on the plan where they bind this effort only), the **high-level design**, and the run's limits: whether it may merge, which machines and services agents may use, and the tasks only you can do. The test of done is that the agent can predict your call on the hardest decisions it can foresee. Then it writes the **plan** — a spec issue on your tracker whose children are **pieces** of code, each sized to one agent session, with blocking edges only where one piece needs another's code — plus the **risks** that need proving first. It hands the plan to a session of its own and you walk away.

### 2. The run — rounds until it runs

One conductor session runs **rounds**, never asking whether to go on. Each round builds every ready piece as one `/ship` wave — parallel agents in isolated worktrees, never more builds and tests at once than the machine's build slots allow, serial merges, never on red, the merged diff verified on the Spec and Standards axes — while a spike agent works each open risk beside it. Then it checks the thing still runs, and a replan agent folds what was learned into the plan: what runs now, spike answers recorded as decisions, parked pieces' gaps filled, new pieces the landed code makes visible. Every round must land code or retire a risk; one that does neither is a stall, diagnosed and escalated, never repeated.

**Prove what could sink it, guess the rest.** A question becomes a risk only when building on a wrong guess would waste real work. Everything else is decided by best guess — the call the principles and design most plainly imply — by whichever agent needs it, and the code corrects it if it was wrong. A spike answers one question and stops. **Foundations first, then wide**: pieces are cut along the design's seams so most need only the foundations, and everything ready builds in the same round.

**Agents decide, citing their grounds.** Every call follows the `deciding` contract: a **decision record** citing the principle, the design line, the prior art, or the earlier decision that settled it, with what it rejected and whether it's a one-way door. A call one piece needs lives on that piece; a call several pieces share becomes a plan decision before they build. You are pulled in for exactly three cases — no grounds settle it, it's a one-way door, or it would change your principles or design — and for your tasks. Each is posted durably and push-notified, and the run builds around it while it waits.

### 3. Catch compounding — friction, reconsideration, plan review

Autonomy's characteristic failure is a confident early call that later code quietly builds around. Three mechanisms catch it:

- **Friction notes.** When any agent has to bend around an earlier decision with a special case, an exception, or a workaround, it posts a note on that decision instead of absorbing it.
- **Plan review.** Every round, in the background beside the next build, one cross-read holds the decisions made since the last review against each other, the principles, the design, and the code — contradictions, broken inputs, calls built around without a note, decisions resting on facts since disproved, over-proving — through the finding pipeline.
- **Reconsideration.** A decision with friction from real code, a review tension, or two notes from anything else is re-read against everything that rests on it. A replacement is attacked by a fresh agent before it applies; code already built on the old call gets a **rework piece**, so a bad call costs at most the rounds before it was caught.

### 4. Finish

When nothing is open, ship's closing pass re-reads the **whole branch diff** — hunting the cross-wave drift no single wave could see, checking every requirement landed somewhere. With merge authorization, a clean pass squash-merges; without it, the PR is offered. `/wayfinder <plan>` resumes the run from the tracker in any session.

## The spec chain: `/next`

For a feature you'd rather spec yourself, the older chain still runs on its own: **`/specify`** turns the current conversation into a spec, **`/spec-review`** reads it whole and grounds it against the code, **`/tickets`** breaks it into a DAG of tracer-bullet tickets you approve in a quiz, and **`/ship`** builds it wave by wave. Invoke **`/next`** each session and it queries where the spec stands and runs that stage — one unit of work per invocation; **`/next auto <spec> [merge]`** conducts every stage to the PR, pausing only for escalations.

## The other way: `/iterate`

`/wayfinder` hands decisions to agents under rules you set up front, which earns its cost on a big effort whose principles you can state. `/iterate` is the human-driven spine beside it: you make the decisions **just in time**, one slice at a time, and the next slice is chosen from what the last one taught.

`/iterate <idea>` kicks off an effort: a short conversation that stops once what you want fits in a confirmed **Destination** paragraph, with early detail parked in a **Fog** list instead of settled. After that, each `/iterate` runs one slice:

1. **Choose** — the agent proposes the next slice and you push back; it's the biggest step one build can carry toward the destination, or, while the way is unclear, the step that teaches how to build it, and the first is a tracer bullet. A slice you shaped ahead while the last one built is the default pick. A slice is a *build*, a *spike* (`/prototype`, for when you know what but not how), or *research*.
2. **Shape** — grill only the decisions this slice's build needs; anything a later slice needs goes to the Fog. Anything the build needs from outside the repo — a service, a credential, a browser — is proved reachable first. Ends in a short brief: what it delivers, how you'll know it's done, what's left out — and, for a small low-risk slice, whether its review waits to be folded into the next slice's.
3. **Build** — a background workflow builds the brief test-first, so the grilling session never holds the implementation: one implementer for a brief that must happen in order, or one per independent part in its own worktree, planned, collision-checked, and merged onto the effort branch the way `/ship` runs a wave — each merge running the tests once — then a check agent runs every done-when check it can on the merged result, passing only what it saw itself. A part blocked by its environment rather than its brief is unblocked by the session, not sent back to shaping.
4. **Review** — `/diff-review` against the slice's brief (and any deferred slices' briefs), with the effort log left out of the diff, its questions saved to a gate file beside the log and its answers landing as decisions on the slice. While its pipeline runs in the background, you and the agent hold Reflect's conversation about what landed.
5. **Reflect** — you look at it running, with the check results in hand; a few-line tweak you ask for is made on the spot, anything bigger becomes the next slice, and what you learned rewrites the log's picture of where things stand and reshapes the Fog. Each slice is one session: only once it closes does the agent recommend `/clear` before the next `/iterate`.

The memory is an **effort log** in the repo (`docs/efforts/<slug>/` by default) — an index of the destination, the state and the fog, plus one file per slice, so a session reads only what the current slice needs — written the moment anything settles and committed before every build, so a lost session costs at most the exchange in flight and `/iterate` resumes from whatever stage the last slice reached. Each effort runs in its own gitignored worktree at `.claude/worktrees/<slug>/` inside the repo, which build agents merge their work into, so several efforts can be under way at once, all visible from the main checkout in your editor, while the main checkout stays free. Run inside an agent multiplexer — [Herdr](https://herdr.dev) or Rex — kickoff opens the new worktree as its own workspace and hands the effort to a fresh Claude Code session there. An idea that turns up mid-effort but belongs to an effort of its own goes to `/seed`, which parks it as a ticket marked `effort-seed`; `/iterate <ticket>` later kicks off from it. The opinions below are the map chain's; apart from seeds, `/iterate` keeps the tracker out of the loop and trades the up-front map for a slice at a time.

## The opinions

**The tracker is the memory, not the chat.** A big effort outlives any one context window, so all durable state — the plan, decisions, the spec, tickets, blocking edges, claims — lives on the issue tracker. Any session (or any teammate) can pick up from the tracker alone; conversations are disposable. Claims are just an `in-progress` label, so concurrent sessions don't collide, and blocking uses the tracker's native dependency links so the frontier is visible in the tracker's own UI.

**Running code is the measure.** Plans, decisions, and reviews exist only to get the right code built. A question earns proving only if a wrong guess would waste real work; everything else is a best guess the code corrects. A round that lands nothing is a stall to diagnose, never a lap to repeat.

**Everything is sized to a context window.** Each piece or ticket is sized to one fresh agent session, and ship never gives two to one agent. Fresh context per unit of work is the point, not an inconvenience.

**The human sets the rules; agents make the calls.** Your time goes into the destination, the principles, and the design — the inputs every decision stands on — and into the three kinds of call no input can settle: a question the grounds leave open, a one-way door, and a change to the inputs themselves. Everything else is decided by agents, and every decision cites the principle, design line, prior art, or earlier decision that settled it, so any call can be audited and overridden after the fact.

**Strain is reported, never absorbed.** A later decision that has to bend around an earlier one says so on the earlier one, and accumulated strain triggers a reconsideration that plans the correction across everything that rests on the decision. Correcting a decision is routine work, not a failure — what the workflow refuses is building quietly on top of one that no longer holds.

**Questions to the human speak the domain language.** A human engages with capabilities and concepts — the project's ubiquitous language (`CONTEXT.md`) — not with file paths; prose dense with code references pushes them out of the decision instead of into it. Reading the code is the agent's job; the human gets the digest. When they ask to see the source, it arrives as verified `path:line` references they can open in their editor.

**Approval gates are explicit, and downstream stages don't improvise.** The human approves the implementation breakdown — in the `/tickets` quiz, or by delegating that approval to the DAG critic when `/next auto` conducts; after that, `/ship` makes no product decisions. When an agent hits a decision the spec doesn't hold, it parks the ticket and reports the gap rather than guessing, and the gap is decided under the `deciding` contract like any other call.

**Implementation is vertical slices, in parallel, merged serially.** Tickets are tracer bullets — narrow but complete paths through every layer, demoable alone — not horizontal layers. (Wide mechanical refactors are the one exception, sequenced as expand–contract.) Fresh agent per ticket in an isolated worktree, one merge at a time, tests after each merge. Never merge on red, and a run the merge agent didn't see finish isn't green. However many agents a wave runs, builds and tests queue for a fixed number of host-wide build slots, so the machine runs a few builds at a time instead of all of them.

**Review runs on two axes that are never merged.** Standards and Spec are reviewed by separate sub-agents and reported side by side — code can pass one axis and fail the other, and a single ranked list lets one axis mask the other. Every outcome is recorded in a summary on the spec, so no finding is re-asked across waves or review rounds.

**Standards live in `CONVENTIONS.md`, and the loop sharpens it.** Reviewable coding standards get one canonical home — `CONVENTIONS.md` at the repo root, with per-directory files as deltas in monorepos, nearest scope winning (the `conventions` skill holds the convention; repos without one fall back to whatever standards docs exist). Adopted pervasive-pattern findings append their rediscovered rule there, so judgement calls review keeps re-finding become documented standards the next round enforces — the standards doc gets sharper every lap. `CLAUDE.md` points at it, never duplicates it.

**Tests live at pre-agreed seams.** `/tdd` is red–green at seams agreed up front — with the user live, or inherited from the spec's Seams-under-test list when agents run alone — behavior over implementation details, one test → one implementation, never a bulk test suite written ahead of the code.

## The assumptions

What must be true of your project and working style for this workflow to fit:

- **You have an issue tracker with labels, sub-issues, and blocking links.** GitHub issues by default (via `gh`); a local-markdown fallback exists for repos without a remote. The `issue-tracker` skill defines the tracker contract every skill speaks; a repo can swap in its own tracker with a `.claude/issue-tracker.md` implementing that contract — fully, or as a delta over the default ("as GitHub, except…").
- **The effort is bigger than one context window.** That's what the plan is for. If the whole thing fits one session, wayfinder tells you to skip the plan and just do the work.
- **You can state your principles.** Agents decide against the destination, principles, and design you give at setup; where you can't yet say which way you lean on the effort's big trade-offs, the decisions will escalate or drift. A feature whose shape you need to discover by building it belongs in `/iterate`.
- **You work in a git repo with a test suite you trust.** Ship implements in isolated worktrees and gates every serial merge on green tests; without meaningful tests, "never merge on red" protects nothing. A `TESTING.md` (the `testing` skill holds the convention) tells agents which slice of the suite a change has to pass, so a wave runs its crates' tests, not the world's.
- **Fan-outs never inherit the session's model by accident.** Every spawned agent runs on a tier — executors (implementers, merges, fixes, mechanics) default to Sonnet; deciders (deciding agents, reviewers, validators and refuters, planners, research agents) and auditors (the few run-once reads whose misses nothing catches: labeling, the spec grounding read, the plan review's cross-read, the closing pass) default to the session's model unless a policy file pins them. Put `decider: opus` and `auditor: fable` in `~/.claude/model-policy.md` and a session on any model reviews on Opus and audits on Fable.
- **Sessions are disposable; only the tracker is durable.** Anything worth keeping must land on an issue before context clears. The flip side: any session — yours, a teammate's, a background agent's — can pick up the effort cold.
- **Concurrency is normal.** Parallel agents and sessions edit the tracker at the same time; claims (`in-progress`), a single conductor per plan, and reconciling before each round are what keep them from colliding.

## Standalone skills

Used by the chain, and useful on their own:

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
- **create-verification-skill** — generate a `verify-<app>` skill per app (monorepo apps included, all in the root `.claude/skills/`) that launches the real app, drives it the way a user does, and captures evidence, seeded with a feature map and proved by one end-to-end run before hand-off
- **maintain-verification-skill** — the upkeep pass for a verification skill: one source reader per feature, one live pass driving every feature, and at most one PR of proven map and harness corrections, with product regressions reported to you instead of papered over
- **research** — background-agent research against primary sources, captured as a cited markdown file in the repo
- **tdd** — the red–green loop, seams, mocking guidance, and test anti-patterns
- **evals** — test whether skill text changes what an agent does: cases under `evals/<skill>/`, graded by lookups before judgement, run through one script that also A/Bs a skill edit against the text at `HEAD` and replays real sessions with either side's skill text
- **writing-for-agents** — reference for writing documents agents consume: skills, `AGENTS.md`/`CLAUDE.md`, and the docs they point at
- **cold-read** — repair a document many agent sessions have edited so it reads to someone holding only the doc and what it points at: ghosts, broken pointers, changelog prose, aliases, undefined terms, residue, stale caches, contradictions — every repair proved by a lookup, only the rest asked
- **tend** — keep the repo's defined docs (`CONVENTIONS.md`, `TESTING.md`, `PRINCIPLES.md`, `CONTEXT.md`, `CONTEXT-MAP.md`, ADRs) clean and on purpose, as a document gate: cold-read's defects plus each owning skill's `TENDING.md` checks — misfiled entries, uncheckable or tool-enforced rules, dead test commands, copies where deltas belong — provable repairs landed, the rest asked. `/diff-review` and `/ship`'s finish run it `--since` the change, so the docs a change bears on are cleaned as part of the work; `/tend` alone sweeps the whole repo
- **diff-review** — review any branch, PR, or diff since a fixed point; works outside the chain with any issue as the Spec source
- **finding-pipeline** — the find → validate → propose → validate → route contract every review gate above runs; consult it when authoring or resuming one
- **hitl-questions** — the presentation contract for every question put to the human: the opening where the human states their design before the agent proposes anything, facts vs decisions, cold-reader blocks, one topic per block, domain language, recommendations, escape hatches
- **multiplexer** — open a hand-off session or a side pane in whichever agent multiplexer you're running inside (Herdr or Rex), or carry on without one; `/iterate` kickoff and wayfinder setup hand their effort to a session of its own through it
- **issue-tracker** — the tracker contract every workflow skill speaks, with GitHub and local-markdown implementations and a per-repo override
- **model-policy** — which model every spawned agent runs on: three tiers (executor, decider, auditor) resolved from `.claude/model-policy.md`, then `~/.claude/model-policy.md`, then defaults — so a session on an expensive model never fans it out by accident
- **deciding** — the contract for an agent deciding on your behalf: the grounds it cites, the decision record, the three escalation cases, friction notes, agent-answered gates
- **principles** — where a repo's core principles and reference solutions live (`PRINCIPLES.md`, per-directory deltas, plan-specific additions), the rules agents decide against
- **conventions** — where a repo's reviewable coding standards live (`CONVENTIONS.md`, per-directory deltas, nearest scope wins) and how reviewers find them
- **testing** — where a repo's test recipes live (`TESTING.md`, per-directory deltas, nearest scope wins) and how implementing and shipping agents scope a test run to the change instead of running everything

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
