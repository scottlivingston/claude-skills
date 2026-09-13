---
name: model-policy
description: Which model every spawned agent runs on — three tiers (executor, decider, auditor), resolved from a policy file (repo, then home, then defaults) so the session's model never leaks into a workflow by accident. Consult before spawning any agent or filling any workflow template.
---

# Model policy

Every agent a skill spawns — a workflow stage, a drain agent, a research agent, a fill agent — runs on a **tier**, and each tier resolves to one model from the policy below. The session's own model is never the implicit default for a fan-out: a session running an expensive model would otherwise spawn twenty copies of itself the moment it launches a workflow.

## The three tiers

- **Executor** — an agent that carries out a fully specified brief and sits under a net that catches its mistakes: implementers working from a plan, merge and conflict agents, fix agents applying validated proposals, claim and auto-ticket agents, workflow fill agents. Default: `sonnet`.
- **Decider** — an agent whose judgment is the product: reviewers, validators, proposers, planners, the partition and collision stages, ledger assemblers, drain and research agents, and any whole-stage subagent that runs a skill like `/specify` or `/tickets`. Default: `inherit` (the session's model).
- **Auditor** — the few run-once, single-agent, find-side reads whose misses nothing downstream catches: the pipeline's validators refute false positives, but a defect the one reader never noticed is gone for good. Today: `/spec-review`'s grounding read, `/map-review`'s cross-read, `/ship`'s closing-pass sweeper and requirements union, and every labeling stage (its dedup is the one silent suppression no net catches). One call each per effort, so the strongest model is affordable here and nowhere else. Default: `inherit`.

Which tier a given stage belongs to is the spawning skill's call and is stated there; this skill only says what each tier runs on. Executors that are pure mechanics (claim, auto-ticket) also pass `effort: 'low'` — effort is the spawning skill's call too.

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

`inherit` resolves to whatever the harness gives an agent spawned without a `model`: the session's model, unless `CLAUDE_CODE_SUBAGENT_MODEL` is set in the harness settings, in which case that. The env var is the harness's blunt safety net — it moves every subagent, in every skill and every ad-hoc `Agent` call; the policy file is the precise one. Both can be on at once.

## Applying it

- **Workflow templates** carry three data slots, `EXECUTOR_MODEL`, `DECIDER_MODEL`, and `AUDITOR_MODEL`, filled with the resolved values (`inherit` fills as `null`). Every `agent()` call in the fixed section names its tier through the template's `tier()` helper, which passes `model` only when the tier is pinned. A fill agent resolves the policy itself — the files are readable from any checkout — and fills all three slots; the manager never threads a model through.
- **Skills that spawn with the `Agent` tool** (`/drain`, `/research`, `/next`'s fill and whole-stage subagents) pass `model` with the tier's resolved value, and omit it when the tier resolves to `inherit`.
- **Reporting**: a skill that launches a workflow or a batch of agents says which models the tiers resolved to, in one line, before spawning — so an unexpected `fable` is visible before it costs anything.
