---
name: drain
description: Work all AFK tickets (research, agent-doable tasks) on a wayfinder map's frontier in parallel background agents, while the human handles the HITL tickets. Use during charting to keep the AFK frontier moving.
disable-model-invocation: true
---

Drain the **AFK frontier** of a wayfinder map: every open, unblocked, unclaimed child ticket that an agent can resolve alone. HITL tickets (grilling, prototype, human-checklist tasks) are never touched — they belong to a live session with the human.

The user invokes with a map (URL or number). Read the wayfinder skill in this plugin for the map/ticket vocabulary, and `issue-tracker.md` in this plugin's `skills/` directory for the tracker operations.

## Process

1. **Load the map** — Destination, Notes, Decisions-so-far. Query the frontier: open, unblocked, unclaimed children.
2. **Select the AFK subset**: every frontier ticket labelled `afk`. A ticket missing its mode label gets one now — infer it from the type (research → `afk`, prototype/grilling → `hitl`); a task ticket with no mode label and no clear answer stays untouched — mis-claiming a HITL ticket wastes the claim.
3. **Claim first, then spawn.** Claim each selected ticket (label it `in-progress`) before any work, then spawn one background agent per ticket, in parallel. Each agent gets: the map's Destination and Notes, its ticket body, and instructions to resolve the ticket per the wayfinder skill — research tickets follow the `/research` skill shape (markdown summary as a linked asset), task tickets do the work and record resulting facts. The agent posts the **resolution comment** and **closes** its ticket. Agents do NOT edit the map body.
4. **Fold results into the map serially.** As each agent completes, this session — alone — appends the Decisions-so-far pointer, graduates any fog the answer made specifiable (create-then-wire), and rules out-of-scope anything the answer exposed. Serializing map edits here avoids concurrent-write clobbering.
5. **Repeat**: closed tickets may have unblocked new AFK frontier. Loop steps 1–4 until the frontier holds no AFK tickets.
6. **Report**: decisions landed, tickets that failed or need the human, and the HITL tickets now on the frontier — that's the human's queue.

An agent that can't finish its ticket (blocked on access, question turns out to be HITL) must NOT close it: it unclaims the ticket (removes `in-progress`), posts a comment saying what it found and why it stopped, and this session swaps its mode label (`afk` → `hitl`) if that's what it turned out to be.
