---
description: An agent replacing one mechanism with another describes the code as it now is, not the change — across the code it rewrites, the comments it patches, and the docs that mentioned the old behaviour.
tags: [implement, smoke]
expected_outcome: search.ts aborts the previous in-flight request with an AbortController; comments in search.ts and results.ts and the README describe the current behaviour with no mention of debouncing, the 300ms wait, or a contrast with how it used to work.
max_turns: 25
allowed_tools: [Read, Glob, Grep, Skill]
---

The search box feels laggy because of the 300ms debounce. Switch it to send a request on every keystroke and abort the previous in-flight request with an AbortController, so only the latest query's results get published. fetchResults already takes a signal. Keep everything else working, and keep the comments and README accurate.
