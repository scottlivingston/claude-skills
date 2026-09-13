# Conventions

Reviewable standards for the skills in this repo (per `skills/conventions`).

- **Contracts are cited, never restated.** Shared behavior lives in exactly one contract skill — `/finding-pipeline` for review-gate stages, `/hitl-questions` for questions put to the human, `/issue-tracker` for tracker operations, `/testing` for test recipes — and a skill that needs it cites the contract by name. A skill restating a contract's mechanics (cold-reader rules, escape hatches, domain-language rules, gate markers, validation stages, tracker verbs, test-recipe resolution) is a standards finding: replace the restatement with a citation. Local text is welcome only where the contract explicitly delegates — a gate's question classes and option shapes, an asking skill's cadence — or where it binds a contract rule to local terms in one line.
- **Contract supremacy.** When a consumer skill and its contract disagree, the contract wins — the fix edits the consumer, never forks the contract.
