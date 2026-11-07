# claude-skills

An opinionated, end-to-end workflow for Claude Code: take a loose idea, set its destination, principles, and high-level design with you, chart the unknowns as decision tickets on your issue tracker, let agents resolve them — each decision citing the principle, design, or prior art that settled it, and each strain on an earlier decision triggering a planned correction — partition the decisions into shippable slices as the delivery order becomes clear, then take each slice on its own schedule — cross-read for coherence, distil into a spec, review that spec against the code, break it into implementation tickets, and ship them wave by wave with parallel agents, every wave verified on two axes — until a closing pass comes back clean. You are pulled back only for the few calls that are genuinely yours.

Packaged as a Claude Code plugin (`scott-skills`).

## The workflow

A loose idea goes in; a PR that closes its spec comes out.

### 1. Chart the map — `/wayfinder`

Charting is the one session that is yours by design. Wayfinder grills you to pin down three things: the **destination** — the spec, decision, or change the effort is finding its way to; the **principles** the effort's decisions should follow, kept in the repo's `PRINCIPLES.md` (or on the map, where they bind this effort only) along with the existing systems it should resemble; and the **high-level design** — the major parts and how they relate. The test of done is that the agent can predict your call on the hardest decisions it can foresee. Then it charts the way as a **map**: an issue on the repo's tracker whose child issues are **decision tickets**, wired with the tracker's native blocking links. The map is deliberately incomplete — a question becomes a ticket only when it can be *stated* precisely; everything dimmer waits in a "Not yet specified" section (the fog of war) and graduates into tickets as resolutions clear it. Anything past the destination is ruled out of scope explicitly.

### 2. Resolve the tickets — agents decide, citing their grounds

From here agents make the decisions. **`/drain`** works the whole frontier in rounds, each one workflow with an agent per ticket:

| Ticket type | Resolves |
| --- | --- |
| **Decision** | The default: a product or behaviour question |
| **Design** | The shape of code — module boundaries, interfaces, data shapes, the seams tests will live at — by `/design`'s method |
| **Prototype** | A question only seeing it run can answer — a throwaway via `/prototype`, judged against the grounds |
| **Research** | A question of fact — APIs, costs, how comparable systems solve it — as a cited markdown file that feeds a decision |
| **Task** | Work that must happen before a decision can be made |
| **Reconsider** | An earlier decision that later work has strained (step 3) |

Every agent decision follows the `deciding` contract: it is posted as a **decision record** that cites its grounds — the principle that settled it, the line of the design it serves, the prior art it copied, and the earlier decisions it **rests on**, which become blocking links so what depends on a decision is a tracker query. Only three cases come back to you, as an **escalation** drafted with options and a recommendation and push-notified: the grounds don't settle it, it's a one-way door (persisted data, public interfaces, anything outside the repo), or it would change your principles or design. Everything else carries on around an escalation while it waits.

Agents never edit the map body. Each record ends with the map changes it proposes — new questions, fog that graduates, filing — and the coordinating session **folds** them in one at a time, so the map has a single writer.

### 3. Catch compounding — friction, reconsideration, checkpoints

Autonomy's characteristic failure is a confident early call that later calls quietly build around. Three mechanisms catch it:

- **Friction notes.** When any agent — deciding, shipping, reviewing — has to bend around an earlier decision with a special case, an exception, or a workaround, it posts a friction note on that decision instead of absorbing it.
- **Reconsideration.** A decision with friction from real code, a note that it breaks a principle, or two notes from anything else gets a **reconsider** ticket, which blocks its open dependents meanwhile. That agent reads the decision, its friction, everything resting on it, and what has been learned since, and returns a correction plan: the decision stands, it's amended, or it's superseded — with each dependent marked unaffected or re-decide. A fresh agent that didn't write the plan tries to refute it before it applies. A superseded decision stays on its ticket for the audit trail, marked `superseded`; its dependents are reopened if not yet specced, amended into their spec if specced, or turned into follow-up tickets if already shipping.
- **Checkpoints.** Every six decisions, and whenever a slice ships, `/map-review` cross-reads the latest decisions against what they rest on — and what the shipped code taught — to catch the strains no single agent noticed.

### 4. Slice the map — the delivery partition

A map's decisions are ordered by what had to be *learned*; implementation is ordered by what *ships together*. So the map partitions its own decisions into **slices** — each a demoable outcome that becomes its own spec, its own tickets, its own ship run. A slice is a child issue of the map (labelled `wayfinder:slice`) whose body lists only *links* to the decisions it claims. Blocking edges between slices carry the ship order, and the resolutions that bind everything — error model, vocabulary, cross-cutting contracts — go to a **Map-wide decisions** bucket every slice's spec kernel inherits. Slices are **fog-shaped**: one is charted only when what it ships and what it needs first can be stated.

A **sealed** slice is one declared safe to spec while the rest of the map is still foggy — that is what lets shipping start before charting finishes. When no open ticket is still headed for a slice, the coordinator drafts the case — what it ships, and why none of the remaining fog lands in it — and an independent agent tries to refute it; a case that survives seals the slice. A later decision that turns out to belong to a sealed slice is routed like any correction. Small efforts skip all of this: an unsliced map completes as one unit and specs as one spec.

### 5. Review the map — `/map-review`

The map's decisions were made by separate agents, and no single context ever held all of them at once. `/map-review` reads them **together**, hunting only what no per-ticket agent could see: contradictions, early calls superseded by later context, gaps where the decisions don't compose into a clear route, undecided seams, misfilings, scope leaks, and drifted index gists. It runs in three modes: a **checkpoint** over the latest decisions while charting runs (step 3), on each **sealed slice** just before it becomes a spec (marking it `slice-reviewed`), and once on the **whole map** when charting finishes — the only read that can catch two slices deciding the same question differently. Findings run the shared finding pipeline (`finding-pipeline`): adversarially validated, provably derivable repairs auto-applied to the map under an audit digest, and tensions answered by an agent under the `deciding` contract — a tension that needs one side re-decided becomes a reconsideration. Only `deciding`'s three cases reach you.

### 6. Distill the spec — `/specify`

A sealed slice — the decisions it claims, plus the map-wide ones — is synthesized into a **spec issue**. No interview, no new decisions: `/specify` only writes down what the map already settled, and the slice is what bounds which decisions reach this spec at all. (An unsliced map specs whole, as one issue.) The map stays open until its last slice has a spec, so later slices are specced *after* earlier ones ship, against a codebase that has moved. Design-ticket resolutions carry their interface stubs and seams into the spec, so implementation inherits agreed contracts and a Seams-under-test list.

### 7. Review the spec — `/spec-review`

The spec is the last artifact before code, and everything downstream trusts it absolutely: `/tickets` routes its decisions without questioning them, and a `/ship` agent handed a decision that doesn't decide will invent the missing half. One session reads the spec **whole** — kernel plus every decision — and **grounds it against the codebase it claims to describe**, which is the check no other stage performs: decisions that name a question without settling it, claims about modules and prior art that stopped being true, behaviour no listed seam can observe, acceptance criteria no test can pass or fail, stories nothing serves and decisions nothing needs, contradictions and scope leaks. Findings run the same finding pipeline: derivable repairs (drift, stale links, disproven claims about the code, a body paragraph the spec's own decisions already settle) auto-apply under an audit digest. Stale counts and figures are derivable too — recounted against the tree and propagated through every figure and sentence that quoted them — because asking which of two numbers is authoritative when one of them is the code spends you on work the pipeline had already done. Every escalated defect arrives at a durable gate with a **drafted repair** — the amended line, the missing seam row — so you give a verdict on concrete text rather than answer an open question. Fixes are edits to the spec itself, never a review document, and a clean spec is marked `spec-reviewed`. It matters most for the specs that skipped the map entirely: on those, no gate has run at all.

### 8. Break it down — `/tickets`

The spec is broken into **implementation tickets** — vertical tracer-bullet slices, each sized to one fresh agent session, with blocking edges forming a DAG cut for parallelism: shallow waves, and same-wave tickets touching different files so parallel agents don't collide at merge time. An adversarial **DAG critic** re-tests every edge and checks which files each ticket will touch before any human sees the breakdown. Then the approval gate: you review the breakdown in a quiz (under `/next auto`, a critic-passed breakdown is auto-approved instead). After this gate, downstream stages make no product decisions.

### 9. Ship — `/ship`

Each **wave** of unblocked tickets runs as one dynamic workflow: a planner per ticket maps the approach against the branch as it stands, a fresh agent per ticket implements in an isolated git worktree, worktrees merge serially with the change's scoped tests after each merge (never merge on red), and the wave's integrated diff is verified along two axes that are never merged into one list — **Spec** (did the tickets deliver their acceptance criteria?) and **Standards** (does the code break a documented rule — canonically `CONVENTIONS.md`, with per-directory files scoping a monorepo's apps?). Findings are adversarially validated; survivors with uncontested fixes auto-apply (one revertable commit each) or become tickets riding the next wave. Questions about *intent* — the spec is silent on a case, two fixes compete, a pattern is repo-wide — are answered by an agent under the `deciding` contract on a spec that came from a map, and reach you only in its three escalation cases; on a spec from a conversation they reach you, one at a time in domain language. When an agent hits a decision the spec doesn't hold, it parks the ticket and reports the gap on the spec issue; the run continues around it, and the gap is filled the same way. (`/implement` is the manual alternative: one frontier ticket at a time, same discipline.)

### 10. Close the run

When no tickets remain, a closing pass re-reads the **whole branch diff** — hunting the cross-wave composition drift no single wave could see, checking every spec requirement landed somewhere — and raises everything deferred along the way. Answers and remaining findings become tickets that re-open the frontier, so shipping loops until a closing pass comes back clean; every outcome is recorded in a summary on the spec issue, so no finding is ever re-litigated and the loop converges. Then the PR that closes the spec issue is offered. (`/diff-review` is the standalone review for any branch, PR, or diff outside the run — the same two axes and auto-resolve routing, plus the full Fowler smell baseline on its Standards axis.)

## Driving it: `/next`

You don't memorize the chain. Start an effort with `/wayfinder <idea>`; after that, invoke **`/next`** each session. Because all state lives on the tracker, `/next` queries where the effort stands, announces the stage, and runs that stage's skill — exactly one unit of work per invocation, then it stops and says `/next` again. While the map is live it drains the agent frontier, folds in anything a previous session didn't, opens reconsiderations where friction has built up, and puts any waiting escalation to you.

**`/next auto <effort> [merge]`** conducts instead: from the charted map onward it drains, folds, checkpoints, reconsiders, and seals, and rolls each sealed slice through map-review → spec → spec-review → tickets → ship → closing — one slice at a time, in ship order — stopping only when nothing but escalations is left, every escalation posted durably to the tracker and push-notified, answerable in that session or any later one. The conductor delegates all heavy lifting (workflow fills, synthesis stages) to fresh subagents and holds only routing state, so one session can conduct an arbitrarily long run. Include the word `merge` and a clean closing pass ends with the PR squash-merged; without it, the run ends by offering the PR. A clean effort goes from charting session to merged specs with a handful of escalations.

You can also enter partway: `/specify` with no argument specs the current conversation — and `/spec-review` is what catches the defects that skipping the map would otherwise leave in it. `/tickets` can break down any plan, and `/diff-review` reviews any branch or diff since a fixed point.

## The other way: `/iterate`

The chain above hands decisions to agents under rules you set up front, which earns its cost on a big effort whose principles you can state. `/iterate` is the human-driven spine beside it: you make the decisions **just in time**, one slice at a time, and the next slice is chosen from what the last one taught.

`/iterate <idea>` kicks off an effort: a short conversation that stops once what you want fits in a confirmed **Destination** paragraph, with early detail parked in a **Fog** list instead of settled. After that, each `/iterate` runs one slice:

1. **Choose** — the agent proposes the next slice and you push back; it's the biggest step one build can carry toward the destination, or, while the way is unclear, the step that teaches how to build it, and the first is a tracer bullet. A slice you shaped ahead while the last one built is the default pick. A slice is a *build*, a *spike* (`/prototype`, for when you know what but not how), or *research*.
2. **Shape** — grill only the decisions this slice's build needs; anything a later slice needs goes to the Fog. Anything the build needs from outside the repo — a service, a credential, a browser — is proved reachable first. Ends in a short brief: what it delivers, how you'll know it's done, what's left out — and, for a small low-risk slice, whether its review waits to be folded into the next slice's.
3. **Build** — a background workflow builds the brief test-first, so the grilling session never holds the implementation: one implementer for a brief that must happen in order, or one per independent part in its own worktree, planned, collision-checked, and merged onto the effort branch the way `/ship` runs a wave — each merge running the tests once — then a check agent runs every done-when check it can on the merged result, passing only what it saw itself. A part blocked by its environment rather than its brief is unblocked by the session, not sent back to shaping.
4. **Review** — `/diff-review` against the slice's brief (and any deferred slices' briefs), with the effort log left out of the diff, its questions saved to a gate file beside the log and its answers landing as decisions on the slice. While its pipeline runs in the background, you and the agent hold Reflect's conversation about what landed.
5. **Reflect** — you look at it running, with the check results in hand; a few-line tweak you ask for is made on the spot, anything bigger becomes the next slice, and what you learned rewrites the log's picture of where things stand and reshapes the Fog. Each slice is one session: only once it closes does the agent recommend `/clear` before the next `/iterate`.

The memory is an **effort log** in the repo (`docs/efforts/<slug>/` by default) — an index of the destination, the state and the fog, plus one file per slice, so a session reads only what the current slice needs — written the moment anything settles and committed before every build, so a lost session costs at most the exchange in flight and `/iterate` resumes from whatever stage the last slice reached. Each effort runs in its own gitignored worktree at `.claude/worktrees/<slug>/` inside the repo, which build agents merge their work into, so several efforts can be under way at once, all visible from the main checkout in your editor, while the main checkout stays free. Run inside an agent multiplexer — [Herdr](https://herdr.dev) or Rex — kickoff opens the new worktree as its own workspace and hands the effort to a fresh Claude Code session there. An idea that turns up mid-effort but belongs to an effort of its own goes to `/seed`, which parks it as a ticket marked `effort-seed`; `/iterate <ticket>` later kicks off from it. The opinions below are the map chain's; apart from seeds, `/iterate` keeps the tracker out of the loop and trades the up-front map for a slice at a time.

## The opinions

**The tracker is the memory, not the chat.** A big effort outlives any one context window, so all durable state — the map, decisions, the spec, tickets, blocking edges, claims — lives on the issue tracker. Any session (or any teammate) can pick up from the tracker alone; conversations are disposable. Claims are just an `in-progress` label, so concurrent sessions don't collide, and blocking uses the tracker's native dependency links so the frontier is visible in the tracker's own UI.

**Planning produces decisions, never deliverables.** Wayfinder tickets resolve *decisions*; implementation tickets never belong on a map. When resolving a question surfaces "now build X", that's the fog clearing — record the decision that makes X buildable and leave the building to `/ship`. The pull to just start coding is treated as the signal that planning is done.

**Don't chart what you can't see.** A question becomes a ticket only when it can be *stated* precisely (not answered — stated); everything dimmer stays in the fog and graduates as resolutions sharpen it. Scope is fixed by naming the destination first, and anything beyond it is ruled out of scope explicitly rather than left ambient.

**The map is high-level; the specs are not the map.** A map is organized by what you had to learn, a spec by what ships together, and forcing one map into one spec is what makes specs too big to hold and shaped like the investigation rather than the rollout. Slices are the seam between the two altitudes: the map partitions itself into shippable outcomes as the delivery order becomes visible in the resolutions, and each slice specs, breaks down, and ships on its own schedule. A slice is sealed on a drafted case that an independent agent failed to refute.

**Everything is sized to a context window.** Each ticket — planning or implementation — is sized to one fresh agent session. Wayfinder resolves at most one ticket per invocation; ship never gives two tickets to one agent. Fresh context per unit of work is the point, not an inconvenience.

**The human sets the rules; agents make the calls.** Your time goes into the destination, the principles, and the design — the inputs every decision stands on — and into the three kinds of call no input can settle: a question the grounds leave open, a one-way door, and a change to the inputs themselves. Everything else is decided by agents, and every decision cites the principle, design line, prior art, or earlier decision that settled it, so any call can be audited and overridden after the fact.

**Strain is reported, never absorbed.** A later decision that has to bend around an earlier one says so on the earlier one, and accumulated strain triggers a reconsideration that plans the correction across everything that rests on the decision. Correcting a decision is routine work, not a failure — what the workflow refuses is building quietly on top of one that no longer holds.

**Questions to the human speak the domain language.** A human engages with capabilities and concepts — the project's ubiquitous language (`CONTEXT.md`) — not with file paths; prose dense with code references pushes them out of the decision instead of into it. Reading the code is the agent's job; the human gets the digest. When they ask to see the source, it arrives as verified `path:line` references they can open in their editor.

**Approval gates are explicit, and downstream stages don't improvise.** The human approves the implementation breakdown — in the `/tickets` quiz, or by delegating that approval to the DAG critic when `/next auto` conducts; after that, `/ship` makes no product decisions. When an agent hits a decision the spec doesn't hold, it parks the ticket and reports the gap rather than guessing, and the gap is decided under the `deciding` contract like any other call.

**Implementation is vertical slices, in parallel, merged serially.** Tickets are tracer bullets — narrow but complete paths through every layer, demoable alone — not horizontal layers. (Wide mechanical refactors are the one exception, sequenced as expand–contract.) Fresh agent per ticket in an isolated worktree, one merge at a time, tests after each merge. Never merge on red.

**Review runs on two axes that are never merged.** Standards and Spec are reviewed by separate sub-agents and reported side by side — code can pass one axis and fail the other, and a single ranked list lets one axis mask the other. Every outcome is recorded in a summary on the spec, so no finding is re-asked across waves or review rounds.

**Standards live in `CONVENTIONS.md`, and the loop sharpens it.** Reviewable coding standards get one canonical home — `CONVENTIONS.md` at the repo root, with per-directory files as deltas in monorepos, nearest scope winning (the `conventions` skill holds the convention; repos without one fall back to whatever standards docs exist). Adopted pervasive-pattern findings append their rediscovered rule there, so judgement calls review keeps re-finding become documented standards the next round enforces — the standards doc gets sharper every lap. `CLAUDE.md` points at it, never duplicates it.

**Tests live at pre-agreed seams.** `/tdd` is red–green at seams agreed up front — with the user live, or inherited from the spec's Seams-under-test list (fed by design tickets) when agents run alone — behavior over implementation details, one test → one implementation, never a bulk test suite written ahead of the code.

## The assumptions

What must be true of your project and working style for this workflow to fit:

- **You have an issue tracker with labels, sub-issues, and blocking links.** GitHub issues by default (via `gh`); a local-markdown fallback exists for repos without a remote. The `issue-tracker` skill defines the tracker contract every skill speaks; a repo can swap in its own tracker with a `.claude/issue-tracker.md` implementing that contract — fully, or as a delta over the default ("as GitHub, except…").
- **The effort is bigger than one context window.** That's what the map is for. If charting surfaces no fog — the whole journey fits one session — wayfinder tells you to skip the map and just do the work.
- **You can state your principles.** Agents decide against the destination, principles, and design you give at charting; where you can't yet say which way you lean on the effort's big trade-offs, the decisions will escalate or drift. A feature whose shape you need to discover by building it belongs in `/iterate`.
- **You work in a git repo with a test suite you trust.** Ship implements in isolated worktrees and gates every serial merge on green tests; without meaningful tests, "never merge on red" protects nothing. A `TESTING.md` (the `testing` skill holds the convention) tells agents which slice of the suite a change has to pass, so a wave runs its crates' tests, not the world's.
- **Fan-outs never inherit the session's model by accident.** Every spawned agent runs on a tier — executors (implementers, merges, fixes, mechanics) default to Sonnet; deciders (deciding agents, reviewers, validators and refuters, planners, research agents) and auditors (the few run-once reads whose misses nothing catches: labeling, the spec grounding read, the map cross-read, the closing pass) default to the session's model unless a policy file pins them. Put `decider: opus` and `auditor: fable` in `~/.claude/model-policy.md` and a session on any model reviews on Opus and audits on Fable.
- **Sessions are disposable; only the tracker is durable.** Anything worth keeping must land on an issue before context clears. The flip side: any session — yours, a teammate's, a background agent's — can pick up the effort cold.
- **Concurrency is normal.** Drain rounds and parallel sessions edit the tracker at the same time; claims (`in-progress`), a single map-writer per session, and reconcile-before-routing in `/next` are what keep them from colliding.

## Standalone skills

Used by the chain, and useful on their own:

- **grilling** — you lay out your picture first, then it holds a position on one decision at a time until the design holds; facts get looked up, never asked
- **seed** — `/seed <idea>` parks an idea for a future `/iterate` effort as a tracker ticket, outside every worktree; `/seed <ticket>` preps its Destination further
- **snag** — `/snag <what went wrong>` in any session files the friction, with the session's transcript and skill version, to `~/.claude/snags/` and carries on
- **autopsy** — run here: trace open snags, or a sweep of a skill's recent transcripts, back to the skill text that caused them, replay each one as an eval against the version that ran, and fix that text with your sign-off, the before/after run in front of you
- **rsi** — run here weekly: grade the sessions since the last run — Claude Code, Codex, Warp, Pi, Grok Build, ZCode and Hermes, sub-agent sessions included, through skill-doctor's vendored collector — on efficiency, code quality, procedure compliance and verbosity (rubrics adapted from Warp's skill-doctor), track each skill's grades run over run in `.rsi/history.jsonl`, and file every failure one of these skills caused as a snag for `/autopsy` — so the loop finds friction you never stopped to flag, and the next run shows whether the fixes moved the grades. In this repo, a session-start reminder says when a run is a week overdue or snags are waiting
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
- **multiplexer** — open a hand-off session or a side pane in whichever agent multiplexer you're running inside (Herdr or Rex), or carry on without one; `/iterate` kickoff and wayfinder charting hand their effort to a session of its own through it
- **issue-tracker** — the tracker contract every workflow skill speaks, with GitHub and local-markdown implementations and a per-repo override
- **model-policy** — which model every spawned agent runs on: three tiers (executor, decider, auditor) resolved from `.claude/model-policy.md`, then `~/.claude/model-policy.md`, then defaults — so a session on an expensive model never fans it out by accident
- **deciding** — the contract for an agent deciding on your behalf: the grounds it cites, the decision record, the three escalation cases, friction notes, agent-answered gates
- **principles** — where a repo's core principles and reference solutions live (`PRINCIPLES.md`, per-directory deltas, map-specific additions), the rules agents decide against
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
