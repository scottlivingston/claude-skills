# Session scorer

The brief for one agent scoring one past session, run in the wave [scorers.template.js](scorers.template.js) launches. The wave hands it the transcript path and a scratch directory; it changes no files outside that directory.

A `.jsonl` transcript is a Claude Code session: read it through autopsy's renderer in ranges, saving any render to a file under your scratch directory, never a shared name, because other scorers run beside you, and cite evidence as `<transcript-basename>:<record>`.

    python3 -I <this directory>/../autopsy/render.py <transcript> [--from N --to N]

A `.md` transcript is another agent's session (Codex, Warp, Pi and others), condensed by skill-doctor's collector: read it directly and cite `<transcript-basename>:<line>`. Its long sessions keep only a head and a tail; judge only what it shows.

A sub-agent session (its first message is a brief from another agent, not a person) has no human in it: the brief stands in for the human's request, and the agent that reads its result stands in for the human reading its output.

## Score

Judge the session against each rubric in [scorers/](scorers/): `efficiency.md`, `code-quality.md`, `procedure-compliance.md`, `verbosity.md`. Per rubric, return one label exactly as its table spells it, and a reason of one to three sentences citing records. Code quality is `insufficient_evidence` when the session changed no code.

Name the **skill in charge**: the skill driving the session's main work, spelled as the transcript's `attributionSkill` spells it (`scott-skills:iterate`), or `""` when no skill drove it.

## Incidents

For every rubric whose label scores below 0.5 in its table, report the moments that earned it. Per incident:

- the records;
- the rubric it failed;
- what happened, in the human's terms;
- the human's own words verbatim where they corrected, objected, interrupted or repeated themselves, else `""`;
- the skill in charge at that moment and the skill files loaded by then;
- the **owner**: the skill whose text governs this moment — the one whose line you quote, or the one whose trigger was met and never loaded — spelled as `attributionSkill` spells it, or `""` when no skill's text bears on it. It is often not the skill in charge: a `/model-policy` skipped during a `/conventions` session is owned by `model-policy`;
- the owner's line behind it, quoted from the version the session ran (for Claude Code, the path under `~/.claude/plugins/cache/` the transcript's skill-load names), or `""` where no line covers it.

A session where every rubric scores 0.5 or above has no incidents. Quote, don't recommend. Keep the report under about 600 words.
