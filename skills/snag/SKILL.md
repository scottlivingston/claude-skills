---
name: snag
description: Flag something a skill just did that bothered you — `/snag <what went wrong>`. Files it with this session's context for `/autopsy`, then carries on.
disable-model-invocation: true
---

The human hit friction with a skill and wants it on record. File it, then get out of the way: a snag is a note, never a fix, and the session goes back to the work in flight.

## File it

Write one file to `~/.claude/snags/` named `<YYYY-MM-DD>-<skill>-<short slug>.md`:

```markdown
# <the snag in a short line, in the human's terms>

Status: open
Skill: <skill name> <plugin version>
Session: ${CLAUDE_SESSION_ID}
Transcript: <path>
At: <timestamp of the turn the snag is about>

## In their words

<the human's argument, verbatim>

## The turn

> <the opening of your message the snag is about, quoted verbatim — enough to find it>

## Context

<one or two sentences: what the skill was doing at that point — its stage, what it was asking or building>
```

- **Transcript** is the one file matching `~/.claude/projects/*/${CLAUDE_SESSION_ID}.jsonl`.
- **Skill and version** come from the `Base directory for this skill:` path of the skill driving the turn — the version is the path segment after the plugin name. A snag that spans skills names the one in charge of the session.
- **The turn** is the one the argument points at; with no pointer, your last message before the `/snag`.
- No argument → ask in one line what went wrong, then file.

## Back to work

Confirm in one line where it was filed, then pick up exactly where the session was. Leave the cause and the fix to `/autopsy`, which runs where the skills live.
