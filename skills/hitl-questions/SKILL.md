---
name: hitl-questions
description: The presentation contract for every question put to the human — the opening, facts vs decisions, cold-reader blocks, domain language, recommendations, prose over dialogs, escape hatches. Consult when putting any question to the human from a workflow skill, or when authoring a skill that asks.
---

Every skill in this plugin that puts a question to the human speaks this contract. The asking skill defines only its **cadence** — grilling's one decision at a time, the finding pipeline's one-question-per-turn gate loop, tickets' quiz — and what each answer triggers. How a question *reads* lives here, once. When an asking skill and this contract disagree, this contract wins — fix the skill.

## The opening

A skill that opens a **design conversation** — grilling, design, a wayfinder resolution — does not open with a question. It opens by **setting context**: what it looked up, what is already true in the code and the tracker, and what it takes the decision space to be. Only then does it ask the human for **their picture** of how the thing should work, in their own words, at whatever length they have.

The human designs; the agent pushes. Someone who opens one of these sessions almost always already holds a shape of the answer, and the opening exists so they state it once, whole, instead of having it extracted from them one choice at a time. Withhold your own proposal here — a recommendation offered before you have heard their picture anchors them to your design and turns the rest of the session into them reacting to it.

**Reflect the picture back** before anything else — what it settled, stated as decisions in the human's own terms, and what it left open, including anything it assumed silently or contradicted itself on. The human corrects that split, and the corrected split, not your reading of it, is what the rest of the session works from. A human with no picture yet, or who says `just ask`, goes straight to the questions.

A gate escalating a single question mid-pipeline has no opening — it asks its question.

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

Every question carries your recommended answer and the one-line reason. The human decides; the recommendation is the proof you did the thinking first — a question with no recommendation is usually a fact-lookup you skipped. The one exception is the opening above, where you have not yet heard the human's picture and a recommendation would anchor rather than serve.

## Prose, not dialogs

Questions are put in **prose**, in the flow of the conversation, with your reasoning visible and the human free to answer past the question you actually asked. Nothing here mandates `AskUserQuestion`: a skill reaches for the dialog only when the exchange really is a routing decision over a closed set — a finding's verdict, a breakdown's confirmation — and never in a design conversation, where a ballot of options stands in for a position you should have taken. When a skill does use it, everything the human must read to answer is printed as ordinary text in the same reply, *before* the tool call — the dialog cannot display the material, and no summary inside the tool stands in for it.

## Escape hatches

Three, honoured immediately in every asking skill:

- **`explain`** — brief per `/domain-expansion`, code anchors and excerpts now welcome, then re-put the same question.
- **Batched answers** — several answers arriving as one free-text message, or a picture of how the human wants the thing to work, are taken as given: reflect back what the message settled and what it left open, then ask on from the open part; never re-ask them one by one.
- **`stop`** — end the questioning now: record what's untouched in the asking skill's terms (an `unanswered` outcome, an unsettled branch) and go to its wrap-up.
