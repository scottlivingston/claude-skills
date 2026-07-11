# claude-skills

Personal Claude Code plugin packaging my user-level skills.

## Skills

Workflow chain (see `skills/issue-tracker.md` for shared tracker wiring):

- **wayfinder** — chart a huge chunk of work as a map of decision tickets; complete when spec-ready
- **drain** — work a map's AFK frontier (research, agent-doable tasks) in parallel background agents
- **to-spec** — distill a completed map (or the current conversation) into a spec on the tracker
- **to-tickets** — break a spec into tracer-bullet tickets with blocking edges
- **ship** — spec → tickets (one approval gate) → fresh agent per ticket → reviewed, committed code
- **implement** — implement one piece of work from a spec or tickets (manual counterpart to ship's loop)
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
