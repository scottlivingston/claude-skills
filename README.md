# claude-skills

An opinionated, end-to-end workflow for Claude Code: take a loose idea, chart the unknowns as decision tickets on your issue tracker, resolve them, distill the decisions into a spec, break the spec into a DAG of implementation tickets, then implement the DAG with parallel agents — with the human in the loop only where a human is actually needed.

Packaged as a Claude Code plugin (`scott-skills`).

## The workflow

```mermaid
sequenceDiagram
    actor Human
    participant Claude as Claude session
    participant Tracker as Issue tracker
    participant Agents as Background agents

    rect rgba(128,128,128,0.08)
    Note over Human,Agents: Plan
    Human->>Claude: /wayfinder — a loose idea
    Claude->>Tracker: create the map + first decision tickets
    loop until the map is complete
        par human-in-the-loop tickets
            Human->>Claude: /wayfinder &lt;map&gt;
            Claude->>Human: resolve one ticket together (grilling, prototype)
            Claude->>Tracker: record the decision, add newly visible tickets
        and AFK tickets
            Human->>Claude: /drain &lt;map&gt;
            Claude->>Agents: one agent per research/task ticket
            Agents->>Tracker: post answers, close tickets
        end
    end
    end

    rect rgba(128,128,128,0.08)
    Note over Human,Agents: Specify
    Human->>Claude: /to-spec &lt;map&gt;
    Claude->>Tracker: publish the spec issue, close the map
    Human->>Claude: /to-tickets &lt;spec&gt;
    Claude->>Human: quiz — approve the ticket breakdown
    Claude->>Tracker: publish tickets as sub-issues with blocking edges
    end

    rect rgba(128,128,128,0.08)
    Note over Human,Agents: Build
    Human->>Claude: /ship &lt;spec&gt;
    loop each wave of unblocked tickets
        Claude->>Agents: one agent per ticket, isolated worktrees
        Agents->>Claude: implemented + reviewed diffs
        Claude->>Claude: merge serially, test each merge
        Claude->>Tracker: close tickets with commit links
    end
    end

    rect rgba(128,128,128,0.08)
    Note over Human,Agents: Review & merge
    Human->>Claude: /two-axis-review
    Claude->>Human: Standards + Spec findings, side by side
    Claude->>Tracker: PR that closes the spec issue
    end
```

Each skill ends by pointing at the next, so any session tells you where you are in the chain. You can also enter partway: `/to-spec` with no argument specs the current conversation, `/to-tickets` can break down any plan, and `/implement` is the manual alternative to `/ship` — one frontier ticket at a time, same discipline, clearing context between tickets.

Everything is coordinated through the repo's issue tracker — GitHub issues by default, with a local-markdown fallback for repos without a remote. `skills/issue-tracker.md` holds the shared wiring; a repo-level tracker doc can override it.

## The opinions

**The tracker is the memory, not the chat.** A big effort outlives any one context window, so all durable state — the map, decisions, the spec, tickets, blocking edges, claims — lives on the issue tracker. Any session (or any teammate) can pick up from the tracker alone; conversations are disposable. Claims are just issue assignment, so concurrent sessions don't collide, and blocking uses the tracker's native dependency links so the frontier is visible in the tracker's own UI.

**Planning produces decisions, never deliverables.** Wayfinder tickets resolve *decisions*; implementation tickets never belong on a map. When resolving a question surfaces "now build X", that's the fog clearing — record the decision that makes X buildable and leave the building to `/ship`. The pull to just start coding is treated as the signal that planning is done.

**Don't chart what you can't see.** The map is deliberately incomplete. A question becomes a ticket only when it can be *stated* precisely (not answered — stated); everything dimmer stays in a "Not yet specified" section and graduates into tickets as resolutions clear the fog. Scope is fixed by naming the destination first, and anything beyond it is ruled out of scope explicitly rather than left ambient.

**Everything is sized to a context window.** Each ticket — planning or implementation — is sized to one fresh agent session. Wayfinder resolves at most one ticket per session; ship never gives two tickets to one agent. Fresh context per unit of work is the point, not an inconvenience.

**Human time goes only where a human is needed.** Every planning ticket is typed HITL (grilling, prototypes, human-gated tasks) or AFK (research, agent-doable tasks). `/drain` runs the AFK frontier in parallel background agents while the human sits only in the live conversations — and an agent must never stand in for the human's side of a HITL ticket.

**Approval gates are explicit, and downstream stages don't improvise.** The human approves the implementation breakdown in the `/to-tickets` quiz; after that, `/ship` makes no product decisions. When an agent hits a decision the spec doesn't hold, it parks the ticket, reports the gap on the spec issue, and the run continues around it.

**Implementation is vertical slices, in parallel, merged serially.** Tickets are tracer bullets — narrow but complete paths through every layer, demoable alone — not horizontal layers. (Wide mechanical refactors are the one exception, sequenced as expand–contract.) Ship runs a fresh agent per frontier ticket in an isolated git worktree, reviews each diff, then merges worktrees one at a time with tests after each merge. Never merge on red.

**Review runs on two axes that are never merged.** Standards (does the code follow this repo's conventions, plus a fixed Fowler code-smell baseline?) and Spec (does it do what the issue asked?) are reviewed by separate sub-agents and reported side by side — code can pass one axis and fail the other, and a single ranked list lets one axis mask the other.

**Tests live at pre-agreed seams.** `/tdd` is red–green at public interfaces confirmed with the user up front — behavior over implementation details, one test → one implementation, never a bulk test suite written ahead of the code.

## Standalone skills

Used by the chain, and useful on their own:

- **grilling** — relentless one-question-at-a-time interview to stress-test a plan; facts get looked up, decisions get asked
- **domain-modeling** — build and sharpen the project's domain model (`CONTEXT.md`, ADRs)
- **prototype** — throwaway code that answers a design question (interactive logic harness, or switchable UI variants)
- **research** — background-agent research against primary sources, captured as a cited markdown file in the repo
- **tdd** — the red–green loop, seams, mocking guidance, and test anti-patterns

## Install

```
claude plugin marketplace add scottlivingston/claude-skills
claude plugin install scott-skills@claude-skills
```

Update after pushing changes:

```
claude plugin marketplace update claude-skills
```
