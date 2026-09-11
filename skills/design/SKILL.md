---
name: design
description: Decide the shape of code before it's built — module boundaries, interfaces, function signatures, data shapes, and the seams tests will live at. Use when the user wants to be intentional about structure, or when a wayfinder design ticket is being resolved.
---

# Design

A design ticket resolves the question "what structure should power this?" — the module boundaries, the interfaces and function signatures, the data shapes, and the **seams** tests will live at. It is grilling's discipline pointed at code structure: the human designs, one decision at a time, with a clear picture of the system.

This is planning, not building: the output is **decisions**, recorded on the ticket — never implementation. The pull to just start coding is the signal the design is done.

## Process

1. **Pin the question.** What structure is being decided, and for what behaviour? Load the surrounding context — the map's Destination and Notes when working a wayfinder ticket, the conversation otherwise.

2. **Read the terrain, then open per the contract.** Existing modules, interfaces, and conventions near the change; check `CONTEXT.md` for vocabulary and ADRs for constraints (per `/domain-modeling`). What you found *is* the context set of `/hitl-questions`' opening: lay it out, then ask the human how they picture the structure and reflect the split back before proposing anything of your own. Every structural question thereafter reaches them per that same contract — in the project's domain language, as what exists and how it behaves.

3. **Work one decision at a time**, per `/grilling`: hold a position on the decision that most constrains the rest — the shape you'd take, what it costs, where their picture is underspecified — and settle it before opening another. Work top-down — boundaries before interfaces, interfaces before signatures. For each interface agreed, also agree its **seam**: is this a boundary tests observe behaviour at, and what behaviour is observable there? Prefer existing seams to new ones; the ideal number of new seams is the smallest that serves the destination.

4. **Capture decisions as contracts.** Where a snippet states the decision more precisely than prose — a type shape, an interface stub, a function signature, a state shape — write the snippet, trimmed to the decision-rich parts. These are the decision-encoding snippets `/specify` inlines and review later validates against.

5. **Record the resolution**: the decisions, their contract snippets, and the **seams under test** they imply — this is where the spec's Seams-under-test list comes from. On a wayfinder ticket, resolve per the wayfinder skill. Offer an ADR only when `/domain-modeling`'s three-part test passes.

## Rules

- **The human owns every structural decision.** Look up facts in the code; put decisions to the human. A design ticket is always HITL — never resolve one AFK.
- **No implementation.** If validating a shape needs running code, that's a `/prototype` ticket — link the two rather than blurring them.
