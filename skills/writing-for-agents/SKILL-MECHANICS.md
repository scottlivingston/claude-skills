# Skill mechanics

The skill-specific branch of [`writing-for-agents`](SKILL.md): what changes when the document is a skill — frontmatter, the invocation choice, and router skills. Everything else about writing it is the universal reference in `SKILL.md`.

## Invocation

Two choices, trading the two loads:

- A **model-invoked** skill keeps its `description` loaded at all times as its top-level context pointer, so the agent — and other skills — can reach it; the human can still type its name. It pays permanent context load, and an all-reference one is a home for reference several skills share. Omit `disable-model-invocation`, and write a model-facing description carrying the trigger branches (per the pointer rules in `SKILL.md`).
- A **user-invoked** skill is reachable only by the human typing its name — no context load, but cognitive load: you must remember it exists. Set `disable-model-invocation: true`; the `description` becomes a human-facing one-line summary.

Pick model-invocation only when the agent must reach the skill on its own, or another skill must. Reference two user-invoked skills share goes in a plain file both point at.

## Splitting by invocation

The invocation cut of splitting (the sequence cut lives in `SKILL.md`): split off a model-invoked skill when a distinct leading word you actually use in prompts should trigger it on its own, or another skill must reach it — worth the new description's context load only then.

## Router skills

When user-invoked skills multiply past what you can remember, that piled-up cognitive load is cured by a **router skill**: one user-invoked skill that names the others and when to reach for each, so the human has one skill to remember. It can only point the human at them, never fire them.
