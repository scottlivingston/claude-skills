---
name: rsi
description: Grade recent sessions against four rubrics — efficiency, code quality, procedure compliance, verbosity — track the grades run over run, and file every failure a skill caused as a snag for `/autopsy`. `/rsi [since]` weekly, from the repo that holds the skills.
disable-model-invocation: true
---

# Recursive skill improvement

The detection half of the improvement loop. `/snag` catches what the human stops to flag; this pass reads what they didn't — in every agent skill-doctor's collector reads (Claude Code, Codex, Warp, Pi, Grok Build, ZCode, Hermes), sub-agent sessions included — grades it, and files each failure that a skill of this repo caused as a snag. `/autopsy` owns everything after that: the cause, the eval, the fix. This pass never edits a skill. The grades land in `.rsi/history.jsonl`, so each run says whether the last round of fixes moved anything.

Run it from this repo. Scripts below live in this skill's directory.

## Outcomes

Every run ends on exactly one, named in the report:

- **clean** — no sessions in the window, or none failed.
- **filed** — failures were filed as snags, ready for `/autopsy`.
- **blocked** — the run couldn't finish; the report says what stopped it.

## Pass

1. **Scope.** The window starts at the `until` of the last line in `.rsi/history.jsonl`, or at the argument (a date, or a number of days back), which overrides it. No history and no argument: ask how far back to go. Save the inventory to a scratch file:

       python3 -I collect.py --since <start> --out <scratch> --exclude ${CLAUDE_SESSION_ID} --repo . > <scratch>/inventory.json

   Its header says what it does on top of the vendored collector in [upstream/](upstream/). No sessions in it: **clean**, with nothing written.

2. **Score.** Load `/model-policy` and resolve the decider tier. Tell the human how many sessions the wave scores and on which model, then launch one dynamic `Workflow` (this skill is your authorization to use it) filled from [scorers.template.js](scorers.template.js), with the inventory's `sampled` list as its transcripts. **Start from the template — fill it, don't author from scratch.** Write the workflow's returned result to `<scratch>/reports.json` as soon as it returns, so the pass survives a compacted context.

   **Done when:** every sampled session has a report; a session the wave lists as missing gets one more scorer, spawned on its own and briefed with [SCORER.md](SCORER.md).

3. **Tally.** Run [tally.py](tally.py) with `--inventory`, `--reports`, `--history .rsi/history.jsonl` and `--write`. It appends this run's grades and prints them with the change since the previous run and the failed sessions. A label it lists as unknown is one a scorer misspelled, and it blocks the append: correct the label in `reports.json` from that verdict's reason, and rerun.

4. **File.** Each failed session's incidents become snags, one per incident, in the format of [/snag](../snag/SKILL.md) with these differences:

   - a `Source: /rsi, <rubric> <label>` line under `Status:`;
   - **Skill and version** are the incident's owner, which also names the file, and the inventory's `ran` for that session. The owner is the skill whose text governs the moment, not the skill in charge: `/autopsy <skill>` finds a snag only under the skill whose text it should change;
   - **Transcript** is the session's `source` in the inventory, never the condensed copy in scratch, and another agent's session adds a `Harness:` line under it;
   - **In their words** holds the human's words when the incident has them, and otherwise `None — the scorer's reason: <reason>`;
   - **The turn** quotes the cited record, which you open yourself before filing. Drop an incident whose record doesn't show what the scorer claims.

   File only incidents whose owner this repo owns (the inventory's `owned` list), and skip one whose transcript already has an open snag for the same owner. Before filing, read the owner's text as it stands in this repo now (sessions often ran an older version) and drop an incident the current text already fixes; the report names it as already fixed, with the commit that fixed it (`git log` on the owner's directory since the version that ran). The rest go in the report unfiled: an owner this repo doesn't own, and a failure no skill's text bears on, which may be a skill that doesn't exist yet.

5. **Report.** Load `/hitl-questions` for the shape. In this order: the overall grade and each rubric's mean, with the change since the last run; the skills whose grades moved most, each with its session count; the three patterns that cost the human most across the failed sessions, each with a cited record; the snags filed, by path; the unfiled failures in a line each; the owned skills no session used (the inventory's `unused`), since a skill that never fires usually has a description problem. End on the outcome and the next step: `/autopsy` for **filed**, and that `.rsi/history.jsonl` goes out with the next `/release`.
