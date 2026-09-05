---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

## The brief

Open by asking for the user's **brief**: how they picture the thing working, in their own words, at whatever length they have — before any question is put. Someone who invokes a grilling usually already holds a shape of the answer, and the brief lets them lay it out once instead of reconstructing it one choice at a time. A user with no picture yet, or who says `just ask`, goes straight to the first round.

**Reflect the brief back** before asking anything — this is a step, not a courtesy. Recast it as the first cut of the design tree in two lists: what the brief **settled**, each item stated as a decision in the user's terms, and what it left **open**, including anything the brief assumed silently or contradicted itself on. The user corrects the split, and only then do the rounds begin. Settled decisions stay settled until a later answer reopens one; the first round is the frontier of the open list. A brief arriving mid-session is handled the same way, per the contract's batched-answers hatch.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled — the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round, then wait for the user's answers before the next round.

Every question obeys the presentation contract in `/hitl-questions` — cold-reader wording, the project's domain language, facts looked up rather than asked, escape hatches honoured. What's local here is the cadence: whole-frontier rounds, each question numbered and formatted like so (the ➡️ line is the contract's recommendation):

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Each round the user answers reshapes the tree — settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

A frontier question that needs a fact from the environment dispatches a sub-agent per the contract — and doesn't block the round: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.
