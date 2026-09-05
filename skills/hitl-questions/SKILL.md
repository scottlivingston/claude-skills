---
name: hitl-questions
description: The presentation contract for every question put to the human — facts vs decisions, cold-reader blocks, domain language, recommendations, AskUserQuestion mechanics, escape hatches. Consult when putting any question to the human from a workflow skill, or when authoring a skill that asks.
---

Every skill in this plugin that puts a question to the human speaks this contract. The asking skill defines only its **cadence** — grilling's whole-frontier rounds, the finding pipeline's one-question-per-turn gate loop, tickets' quiz — and what each answer triggers. How a question *reads* lives here, once. When an asking skill and this contract disagree, this contract wins — fix the skill.

## Facts vs decisions

Finding facts is the agent's job, never the human's. When a question hinges on a fact from the environment — the code, the tracker, the docs — look it up or dispatch a sub-agent; the human is asked only what no lookup can answer: what was *meant*, what is *wanted*, which trade-off to take. The decisions are the human's — put each one to them and wait. An agent that answers its own question has broken the exchange.

## The cold reader

Every question is written for a cold reader: someone who joined the project today must be able to answer from the question alone — assume the human has not read the spec, the map, the diff, or the transcript that produced the question. Concretely:

- **Things are named by what they decided or require.** A decision, ticket, or section enters the question as a clause saying what it is — "the decision that every dialog returns keyboard focus to its opener on close" — and is referred to that way on every mention; its title alone is agent-written and can be as opaque as its number. The ID (`D6`, `#401`) appears at most once per question, trailing in parentheses as the record's handle — in the block header or after the first mention — and never in the question line or an option label. Same for locations — "the five admin-side dialogs" beats a crate path.
- **Situation before question.** Open with one or two sentences: what part of the product this concerns and what the change wants there. Only then the question.
- **No process residue.** Validator notes, drafting history, and sub-agent mechanics never reach the question — a caveat surfaced along the way becomes part of an option's consequence or the recommendation, in the reader's terms.
- **Options are outcomes.** Each option states what choosing it means for the product ("ship with the admin dialogs uncovered" / "add manual checklist items for them"), never process actions alone.

## Domain language

Questions speak the project's **domain language** — capabilities, behaviors, cases, and consequences, per `CONTEXT.md`'s vocabulary — so the human engages with the decision, not with functions, file paths, and line numbers. When a question lands on terrain they don't hold a model of, `/domain-expansion` briefs them and re-puts the question; the code itself is one ask away, cited per `/code-anchors`.

## The recommendation

Every question carries your recommended answer and the one-line reason. The human decides; the recommendation is the proof you did the thinking first — a question with no recommendation is usually a fact-lookup you skipped.

## AskUserQuestion mechanics

When the choices are enumerable, ask with `AskUserQuestion` — recommended option first, options phrased as the outcome choices, each description naming what the answer triggers. Everything the human must read to answer is printed as ordinary text in the same reply, *before* the tool call — the dialog cannot display the material, and no summary inside the tool stands in for it.

## Escape hatches

Three, honoured immediately in every asking skill:

- **`explain`** — brief per `/domain-expansion`, code anchors and excerpts now welcome, then re-put the same question.
- **Batched answers** — several answers arriving as one free-text message, or a brief of how the human wants the thing to work, are taken as given: reflect back what the message settled and what it left open, then ask on from the open part; never re-ask them one by one.
- **`stop`** — end the questioning now: record what's untouched in the asking skill's terms (an `unanswered` outcome, an unsettled branch) and go to its wrap-up.
