# Kickoff

Starting an effort sets a direction, not a plan. It ends with an index holding a Destination paragraph and an empty slice list.

1. **Get the picture.** Load `/hitl-questions` and open per it: set the context from the code, ask how the human pictures what they want, and reflect it back. Work it into a **Destination** — what it is, who it's for, what "good enough to stop" looks like — plus any constraints they already know. Detail that arrives early (a library they'd use, a screen layout, an edge case) goes into the Fog as one line each; it gets settled when a slice reaches it.

   **From a seed**, load `/issue-tracker` and read the seed ticket: its Destination draft and Fog are the picture to reflect back and work from, and its Spotted note is where to look in the code first.

   Done when the human confirms the Destination paragraph as theirs. The first time it is stateable in a paragraph is the time to stop — the questions still open are what the slices are for.

2. **Place the log.** Pick a short slug. The log's directory goes where the repo already keeps planning notes; with no convention, `docs/efforts/<slug>/`. Say where.

3. **Pick the branch and make its checkout.** Default: a new branch named after the slug, cut from the default branch, checked out in a new worktree at `.claude/worktrees/<slug>/` under the main checkout's root. `.claude/worktrees/` must already be gitignored; when it isn't, ask the human to ignore it and wait — the repo's ignore rules are theirs to change. Make it runnable the way the main checkout is — dependencies installed, and the untracked local config the app needs (`.env` files and the like) copied over — then enter it, and give the human its path to open in their editor. The human may choose the current branch instead, and then the current checkout is the effort's.

4. **Write the index** per [LOG-FORMAT.md](LOG-FORMAT.md) — the checkout's absolute path on its `Checkout:` line, Destination, Where it stands ("nothing yet" for greenfield, a few lines on the existing code otherwise), Fog, an empty Slices section — and commit it on the branch. From a seed, close the seed ticket with a comment naming the effort's branch and log path.

5. **Hand off.** When the effort got a new worktree, run [handoff.sh](handoff.sh) from this skill's directory with the checkout's absolute path and the slug: inside Herdr it opens the checkout as its own workspace, starts a new Claude Code session there and sends it `/iterate <slug>`. On success, tell the human the workspace's label and stop — that session is the log's single writer from here, so this one touches the effort no further. Exit status 3 means this session isn't running in Herdr; any other failure, say what it printed. Either way, carry on below.

Then go to *1. Choose the next slice* in the main skill — in this session if there's room, otherwise end by saying `/iterate`.
