---
name: autopsy
description: Trace where skills went wrong in past sessions — open snags from `/snag`, or a sweep of a skill's recent transcripts — back to the skill text that caused it, and fix that text with the human's sign-off. `/autopsy [skill]`.
disable-model-invocation: true
---

Run from the repo that holds the skills. A session went wrong somewhere; find the instruction that made it go wrong — or the one it never had — and fix the instruction, not the symptom. Fixes are edits to skills: load `/writing-for-agents` before drafting one, and hold it to the repo's `CONVENTIONS.md`.

## Gather incidents

An **incident** is one moment in one transcript where the human got something other than what they wanted. Collect them from:

- **Snags** — `~/.claude/snags/*.md` with `Status: open`; with an argument, only that skill's. Each names its transcript and the turn; the human's words are the ground truth of what was wrong.
- **A sweep** — with an argument, also the skill's transcripts since its last autopsy: the files under `~/.claude/projects/` whose records carry `"attributionSkill":"<plugin>:<skill>"`, newest first. A sweep finds what the human didn't stop to flag.

Read transcripts through [render.py](render.py) (`python3 -I ${CLAUDE_SKILL_DIR}/render.py <transcript> [--from N --to N]`) — it marks skill loads, the output style, interrupts, and rejected tool calls, and numbers every record so evidence cites `<transcript>:<record>`. A transcript runs to hundreds of KB, so give each one its own background agent on the decider tier (load `/model-policy` to resolve it), and keep only what they report. Each agent returns, per incident: where it is, what the human experienced in their terms, what the agent was doing, which skill files were actually loaded at that point, and the evidence quoted verbatim. In a sweep, an incident shows as the human correcting the agent, repeating themselves, rejecting a tool call, interrupting, invoking `/wait-what`, or answering a question the agent should have looked up itself.

## Diagnose

For each incident, find the cause in the skill text the session ran — the version under `~/.claude/plugins/cache/` that the transcript's skill-load path names, not the repo's copy. Every cause is one of:

- **Wrong** — the text says to do the thing that went wrong.
- **Silent** — nothing covers the case, and the agent's default filled the gap.
- **Unreached** — the text that covers it exists, but the session never loaded it: a cited skill never invoked, a sibling file never read. The fix is the pointer's wording, per `/writing-for-agents`.
- **Outweighed** — the text was loaded and the agent did otherwise: it is buried, hedged, contradicted by another skill, or overridden by the output style or `CLAUDE.md`. Name the competing instruction.
- **Not a skill problem** — the harness, the model, or the task. Say so and close it; no edit.

Show the cause with both quotes side by side: the transcript moment and the skill line (or the absence where one belongs). A cause without that evidence is a guess — read more before proposing anything.

Then check the repo: when its current text already fixes the cause, the snag closes as fixed by that change. Group incidents by cause — three snags from one buried rule are one fix.

## Fix

Draft the edit at the cause's owner: a rule shared through a contract skill is fixed in the contract, never patched in one consumer. Load `/hitl-questions` and put each cause to the human per it — their words or the incident, the cause with its evidence, the drafted edit — one cause per turn. They approve, amend, or reject.

Apply what's approved, then close each snag it covers: set `Status:` to `fixed`, `already fixed`, or `wontfix`, and append a `## Outcome` section with the cause in one line and the edited file, or the reason it won't be fixed. Sweep incidents leave no file; their fix speaks for them.

End by listing what changed and reminding the human that running sessions still hold the old version until `/release` and `/reload-plugins`.
