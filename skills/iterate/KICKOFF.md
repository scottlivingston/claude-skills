# Kickoff

Starting an effort sets a direction, not a plan. It ends with a Destination paragraph and an empty slice list.

1. **Get the picture.** Load `/hitl-questions` and open per it: set the context from the code, ask how the human pictures what they want, and reflect it back. Work it into a **Destination** — what it is, who it's for, what "good enough to stop" looks like — plus any constraints they already know. Detail that arrives early (a library they'd use, a screen layout, an edge case) goes into the Fog as one line each; it gets settled when a slice reaches it.

   Done when the human confirms the Destination paragraph as theirs. The first time it is stateable in a paragraph is the time to stop — the questions still open are what the slices are for.

2. **Place the log.** Pick a short slug. The log goes where the repo already keeps planning notes; with no convention, `docs/efforts/<slug>.md`. Say where.

3. **Pick the branch.** Default: a new branch named after the slug, cut from the default branch. The human may choose the current branch instead.

4. **Write the log** per [LOG-FORMAT.md](LOG-FORMAT.md) — Destination, Where it stands ("nothing yet" for greenfield, a few lines on the existing code otherwise), Fog, an empty Slices section — and commit it on the branch.

Then go to *1. Choose the next slice* in the main skill — in this session if there's room, otherwise end by saying `/iterate`.
