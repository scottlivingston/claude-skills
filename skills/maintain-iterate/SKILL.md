---
name: maintain-iterate
description: Tune the /iterate loop from its own runs — a reader per session since the last pass, the build and review workflows timed, recurring friction traced to the skill text behind it, and the fixes you approve applied. `/maintain-iterate [since]` whenever a batch of slices has gone by.
disable-model-invocation: true
---

# Maintain the iterate loop

The upkeep pass for `/iterate` and the skills it drives — `build.template.js`, `/diff-review`, `/finding-pipeline`, `/hitl-questions`, `/grilling`. Run it from this repo. Where `/autopsy` starts from friction the human flagged, this pass starts from everything that ran: what the human corrected, and what took longer or cost more than it had to.

## Outcomes

Every run ends on exactly one, named in the report:

- **clean** — no session since the last pass, or nothing recurring that the current text doesn't already fix.
- **changed** — approved fixes are applied in the working tree, ready for `/release`.
- **blocked** — the sweep couldn't finish; the report says what stopped it.

## Pass

1. **Scope.** The sessions are the transcripts under `~/.claude/projects/` whose records carry `"attributionSkill":"<plugin>:iterate"`, modified after the timestamp in `~/.claude/snags/maintain-iterate.last` — or after the argument's date, which overrides it. No marker and no argument: ask how far back to go. No sessions: **clean**. Add the open snags in `~/.claude/snags/` for iterate and the skills it drives.

2. **Reader wave.** One read-only background agent per session on the **decider tier** (load `/model-policy` to resolve it), briefed with [the autopsy's transcript reader](../autopsy/READER.md) and the transcript's path, launched as fast as the concurrent-agent limit allows. Keep a running tally of what returns in a scratch file, so the pass survives a compacted context.

   **Done when:** every session has a returned report.

3. **Patterns.** Group incidents by cause, diagnosed per [the autopsy's Diagnose](../autopsy/SKILL.md#diagnose). A flow-health finding becomes a pattern when it recurs in two or more sessions; a one-off waste is noted, not fixed. Before believing a pattern, open two of its cited records yourself — readers misread, and a reader's render can be another session's. Then read the current repo text behind each pattern, and drop what it already fixes.

4. **Put the patterns to the human.** Load `/hitl-questions`. One report, ranked by what each pattern cost the human — corrections, minutes waited on a build, slices a bug survived — each in a line or two: what happened in their terms, how many sessions, and the skill line behind it. They say which to fix; a pattern they decline is recorded and left.

5. **Fix.** Load `/writing-for-agents` before drafting, and hold every edit to this repo's `CONVENTIONS.md`. Each fix lands at the owner of the cause — a rule shared through a contract skill is fixed in the contract, never patched in `/iterate`. Syntax-check every workflow template you touch. The README changes with any stage it describes. Close each snag a fix covers per [the autopsy's Fix](../autopsy/SKILL.md#fix).

6. **Record.** Write the newest swept transcript's modification time to `~/.claude/snags/maintain-iterate.last`, whatever the outcome but **blocked**. Report the outcome, the patterns fixed and declined, and that running sessions keep the old text until `/release` and `/reload-plugins`.
