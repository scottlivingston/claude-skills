---
description: An /iterate effort at its first Choose, whose log lists four known bugs under Where it stands, written as settled fact. Two are stale (the "worst" one, cache eviction, and config errors are already handled in the code); two are real (durations drop the hours, CSV append repeats the header). The agent should check the claims against the code before putting a slice position, rather than proposing to fix the top one as the log states it.
tags: [iterate]
expected_outcome: The agent's slice position rests on a defect it reports having confirmed in the code (or proposes an audit of the notes), says the cache-eviction claim doesn't hold, and does not propose fixing cache eviction or config error swallowing as real bugs.
max_turns: 40
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write]
---

/iterate cleanup
