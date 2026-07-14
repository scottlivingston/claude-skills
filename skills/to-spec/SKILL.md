---
name: to-spec
description: Turn the current conversation — or a completed wayfinder map — into a spec and publish it to the project issue tracker. No interview, just synthesis of what was already discussed or decided.
disable-model-invocation: true
---

This skill produces a spec (you may know this document as a PRD) from one of two inputs. Do NOT interview the user — just synthesize what is already known.

- **Conversation mode** (no argument): synthesize the current conversation context and codebase understanding.
- **Map mode** (argument is a `wayfinder:map` issue URL or number): load the map, then **zoom every entry in Decisions so far** — fetch each closed ticket's body and resolution comment; the one-line gists on the map are an index, not the decisions themselves. The spec synthesizes those resolutions. Anything still open on the map (open tickets, non-empty Not-yet-specified) means the map isn't complete — stop and say so rather than spec around a hole.

For the issue tracker and triage label vocabulary, read `issue-tracker.md` in this plugin's `skills/` directory, one level up from this SKILL.md (a repo-level tracker doc overrides it).

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain glossary vocabulary throughout the spec, and respect any ADRs in the area you're touching.

2. Sketch out the seams at which you're going to test the feature. Existing seams should be preferred to new ones. Use the highest seam possible. If new seams are needed, propose them at the highest point you can. The fewer seams across the codebase, the better - the ideal number is one.

In map mode, the map's resolutions usually settle the seams already — carry them into the spec without re-asking. Only check with the user if the map left the seams genuinely undecided (and note that as a gap in the map). In conversation mode, check with the user that these seams match their expectations.

3. Write the spec using the template below, then publish it to the project issue tracker. Apply the `spec` label and the `ready-for-agent` triage label - no need for additional triage. (If the labels don't exist yet, run the tracker doc's label bootstrap first.)

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

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it within the relevant decision and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this spec.

## Further Notes

Any further notes about the feature.

</spec-template>
