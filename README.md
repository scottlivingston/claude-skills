# claude-skills

Personal Claude Code plugin packaging my user-level skills.

## Skills

Workflow chain (see `skills/issue-tracker.md` for shared tracker wiring):

- **wayfinder** — chart a huge chunk of work as a map of decision tickets; complete when spec-ready
- **drain** — work a map's AFK frontier (research, agent-doable tasks) in parallel background agents
- **to-spec** — distill a completed map (or the current conversation) into a spec issue
- **to-tickets** — HITL: break the spec into sub-issue tickets with blocking edges; the quiz is the approval gate
- **ship** — implement the ticket DAG in parallel (worktree per agent, serial merges), tracker updated throughout
- **two-axis-review** — review the branch against the spec; on a clean pass, offer the PR that closes the spec issue
- **implement** — implement one piece of work manually (ship's per-ticket discipline, one at a time)

Each skill ends by pointing at the next, so any session tells you where you are in the chain.

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
