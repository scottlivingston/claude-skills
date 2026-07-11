# claude-skills

Personal Claude Code plugin packaging my user-level skills.

## Skills

Workflow chain (see `skills/issue-tracker.md` for shared tracker wiring):

- **wayfinder** — plan a huge chunk of work as a map of investigation tickets
- **to-spec** — turn the current conversation into a spec on the tracker
- **to-tickets** — break a plan/spec into tracer-bullet tickets with blocking edges
- **implement** — implement a piece of work from a spec or tickets
- **two-axis-review** — review changes along Standards and Spec axes

Standalone:

- **domain-modeling** — build/sharpen a project's domain model, record ADRs
- **grilling** — relentless interview to stress-test a plan
- **prototype** — throwaway prototype to answer a design question
- **research** — background-agent research against primary sources
- **tdd** — red-green-refactor test-driven development

## Install

```
claude plugin marketplace add scottlivingston/claude-skills
claude plugin install scott-skills@claude-skills
```

Update after pushing changes:

```
claude plugin marketplace update claude-skills
```
