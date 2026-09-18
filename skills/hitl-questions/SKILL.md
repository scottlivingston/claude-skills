---
name: hitl-questions
description: The presentation contract for every question put to the human — the opening, facts vs decisions, cold-reader blocks, domain language, recommendations, prose over dialogs, the shape of a turn, escape hatches. Consult when putting any question to the human from a workflow skill, or when authoring a skill that asks.
---

Every skill in this plugin that puts a question to the human speaks this contract. The asking skill defines only its **cadence** — grilling's one decision at a time, the finding pipeline's one-finding-per-turn gate loop, tickets' quiz — and what each answer triggers. How a question *reads*, and how long a turn runs, lives here, once. When an asking skill and this contract disagree, this contract wins — fix the skill.

## The opening

A skill that opens a **design conversation** — grilling, design, a wayfinder resolution — does not open with a question. It opens by **setting context**: what it looked up, what is already true in the code and the tracker, and what it takes the decision space to be. Only then does it ask the human for **their picture** of how the thing should work, in their own words, at whatever length they have.

The human designs; the agent pushes. Someone who opens one of these sessions almost always already holds a shape of the answer, and the opening exists so they state it once, whole, instead of having it extracted from them one choice at a time. Withhold your own proposal here — a recommendation offered before you have heard their picture anchors them to your design and turns the rest of the session into them reacting to it.

**Reflect the picture back** before anything else — what it settled, stated as decisions in the human's own terms, and what it left open, including anything it assumed silently or contradicted itself on. The human corrects that split, and the corrected split, not your reading of it, is what the rest of the session works from. A human with no picture yet, or who says `just ask`, goes straight to the questions.

A gate escalating a single question mid-pipeline has no opening — it asks its question.

## Facts vs decisions

Finding facts is the agent's job, never the human's. When a question hinges on a fact from the environment — the code, the tracker, the docs — look it up or dispatch a sub-agent (decider tier per `/model-policy`); the human is asked only what no lookup can answer: what was *meant*, what is *wanted*, which trade-off to take. The decisions are the human's — put each one to them and wait. An agent that answers its own question has broken the exchange.

**A decision the record already made is a fact too.** Derive before you ask: where a decision already recorded, an earlier answer from this human, or the code itself settles the matter, settling it *is* the agent's work. **The test is the answer, not the topic — a question earns its turn only when the human's answer would change what gets built or written.** No topic, defect kind, or always-ask list earns one on its own. Two defensible answers is a question; one defensible answer standing against something simply wrong is a repair — make it, and record it where the human can see and override it. The line between this and the paragraph above is what kind of question it is: standing in for the human on a question of intent breaks the exchange, and handing them one the record already answers wastes it.

## The cold reader

Every question is written for a cold reader: someone who joined the project today must be able to answer from the question alone — assume the human has not read the spec, the map, the diff, or the transcript that produced the question. Concretely:

- **Things are named by what they decided or require.** A decision, ticket, or section enters the question as a clause saying what it is — "the decision that every dialog returns keyboard focus to its opener on close" — and is referred to that way on every mention; its title alone is agent-written and can be as opaque as its number. The ID (`D6`, `#401`) appears at most once per question, trailing in parentheses as the record's handle — in the block header or after the first mention — and never in the question line or an option label. Same for locations — "the five admin-side dialogs" beats a crate path.
- **Situation before question.** Open with one or two sentences: what part of the product this concerns and what the change wants there. Only then the question.
- **Quote the material, don't describe it.** When a question turns on a specific sentence — a spec line, a decision's text, a comment, a signature — print it verbatim, with its `path:line`, instead of paraphrasing what it says. A paraphrase is one more agent-written artifact standing between the human and the thing they are deciding about, and it can drift from what is actually there.
- **Stakes before options.** One line, before the options, on what breaks if nobody acts. Without it the human weighs the options against nothing; and a question whose honest answer is *nothing breaks* is one you should have settled yourself.
- **No process residue.** Validator notes, drafting history, and sub-agent mechanics never reach the question — a caveat surfaced along the way becomes part of an option's consequence or the recommendation, in the reader's terms.
- **One topic per block.** A question asks one thing and carries only what's needed to answer it. A second question, a related tension on another branch, an aside about where the answer gets recorded — each is its own block or its own turn. Two topics in one block means one gets answered and the other is dropped without either of you noticing.
- **Options are outcomes.** Each option states what choosing it means for the product ("ship with the admin dialogs uncovered" / "add manual checklist items for them"), never process actions alone.

## Domain language

Questions speak the project's **domain language** — capabilities, behaviors, cases, and consequences, per `CONTEXT.md`'s vocabulary — so the human engages with the decision, not with functions, file paths, and line numbers. When a question lands on terrain they don't hold a model of, brief them in plain language on what the system does there today and re-put the question; the code itself is one ask away, cited as `path:line`.

## The recommendation

Every question carries your recommended answer and the one-line reason. The human decides; the recommendation is the proof you did the thinking first — a question with no recommendation is usually a fact-lookup you skipped. The one exception is the opening above, where you have not yet heard the human's picture and a recommendation would anchor rather than serve.

## Prose, not dialogs

Questions are put in **prose**, in the flow of the conversation, with your reasoning visible and the human free to answer past the question you actually asked. Nothing here mandates `AskUserQuestion`: a skill reaches for the dialog only when the exchange really is a confirmation over a closed set — a breakdown's approval — and never where the human is deciding something, a design conversation or a review gate alike, where a ballot of options stands in for a position you should have taken. When a skill does use it, everything the human must read to answer is printed as ordinary text in the same reply, *before* the tool call — the dialog cannot display the material, and no summary inside the tool stands in for it.

## The shape of a turn

Every exchange in this plugin is a conversation between two people, not a memo and a form. The asking skill decides what a turn is *about*; this section fixes how big it is.

**One turn, one topic.** Everything in the turn serves settling the one thing on the table: your position, the reason that carries it, and the one thing you need from the human. Everything else waits — a tension on another branch, the next finding in the queue, a fact you happened to find, a note on where the answer gets recorded. Two topics in one turn means the human answers one and the other is silently lost.

**Talk, don't write.** A turn is what a coworker says out loud before the other one cuts in: a few sentences, under about a hundred words, never a document. The one thing allowed to lengthen it is a verbatim quote of the line the question turns on, when the human has to see it to answer. Typography is welcome — a bold lead, a short list, a quote block, a header when the turn opens a new thing — because it makes a turn faster to parse; the limit is the length, not the formatting. Give the position and the reason that carries it in the same breath, then stop and let them react.

**When there's more to say, say it next turn.** The conversation has as many turns as it needs, so four short exchanges always beat one long one — the human answers each point while it is still the thing in front of them. A point you don't make now isn't lost, it's queued in whatever the asking skill keeps its bookkeeping in. A turn that runs long isn't thorough, it's a turn that got read halfway.

**A rambling message is a signal to decompose, not licence to ramble back.** When the human answers several things at once or thinks out loud across topics, that is the moment to break it down — never to match them paragraph for paragraph. Name the pieces in a line each, say which one you're taking and why it comes first, and take that one.

**Settle in a line.** When the thing on the table settles, say so in one line in the human's terms and move to the next. Reflecting the whole back is for the ends of a session, never every turn.

## Escape hatches

Three, honoured immediately in every asking skill:

- **`explain`** — a plain-language briefing on what the system does in the area the question touches, `path:line` references and excerpts now welcome, then re-put the same question.
- **Batched answers** — several answers arriving as one free-text message, or a picture of how the human wants the thing to work, are taken as given: reflect back what the message settled and what it left open, then ask on from the open part; never re-ask them one by one.
- **`stop`** — end the questioning now: record what's untouched in the asking skill's terms (an `unanswered` outcome, an unsettled branch) and go to its wrap-up.
