---
name: grilling
description: Grill the user relentlessly about a plan or design. Use when the user wants to stress-test a plan before building, or uses any 'grill' trigger phrases.
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time, waiting for feedback on each question before continuing. Asking multiple questions at once is bewildering.

If a *fact* can be found by exploring the codebase, look it up rather than asking me. The *decisions*, though, are mine — put each one to me and wait for my answer.

When a question hinges on existing code, **anchor it**: cite the one to three places I should look as clickable references, per `code-anchors.md` in this plugin's `skills/` directory (one level up from this SKILL.md) — verified `path:line` references I can cmd-click and read in my editor, never pasted code. Anchor your recommended answer the same way when it rests on what the code currently does. If I seem lost in the code a question references — I ask where something lives, or say I don't know this area — offer `/domain-expansion`: a guided tour of the relevant code, after which the question gets re-put.

Do not enact the plan until I confirm we have reached a shared understanding.
