---
name: triage
description: Turn a batch of feedback from a client, a tester or your own playtest into work — split into items, each checked against the code, sorted, the vague ones given a reproduce-or-instrument goal — then kick off an `/iterate` effort from it or add it to the one running. `/triage <feedback>`.
disable-model-invocation: true
---

Feedback arrives as a batch, secondhand and in the reporter's words: one message mixing a value they want changed, something that looked wrong, a bug they half-saw, and an idea. The reporter usually isn't in the session, so what they saw reaches you only through the human. Triage turns that batch into work `/iterate` can run, settling only what routing needs — how each fix is built is a slice's to decide.

## 1. Split the batch

Break the feedback into items, one per thing the reporter wants changed, each in the reporter's words. Note who reported it and the circumstances (the run, build or session it came from) once for the batch. With no argument, ask in one line for the feedback.

Done when every sentence of the feedback belongs to an item, and no item asks for two changes.

## 2. Check each item against the code

Feedback is a claim until you've seen it. For each item, find the code it's about and say what's there now, with `file:line`: the current value, the code path the symptom would come from, or the absence of the thing the reporter named. This catches the reporter describing what they saw in their own terms. For example, a request for darker text "shadows" on an overlay that has no text shadow turns out to mean the dark backdrop behind the text, at 35%.

Where an item can be read two ways against the code, keep both readings for step 4 rather than picking one. When the batch holds more items than a few lookups each can check, check what you can, and mark the rest unchecked, with what would settle each.

Done when every item carries what the code shows, or is marked unchecked.

## 3. Sort

Give each item one verdict:

- **fix** — what to change is clear and checked: a value, a style, a missing guard at a known line.
- **defect** — something broke, and the code doesn't show why. It has to be reproduced before it's fixed.
- **design call** — the reporter wants something different from what was built. Only the human decides whether and how.
- **ask the reporter** — the item can't be sorted without something only the reporter saw or knows.
- **elsewhere** — it belongs to no effort this feedback opens or joins: a separate idea, or already done.

## 4. Settle what routing needs

Load `/hitl-questions` and put to the human only what the code couldn't answer, one item per turn: an item's two readings, a design call's direction, and what the human remembers of the reporter's account.

For each **defect**, settle what "done" means if it won't reproduce. Default to "reproduced and fixed, or else instrumented so its next occurrence shows where it lives". A defect that can't be reproduced and isn't instrumented goes back to the reporter unchanged. Put that default as your position, and get the human's agreement or their alternative (a written finding of what was ruled out, say). The instrumentation is built where the reporter is. Its output must reach you from their setup (a console log they can send, a server log you can filter), and each line must tie to something they can see happen. A log the reporter can't send back, or can't match to what they saw, doesn't settle the next occurrence.

For **ask the reporter** items, and any defect whose account has gaps, draft one message to the reporter. It asks only what would change a verdict, in their terms, ready for the human to forward.

Done when every item has a verdict the human hasn't contested, every defect has its done-if-unreproduced, and any message to the reporter is drafted.

## 5. Route

Send **elsewhere** items to `/seed` when they're ideas worth an effort of their own, or drop them with the reason. Then route the rest:

- **This session is running an `/iterate` effort the feedback belongs to** — a playtest mid-effort, say. Add each item to that effort's Fog as one line carrying its verdict and what the code showed. A few-line change in files the current slice touched is a Reflect tweak per `/iterate`, and the next Choose picks from the rest.
- **An effort the feedback belongs to is running in another session** — its log has one writer, so don't touch it. Give the human the items as Fog lines to bring to that effort's next `/iterate`.
- **Otherwise** — load `/iterate` and kick off an effort with this triage as its picture.

Done when every item is in an effort's Fog, handed to the human for one, seeded, or dropped with a reason, and the message to the reporter, if any, is in front of the human.
