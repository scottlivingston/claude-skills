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

3. Write the spec using the template below, then publish it to the project issue tracker. Apply the `spec` label — no triage label: the spec's next step is the HITL `/to-tickets` quiz, and `/next` routes on the `spec` label plus the state of its children, not on triage. (If the marker doesn't exist yet, run the tracker doc's bootstrap first.)

In map mode, also comment on the map linking the published spec — the map's destination is reached — and close the map.

End by pointing the user at the next step: `/to-tickets <spec>` — a HITL session whose quiz is where the human approves the implementation breakdown; the tickets become sub-issues of this spec issue. `/ship` runs only after those tickets exist.

<spec-template>

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

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Decision-encoding snippets are **first-class content**: a state machine, reducer, schema, type shape, or API contract — especially one a prototype or design ticket validated — is inlined within the relevant decision, trimmed to the decision-rich parts with its origin noted. These are contracts `/two-axis-review` validates the implementation against. What the spec avoids is *speculative* implementation code, and specific file paths or line numbers — they go stale fast.

## Testing Decisions

A list of testing decisions that were made. Include:

- **Seams under test** — the agreed seams, each described at the interface level: what boundary it is and what behaviour is observable there. This list is the confirmation `/tdd` requires; ship's agents test at these seams and no others, and work no listed seam covers is a spec gap.
- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this spec.

## Further Notes

Any further notes about the feature.

</spec-template>
