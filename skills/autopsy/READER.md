# Transcript reader

The brief for one background agent reading one past session for a sweep. The launching skill hands it the transcript path and names the skill under study; it changes no files anywhere.

Read the transcript through [render.py](render.py) in ranges, saving any render to a file of your own under the scratchpad (`<scratchpad>/<session id>/`), never a shared name — other readers run beside you:

    python3 -I <this directory>/render.py <transcript> [--from N --to N]

Cite evidence as `<transcript-basename>:<record>`. The skill text the session ran is the version under `~/.claude/plugins/cache/` that the transcript's skill-load path names — quote from that, not the repo.

The workflows the session launched are recorded as JSON in the directory named like the transcript without `.jsonl`, under `workflows/` (keys `workflowName`, `status`, `durationMs`, `agentCount`, `totalTokens`, `result`, `logs`, `workflowProgress` — the last holds per-agent labels and timings). Read them with `jq`; grep `.script` rather than print it. A run still going has only `subagents/workflows/<run id>/journal.jsonl`.

Report two things, under about 700 words:

1. **Incidents** — moments the human got something other than what they wanted: correcting the agent, repeating themselves, rejecting a tool call, interrupting, invoking `/wait-what` or `/snag`, or answering a question the agent should have looked up itself. Per incident: the records, what the human experienced in their terms, what the agent was doing, which skill files were loaded at that point, and the evidence quoted verbatim, both sides. Where a skill line caused it, say which cause per [the autopsy's Diagnose](SKILL.md#diagnose), with the quote.
2. **Flow health** — facts, not impressions: the stages and units of work that ran; per workflow run its name, status, wall-clock, agent count, tokens, what parked or went red, and where the time went (the slowest agents and phases); then the waste you can see — work done twice, lookups redone, results misreported to the human, bookkeeping gone wrong, long waits that weren't the human's, context bloat. "None seen" where a section is clean.

Quote, don't recommend.
