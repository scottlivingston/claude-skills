---
name: model-policy
description: Which model every spawned agent runs on — three tiers (executor, decider, auditor), resolved from a policy file (repo, then home, then defaults) so the session's model never leaks into a workflow by accident. Consult before spawning any agent or filling any workflow template.
---

# Model policy

Every agent a skill spawns runs on a **tier**, and each tier resolves to one model from the policy below. The session's own model is never the implicit default for a fan-out, so an expensive session doesn't multiply itself.

## The three tiers

- **Executor** — an agent that carries out a fully specified brief under a net that catches its mistakes. Default: `sonnet`.
- **Decider** — an agent whose judgment is the product. Default: `inherit` (the session's model).
- **Auditor** — a run-once, single-agent, find-side read whose misses nothing downstream catches. It runs once per effort, so the strongest model is affordable here and nowhere else. Default: `inherit`.

Which tier a given stage belongs to, and its effort, is the spawning skill's call and is stated there; this skill only says what each tier runs on.

## Which model?

Resolve once per session, in this order — first file found wins per key, and any key a file leaves out falls through:

1. **Repo policy**: `.claude/model-policy.md` in the repo.
2. **User policy**: `~/.claude/model-policy.md`.
3. **Defaults**: executor `sonnet`, decider `inherit`, auditor `inherit`.

The file is three lines, one per tier:

```
executor: sonnet
decider: opus
auditor: fable
```

A value is anything the harness's `model` option accepts — an alias (`sonnet`, `opus`, `haiku`, `fable`), an alias with a context suffix (`opus[1m]`), or a full model ID — or the word `inherit`, meaning the session's model. `inherit` is spelled out, never implied by omission, so a cold reader of the file can see the tier is deliberately unpinned.

`inherit` resolves to whatever the harness gives an agent spawned without a `model`: the session's model, unless `CLAUDE_CODE_SUBAGENT_MODEL` is set in the harness settings, in which case that. The env var moves every subagent, ad-hoc ones included; the policy file moves only tiers. Both can be on at once.

## Applying it

- **Workflow templates** carry three data slots, `EXECUTOR_MODEL`, `DECIDER_MODEL`, and `AUDITOR_MODEL`, filled with the resolved values (`inherit` fills as `null`). Every `agent()` call below a template's `FIXED BELOW THIS LINE` marker names its tier through the template's `tier()` helper, which passes `model` only when the tier is pinned. A fill agent resolves the policy itself — the files are readable from any checkout — and fills all three slots; the session that launches the workflow never threads a model through.
- **Skills that spawn with the `Agent` tool** pass `model` with the tier's resolved value, and omit it when the tier resolves to `inherit`.
- **Reporting**: a skill that spawns agents — a workflow, a batch, or a single one — says which models the tiers resolved to, in one line, before spawning — so an unexpected `fable` is visible before it costs anything.
