---
name: specify
description: Turn the current conversation — or a completed wayfinder map — into a spec and publish it to the project issue tracker. No interview, just synthesis of what was already discussed or decided. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

This skill produces a spec (you may know this document as a PRD) from one of three inputs. Do NOT interview the user — just synthesize what is already known.

- **Conversation mode** (no argument): synthesize the current conversation context and codebase understanding.
- **Slice mode** (argument is a `wayfinder:slice` issue URL or number) — **the normal path off a map**: load the slice's parent map for its Destination and Notes, then **zoom every ticket the slice claims plus every entry under Map-wide decisions** — fetch each closed ticket's body and resolution comments. The spec synthesizes exactly those resolutions and no others. The slice must be **sealed** (closed); if it is open, stop and say so. A sealed slice should also carry `slice-reviewed`; if it's absent, flag that the review hasn't run and let the user choose: review first, or spec anyway.
- **Unsliced-map mode** (argument is a `wayfinder:map` issue URL or number): for a map that was never sliced. Load the map, then **zoom every entry in Decisions so far** — fetch each closed ticket's body and resolution comment; the one-line gists on the map are an index, not the decisions themselves. The spec synthesizes those resolutions. Anything still open on the map (open tickets, non-empty Not yet specified) means the map isn't complete — stop and say so rather than spec around a hole. A complete map should also carry the `map-reviewed` marker; if it's absent, flag that the review hasn't run and let the user choose: review first, or spec anyway. If the map *does* have slices, spec them one at a time in slice mode instead.

In the two map-derived modes, "map mode" below means both unless a line says otherwise.

For the issue tracker and triage vocabulary, invoke `/issue-tracker`.

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain glossary vocabulary throughout the spec, and respect any ADRs in the area you're touching (both per `/domain-modeling`).

2. Sketch out the seams at which you're going to test the feature. Prefer existing seams, as high and as few as possible — ideally one.

In map mode, the map's resolutions — design tickets especially — settle the seams: carry them into the spec's **Seams under test** list without re-asking. Only check with the user if the map left the seams genuinely undecided (and note that as a gap in the map). In conversation mode, check with the user that these seams match their expectations — the one interview moment this skill allows.

3. Write the spec as two kinds of unit — a **kernel** that binds every ticket, and **addressable decisions** (`D1`…`Dn`) that each bind only some — using the templates below. Publish the kernel as the spec's body and each decision as its own unit, in index order, per the tracker doc's spec-decision convention. The split keeps each agent's context bounded and every unit under the tracker's body-size cap. Apply the `spec` label, no triage label (if the label doesn't exist yet, run the tracker doc's bootstrap first).

In **slice mode**, comment the published spec's link on the slice, and add it to the slice's line in the map's Slices section. Close the map only when this was the **last unspecced slice** of a complete map. Later slices may still be foggy; that is expected.

In **unsliced-map mode**, comment on the map linking the published spec — the map's destination is reached — and close the map.

The **kernel inherits the map-wide decisions** in slice mode: a resolution filed map-wide binds every slice, so it belongs in the kernel (Solution, Testing Decisions, Further Notes) rather than as an indexed decision — the Decision Index is for what *this* slice settled. End by pointing the user at the next step: `/spec-review <spec>`.

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

What makes a decision: one settled question — typically one map resolution — covering modules and their interfaces, architectural calls, schema changes, API contracts, specific interactions, technical clarifications from the developer. The test is that a *subset* of the implementation tickets needs its full text; a decision every ticket would cite isn't a decision, it's the Solution or a Testing Decision, and belongs in the kernel.

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
- **Origin:** link(s) to the map ticket(s) that settled it, or "this conversation". The debate lives at the link, never here.

Then the decision's substance:

- **Decision-encoding snippets are first-class content**: a state machine, reducer, schema, type shape, or API contract — especially one a prototype or design ticket validated — is inlined here, trimmed to the decision-rich parts. What a decision avoids is *speculative* implementation code, and specific file paths or line numbers — they go stale fast.
- **The decision's test plan**, where it has one: the concrete cases that pin this decision at the kernel's seams. The test *philosophy* stays in the kernel's Testing Decisions; the per-decision case list lives here, beside the contract it verifies.

</decision-template>
