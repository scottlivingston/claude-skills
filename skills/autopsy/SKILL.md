---
name: autopsy
description: Trace where skills went wrong in past sessions — open snags from `/snag`, or a sweep of a skill's recent transcripts — back to the skill text that caused it, reproduce each cause as an eval, and fix that text with the human's sign-off and a before/after run. `/autopsy [skill]`.
disable-model-invocation: true
---

Run from the repo that holds the skills. A session went wrong somewhere; find the instruction that made it go wrong — or the one it never had — and fix the instruction, not the symptom. Fixes are edits to skills: load `/writing-for-agents` before drafting one, and hold it to the repo's `CONVENTIONS.md`.

## Gather incidents

An **incident** is one moment in one transcript where the human got something other than what they wanted. Collect them from:

- **Snags** — `~/.claude/snags/*.md` with `Status: open`; with an argument, only that skill's. Each names its transcript and the turn; the human's words are the ground truth of what was wrong. A snag with a `Source: /rsi` line was filed by a scorer, not the human: unless it quotes the human, what it says went wrong is a claim to check against the transcript.
- **A sweep** — with an argument, also the skill's transcripts since its last autopsy: the files under `~/.claude/projects/` whose records carry `"attributionSkill":"<plugin>:<skill>"`, newest first, searched recursively so a workflow's agent transcripts under `<session>/subagents/` count. A skill whose text a workflow template puts in its agents' prompts, rather than having them load it, leaves no attribution in those agents: find the templates citing it with `grep -l '/<skill>' skills/*/*.template.js` (`/implement` lives in the build agents of `/ship` and `/iterate`), and also take the agent transcripts under those workflow skills' sessions whose opening task is the prompt that template writes. A sweep finds what the human didn't stop to flag.

Read transcripts through [render.py](render.py) (`python3 -I ${CLAUDE_SKILL_DIR}/render.py <transcript> [--from N --to N]`) — it marks skill loads, the output style, interrupts, and rejected tool calls, and numbers every record so evidence cites `<transcript>:<record>`. A transcript runs to hundreds of KB, so read them in one dynamic `Workflow` (this skill is your authorization to use it), one reader per transcript on the decider tier (load `/model-policy` to resolve it), briefed with [READER.md](READER.md). **Start from [readers.template.js](readers.template.js) — fill it, don't author from scratch.** Keep only what they report: incidents with their evidence, and the flow health of the workflows the session ran. A single transcript is one reader, spawned on its own.

## Diagnose

For each incident, find the cause in the skill text the session ran — the version under `~/.claude/plugins/cache/` that the transcript's skill-load path names, not the repo's copy. Every cause is one of:

- **Wrong** — the text says to do the thing that went wrong.
- **Silent** — nothing covers the case, and the agent's default filled the gap.
- **Unreached** — the text that covers it exists, but the session never loaded it: a cited skill never invoked, a sibling file never read. The fix is the pointer's wording, per `/writing-for-agents`.
- **Outweighed** — the text was loaded and the agent did otherwise: it is buried, hedged, contradicted by another skill, or overridden by the output style or `CLAUDE.md`. Name the competing instruction.
- **Not a skill problem** — the harness, the model, or the task. Say so and close it; no edit. A cause whose only edit would paste in examples from these sessions, or restate a rule the loaded text already states plainly where the agent reads it, belongs here too: a speculative edit is worse than none.

Show the cause with both quotes side by side: the transcript moment and the skill line (or the absence where one belongs). A cause without that evidence is a guess — read more before proposing anything.

Group incidents by cause — three snags from one buried rule are one fix.

## Reproduce

Load `/evals`. For each cause, build one replay case under `evals/local/<skill>/<slug>/` from the incident that shows the cause most plainly: cut its transcript at the user turn that opened it, and grade what the human wanted. Their words are the rubric — a pattern where one can decide it, a judge rubric quoting them where none can.

Run it with `/evals`' runner as an A/B, `--base` set to the commit that released the version the session ran (its subject ends `bump to <version>`; for a version installed from an unreleased tree, the release before it), three runs a side. One run answers both questions: the base side failing means the incident reproduces, and the candidate side — the current tree — passing means the repo already fixes it, so its snags close as `already fixed`. Tell the human the run count and a cost estimate before starting; a long transcript makes every run expensive.

A case that passes on the session's version didn't reproduce. Mark the cause **unverified** and carry it on to Fix anyway — some failures need more than a replay carries.

## Fix

Draft the edit at the cause's owner: a rule shared through a contract skill is fixed in the contract, never patched in one consumer. Apply it to the working tree and A/B the cause's case against `HEAD`, five runs a side; a draft that leaves the case failing gets reworked before anyone sees it.

Load `/hitl-questions` and put each cause to the human per it — their words or the incident, the cause with its evidence, the drafted edit, and what the eval showed: the graders that moved, before → after, or that the cause is unverified — one cause per turn. They approve, amend, or reject. An amendment gets its own A/B before it's applied; a rejection reverts the edit.

Close each snag the approved fixes cover: set `Status:` to `fixed`, `already fixed`, or `wontfix`, and append a `## Outcome` section with the cause in one line, the edited file, and the case that guards it, or the reason it won't be fixed. Sweep incidents leave no file; their fix and its case speak for them. A guarding case stays in `evals/local/` until the human approves moving it into the repo, per `/evals`.

End by listing what changed and reminding the human that running sessions still hold the old version until `/release` and `/reload-plugins`.
