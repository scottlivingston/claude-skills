---
name: design
description: Decide the shape of code before it's built — module boundaries, interfaces, function signatures, data shapes, and the seams tests will live at. Use when the user wants to be intentional about structure, or when a wayfinder design ticket is being resolved.
---

# Design

A design ticket resolves the question "what structure should power this?" — the module boundaries, the interfaces and function signatures, the data shapes, and the **seams** tests will live at. It is grilling's interview discipline pointed at code structure: the human decides, one question at a time, with the code in view.

This is planning, not building: the output is **decisions**, recorded on the ticket — never implementation. The pull to just start coding is the signal the design is done.

## Process

1. **Pin the question.** What structure is being decided, and for what behaviour? Load the surrounding context — the map's Destination and Notes when working a wayfinder ticket, the conversation otherwise.

2. **Read the terrain first.** Existing modules, interfaces, and conventions near the change. Check `CONTEXT.md` for vocabulary and ADRs for constraints (per `/domain-modeling`). Every structural question put to the human is **anchored** per `code-anchors.md` in this plugin's `skills/` directory — they decide with the code in view — and `/domain-expansion` gives a guided tour when anchors aren't enough.

3. **Interview one decision at a time**, per `/grilling`: propose a shape, recommend an answer, wait. Work top-down — boundaries before interfaces, interfaces before signatures. For each interface agreed, also agree its **seam**: is this a boundary tests observe behaviour at, and what behaviour is observable there? Prefer existing seams to new ones; the ideal number of new seams is the smallest that serves the destination.

4. **Capture decisions as contracts.** Where a snippet states the decision more precisely than prose — a type shape, an interface stub, a function signature, a state shape — write the snippet, trimmed to the decision-rich parts. These are the decision-encoding snippets `/to-spec` inlines and review later validates against.

5. **Record the resolution**: the decisions, their contract snippets, and the **seams under test** they imply — this is where the spec's Seams-under-test list comes from. On a wayfinder ticket, resolve per the wayfinder skill. Offer an ADR (per `/domain-modeling`) only when its three-part test passes — hard to reverse, surprising without context, a real trade-off.

## Rules

- **The human owns every structural decision.** Look up facts in the code; put decisions to the human. A design ticket is always HITL — never resolve one AFK.
- **No implementation.** If validating a shape needs running code, that's a `/prototype` ticket — link the two rather than blurring them.
