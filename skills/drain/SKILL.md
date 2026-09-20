---
name: drain
description: Work all AFK tickets (research, agent-doable tasks) on a wayfinder map's frontier in parallel background agents, while the human handles the HITL tickets. Gathers evidence and unblocks decisions; never makes one, never reshapes the map. Use during charting to keep the AFK frontier moving. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

Drain the **AFK frontier** of a wayfinder map: every open, unblocked, unclaimed child ticket that an agent can work alone. HITL tickets (grilling, prototype, design, human-checklist tasks) are never touched — they belong to a live session with the human.

**Draining gathers evidence; it decides nothing.** Per the wayfinder skill, every decision on the map is a HITL ticket, and an AFK ticket exists to feed one. A drain agent's output is findings — cited facts and the options they leave open — posted on its ticket, which is then closed, unblocking the HITL ticket that will make the call. Nothing a drain session does changes the map's shape: no pointer in Decisions so far, no new tickets, no out-of-scope rulings, no slice filing, no edits to other tickets. Those are the human's moves, made in a live session on the evidence draining produced.

The user invokes with a map (URL or number). Read the wayfinder skill in this plugin for the map/ticket vocabulary, and invoke `/issue-tracker` for the tracker operations.

## Process

1. **Load the map** — Destination, Notes, Decisions so far. Query the frontier: open, unblocked, unclaimed ticket children.
2. **Select the AFK subset**: every frontier ticket labelled `afk`. A ticket missing its mode label gets one now — infer it from the type (research → `afk`, prototype/grilling/design → `hitl`); a task ticket with no mode label and no clear answer stays untouched — mis-claiming a HITL ticket wastes the claim. **Check each question is a question of fact.** One that asks for a choice ("which queue should we use?") is a decision wearing an `afk` label: swap it to `hitl`, leave it for the human, and say so in the report.
3. **Claim first, then spawn.** Claim each selected ticket (label it `in-progress`) before any work, then spawn one background agent per ticket, in parallel, on the **decider tier** per `/model-policy` (weighing sources is judgment) — pass `model` when the tier is pinned, and state the resolved model once before spawning. Each agent gets: the map's Destination and Notes, its ticket body, the names of the HITL tickets it blocks (so it knows what its findings will be used for), and the brief below.
4. **Check results as agents finish.** Confirm each finished ticket is closed with its findings comment, and note which HITL tickets it unblocked. The map body is not edited.
5. **Repeat**: closed tickets may have unblocked new AFK frontier. Loop steps 1–4 until the frontier holds no AFK tickets.
6. **Report**: evidence gathered (one line per ticket, by name), tickets that failed or turned out to be HITL, anything the findings suggest about the map's shape — a ticket that looks out of scope, fog that now looks specifiable, a question that needs splitting — offered as suggestions for the human's next live session, not applied — and the HITL tickets now on the frontier. That is the human's queue.

## The agent brief

- **Research ticket**: follow the `/research` skill shape — investigate against primary sources, write a cited markdown summary, link it from the ticket.
- **AFK task ticket**: do the work, then record what was done and the resulting facts (credentials location, new URLs, row counts) later tickets depend on.
- **Resolution comment**: the findings, and the options they leave open for the decision this ticket feeds. A recommendation is welcome, labelled as one; the choice itself is not made here.
- **Close the ticket** and remove the claim. Do NOT append to Decisions so far, and do NOT edit the map body or any other ticket.
- **Can't finish** (blocked on access, or the question turns out to need the human): do NOT close it. Unclaim it (remove `in-progress`) and post a comment saying what was found and why it stopped. The drain session swaps its mode label (`afk` → `hitl`) if that is what it turned out to be.
