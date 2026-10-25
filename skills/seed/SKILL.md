---
name: seed
description: Park an idea for a future `/iterate` effort as a seed ticket on the tracker, where it outlives the session and every worktree — `/seed <idea>` plants one, `/seed <ticket>` preps it further. `/iterate <ticket>` kicks off from it.
disable-model-invocation: true
---

The human spotted something worth an effort of its own — usually while another effort is running — and wants it down before it's lost. A **seed** is that idea as a ticket on the tracker, outside every branch and worktree, drafted as far as an effort's starting picture and no further: slices belong to the effort.

## Plant it

Load `/issue-tracker` and create a ticket marked `effort-seed`, titled with the idea in the human's terms:

```markdown
## Destination (draft)

<what they want, who it's for, what "good enough to stop" looks like — as much as is known; one sentence is fine>

## Fog

- <detail that came with the idea> — <what would clear it>

## Spotted

<where it came up — the effort and slice in flight, or the session's task — and what made it visible, enough for a session months from now to find the code it's about>
```

Draft it from the conversation without asking; with no argument, ask in one line what the idea is. Confirm in one line with the ticket's link, then go back to the work in flight. A seed writes only to the tracker, so it's safe while a build runs in this checkout.

## Prep it

On `/seed <ticket>`, or when the human wants to keep going after planting: load `/hitl-questions` and work the draft toward the Destination `/iterate`'s Kickoff asks for, editing the ticket body as each piece settles. Detail beyond the Destination goes into the Fog as one line each. Done when the human confirms the Destination, or moves on — a half-prepped seed is still a seed.
