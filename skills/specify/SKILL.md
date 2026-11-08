---
name: specify
description: Turn the current conversation into a spec and publish it to the project issue tracker. No interview, just synthesis of what was already discussed or decided. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

This skill produces a spec (you may know this document as a PRD) from the current conversation context and codebase understanding. Do NOT interview the user — just synthesize what is already known. (A `/wayfinder` plan is a spec already: its setup session writes the kernel itself, from `/specify`'s template below.)

For the issue tracker and triage vocabulary, invoke `/issue-tracker`.

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain glossary vocabulary throughout the spec, and respect any ADRs in the area you're touching (both per `/domain-modeling`).

2. Sketch out the seams at which you're going to test the feature. Prefer existing seams, as high and as few as possible — ideally one.

Check with the user that these seams match their expectations — the one interview moment this skill allows.

3. Write the spec as two kinds of unit — a **kernel** that binds every ticket, and **addressable decisions** (`D1`…`Dn`) that each bind only some — using the templates below. Publish the kernel as the spec's body and each decision as its own unit, in index order, per the tracker doc's spec-decision convention. The split keeps each agent's context bounded and every unit under the tracker's body-size cap. Apply the `spec` label, no triage label (if the label doesn't exist yet, run the tracker doc's bootstrap first).

End by pointing the user at the next step: `/spec-review <spec>`.

<spec-template>

The kernel — the spec's body. Everything here is **global**: a section belongs here only if it binds everyone. Anything that binds a subset of the eventual tickets belongs in a decision instead.

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A numbered list of user stories — every story a decision or the Solution serves, and no others. Each in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

Cover every aspect of the feature the spec actually decides; a story is complete when a test could tell whether it holds.

## Decision Index

One line per implementation decision, in index order:

`D<n>: <title> — <one-line gist> (<origin ticket(s)>)`

The index is the complete list of what was decided; the decisions themselves are published as separate addressable units (see the decision template below). Write each gist specific enough that "the spec never asked for this" is checkable against it.

What makes a decision: one settled question, covering modules and their interfaces, architectural calls, schema changes, API contracts, specific interactions, technical clarifications from the developer. The test is that a *subset* of the implementation tickets needs its full text; a decision every ticket would cite isn't a decision, it's the Solution or a Testing Decision, and belongs in the kernel.

## Testing Decisions

The **global half** of the testing decisions — a decision's own test plan travels with that decision, not here. Include:

- **Seams under test** — the agreed seams, each described at the interface level: what boundary it is and what behaviour is observable there. Work no listed seam covers is a spec gap.
- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this spec.

## Further Notes

Any further notes about the feature — including any rule the effort knowingly breaks, stated as a deliberate decision.

</spec-template>

<decision-template>

One unit per Decision Index entry, published per the tracker doc's spec-decision convention. Open with the verdict block:

### D<n>: <title>

- **Decided:** the verdict, stated so an implementer can act on it without reading any debate.
- **Because:** the rationale, one or two lines — no more.
- **Rejected:** the alternatives that lost, one line.
- **Origin:** link(s) to where it was settled — a wayfinder piece, a spike, or "this conversation". The debate lives at the link, never here.

Then the decision's substance:

- **Decision-encoding snippets are first-class content**: a state machine, reducer, schema, type shape, or API contract — especially one a prototype or design ticket validated — is inlined here, trimmed to the decision-rich parts. What a decision avoids is *speculative* implementation code, and specific file paths or line numbers — they go stale fast.
- **The decision's test plan**, where it has one: the concrete cases that pin this decision at the kernel's seams. The test *philosophy* stays in the kernel's Testing Decisions; the per-decision case list lives here, beside the contract it verifies.

</decision-template>
