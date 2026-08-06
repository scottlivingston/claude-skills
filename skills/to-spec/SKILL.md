---
name: to-spec
description: Turn the current conversation — or a completed wayfinder map — into a spec and publish it to the project issue tracker. No interview, just synthesis of what was already discussed or decided. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

This skill produces a spec (you may know this document as a PRD) from one of two inputs. Do NOT interview the user — just synthesize what is already known.

- **Conversation mode** (no argument): synthesize the current conversation context and codebase understanding.
- **Map mode** (argument is a `wayfinder:map` issue URL or number): load the map, then **zoom every entry in Decisions so far** — fetch each closed ticket's body and resolution comment; the one-line gists on the map are an index, not the decisions themselves. The spec synthesizes those resolutions. Anything still open on the map (open tickets, non-empty Not-yet-specified) means the map isn't complete — stop and say so rather than spec around a hole.

For the issue tracker and triage vocabulary, invoke `/issue-tracker`.

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain glossary vocabulary throughout the spec, and respect any ADRs in the area you're touching.

2. Sketch out the seams at which you're going to test the feature. Existing seams should be preferred to new ones. Use the highest seam possible. If new seams are needed, propose them at the highest point you can. The fewer seams across the codebase, the better - the ideal number is one.

In map mode, the map's resolutions — design tickets especially — settle the seams: carry them into the spec's **Seams under test** list without re-asking. Only check with the user if the map left the seams genuinely undecided (and note that as a gap in the map). In conversation mode, check with the user that these seams match their expectations — the one interview moment this skill allows, because `/tdd` downstream refuses to test at seams no human confirmed.

3. Write the spec as two kinds of unit — a **kernel** every downstream agent reads in full, and **addressable decisions** (`D1`…`Dn`) that `/to-tickets` routes to the implementation tickets needing them — using the templates below. Publish the kernel as the spec's body and each decision as its own unit, in index order, per the tracker doc's spec-decision convention (on GitHub: one marked comment per decision). The split is what keeps every agent's context bounded and relevant — a `/ship` agent reads the kernel plus only its ticket's cited decisions — and it keeps every published unit far below any tracker's body-size cap, so no content is ever trimmed to fit. Apply the `spec` label — no triage label: the spec's next step is the HITL `/to-tickets` quiz, and `/next` routes on the `spec` label plus the state of its children, not on triage. (If the marker doesn't exist yet, run the tracker doc's bootstrap first.)

In map mode, also comment on the map linking the published spec — the map's destination is reached — and close the map.

End by pointing the user at the next step: `/to-tickets <spec>` — a HITL session whose quiz is where the human approves the implementation breakdown; the tickets become sub-issues of this spec issue. `/ship` runs only after those tickets exist.

<spec-template>

The kernel — the spec's body. Everything here is **global**: every implementing agent and every reviewer reads all of it, so a section belongs here only if it binds everyone. Anything that binds a subset of the eventual tickets belongs in a decision instead.

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories. Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

This list of user stories should be extremely extensive and cover all aspects of the feature.

## Decision Index

One line per implementation decision, in index order:

`D<n>: <title> — <one-line gist> (<origin ticket(s)>)`

The index is the complete list of what was decided; the decisions themselves are published as separate addressable units (see the decision template below). It is **load-bearing for review**: a reviewer holding one slice of the diff sees the whole decision surface only through these one-liners, so a vague gist is where scope creep hides. Write each like a seam row — specific enough that "the spec never asked for this" is checkable against it.

What makes a decision: one settled question — typically one map resolution — covering modules and their interfaces, architectural calls, schema changes, API contracts, specific interactions, technical clarifications from the developer. The test is that a *subset* of the implementation tickets needs its full text; a decision every ticket would cite isn't a decision, it's the Solution or a Testing Decision, and belongs in the kernel.

## Testing Decisions

The **global half** of the testing decisions — a decision's own test plan travels with that decision, not here. Include:

- **Seams under test** — the agreed seams, each described at the interface level: what boundary it is and what behaviour is observable there. This list is the confirmation `/tdd` requires; ship's agents test at these seams and no others, and work no listed seam covers is a spec gap.
- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this spec.

## Further Notes

Any further notes about the feature — including any rule the effort knowingly breaks, stated so review reads it as a decision rather than an oversight.

</spec-template>

<decision-template>

One unit per Decision Index entry, published per the tracker doc's spec-decision convention. Open with the verdict block:

### D<n>: <title>

- **Decided:** the verdict, stated so an implementer can act on it without reading any debate.
- **Because:** the rationale, one or two lines — no more.
- **Rejected:** the alternatives that lost, one line.
- **Origin:** link(s) to the map ticket(s) that settled it, or "this conversation". The full debate lives at the link, never here — `/review`'s `spec-suspect` validators follow it when a deviation needs adjudicating; no other reader should need it.

Then the decision's substance:

- **Decision-encoding snippets are first-class content**: a state machine, reducer, schema, type shape, or API contract — especially one a prototype or design ticket validated — is inlined here, trimmed to the decision-rich parts. These are the contracts `/review` validates the implementation against. What a decision avoids is *speculative* implementation code, and specific file paths or line numbers — they go stale fast.
- **The decision's test plan**, where it has one: the concrete cases that pin this decision at the kernel's seams. The test *philosophy* stays in the kernel's Testing Decisions; the per-decision case list lives here, beside the contract it verifies.

</decision-template>
