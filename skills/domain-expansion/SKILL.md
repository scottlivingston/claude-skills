---
name: domain-expansion
description: Expand the concepts behind the current question. Use when the human faces a question that hinges on parts of the system they don't hold a working model of — they ask "what does this do today?", say they're unfamiliar with the area, seem lost, or invoke it by name mid-grilling.
---

# Domain Expansion

A HITL question has landed on unfamiliar terrain: the human is being asked to decide something that hinges on parts of the system they don't hold a working model of. This skill expands the domain of the question — a plain-language briefing on what the system does today in that area — then puts the question again.

The briefing speaks **capabilities and concepts, not code**. Its register is short, plain sentences (ASD-STE100 Simplified Technical English is the bar) in the project's ubiquitous language from `CONTEXT.md` when it exists. You read the code; the human reads your digest of it. File paths, symbols, and line numbers stay out of the prose — when the human wants to see the source itself, give one or two references per `/code-anchors`, on request.

This is a side-quest inside a HITL exchange, and the HITL rule still holds: **the briefing informs the human's answer; it never becomes the answer.** End by re-putting the question and waiting.

## Process

1. **Pin the question.** Identify the pending question — the one the human is stuck on (usually the last question asked in a `/grilling` exchange; if the human named something else to expand, use that). The briefing exists to make *this* question answerable, and that scope governs every choice below: which behaviour is relevant, how deep to go, when to stop.

2. **Explore.** Read the code the question actually hinges on — entry points, the core logic, every place the behaviour forks. The reading is yours to do and yours to digest. Check `CONTEXT.md` (if it exists) so the briefing speaks the project's domain language, and note any ADR that explains *why* things work the way they do.

3. **Deliver the briefing:**

   - **Orientation** — two or three sentences: what this part of the system is for and how it connects to things the human already knows. Domain vocabulary, not file names.
   - **What the system does today** — the current behaviour as a short list of capability statements: what it can do, the rules it enforces, where the behaviour forks and on what. Each one a plain sentence about behaviour, not a description of code. Cap it around six; if the terrain is bigger than that, brief the part that decides *this* question and say what you left out.
   - **What each answer would mean** — for each candidate answer to the question, one or two sentences on how the behaviour above would change: what the system could newly do, what it would stop doing, what gets simpler.

4. **Re-put the question**, with your recommended answer, and wait for the human. If the exploration changed your recommendation, say so and why.

## What this skill is not

- **Not a research report.** No markdown file, no issue comment, no artifact — the deliverable is the human's informed answer to the pending question. If the exploration surfaces something durable (a glossary conflict, a contradiction between code and stated intent), that's `/domain-modeling`'s job — hand it off or flag it, don't absorb it here.
- **Not a code tour.** Prose littered with references reads as a wall of jargon and pushes the human out of the question. Keep the references ready — the human may ask "show me the code", and then `/code-anchors` says how to cite it — but the briefing itself stays clean.
- **Not a pre-emptive habit.** Expand only when the human signals they need it. Briefing every question would drown the interview this skill exists to serve.
