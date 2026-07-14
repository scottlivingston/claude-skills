---
name: domain-expansion
description: Expand the code context behind the current question. Use when the human faces a question that hinges on code they haven't read — they ask "where is this in the code?", "show me what it does today", say they're unfamiliar with the area, or invoke it by name mid-grilling.
---

# Domain Expansion

A HITL question has landed on unfamiliar terrain: the human is being asked to decide something that hinges on code they haven't read, and the one or two anchors on the question aren't enough. This skill expands the domain of the question — a guided tour of the relevant code, delivered as a reading path of clickable anchors — then puts the question again.

Read `code-anchors.md` in this plugin's `skills/` directory (one level up from this SKILL.md) for the anchor format. The whole tour is links the human cmd-clicks and reads in their own editor — **never pasted code**.

This is a side-quest inside a HITL exchange, and the HITL rule still holds: **the tour informs the human's answer; it never becomes the answer.** End by re-putting the question and waiting.

## Process

1. **Pin the question.** Identify the pending question — the one the human is stuck on (usually the last question asked in a `/grilling` exchange; if the human named something else to expand, use that). The tour exists to make *this* question answerable, and that scope governs every choice below: which code is relevant, how deep to go, when to stop.

2. **Explore.** Read the code the question actually hinges on — entry points, the core logic, every place the behavior forks. Verify each line number you'll cite. Check `CONTEXT.md` (if it exists) so the tour speaks the project's domain language, and note any ADR that explains *why* the code is shaped this way.

3. **Deliver the tour:**

   - **Orientation** — two or three sentences: what this part of the system is for and how it connects to things the human already knows. Domain vocabulary, not file names.
   - **Reading path** — an ordered list of anchors, each with its one-line *why look here*. Order it as a walk, not a search result: where the flow enters → the core logic → the exact line where the question's tension lives. Cap it around eight; if the terrain is bigger than that, tour the part that decides *this* question and say what you left out.
   - **What today's code implies** — for each candidate answer to the question, one or two sentences on what it would mean against the code as it stands (what changes, what breaks, what gets simpler), each claim anchored.

4. **Re-put the question**, with your recommended answer, and wait for the human. If the tour changed your recommendation, say so and why.

## What this skill is not

- **Not a research report.** No markdown file, no issue comment, no artifact — the deliverable is the human's informed answer to the pending question. If the tour surfaces something durable (a glossary conflict, a contradiction between code and stated intent), that's `/domain-modeling`'s job — hand it off or flag it, don't absorb it here.
- **Not a pre-emptive habit.** Skills ask anchored questions by default and expand only when the human signals they need it. Touring every question would drown the interview this skill exists to serve.
