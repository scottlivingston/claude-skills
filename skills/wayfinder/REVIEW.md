# Plan review

The check against **compounding**: agents decide on their own, and a call made early and confidently gets quietly built around until much of the code stands on it. Each piece's agent sees only its own call, and `/ship`'s wave verification checks the code against the decisions, never the decisions against each other. This review reads the decisions **together**.

It runs once per round, in the background beside the next round's build, over every decision made since the last review: the plan's new or amended `D<n>` decisions, the records on pieces closed since, the spikes' answers, and the gap-fills from parked pieces. Everything those rest on, the principles, the Design, and **Where it stands** are context. The last `<!-- plan-review summary -->` on the plan names the last round it covered; with none, it covers every decision so far.

## What it hunts

- **Contradiction** — two decisions that can't both hold, or code built two ways because two pieces decided the same question differently.
- **Broken input** — a decision that breaks a principle or bends the Design, recorded as if it didn't.
- **Built around** — a later decision or piece that special-cases, works around, or quietly contradicts an earlier one without a friction note on it.
- **Stale ground** — a decision resting on a fact a spike, a parked piece, or the code has since disproved.
- **Over-proving** — a risk that fails the test in `/wayfinder` (*Prove what could sink it, guess the rest*), or a spike still going after its question was answered.
- **Index drift** — a Decision Index gist that no longer says what its decision decides, or a link that doesn't resolve.

It never argues that a decision was the wrong call on its merits alone; a finding needs a second side — another decision, a principle, the Design, or the code.

## Running it

A fill agent (executor tier, per `/model-policy`) reads the material in full from the tracker and fills `/finding-pipeline`'s [document-gate template](../finding-pipeline/doc-gate.template.js): gate name `plan-review`, IDs `PR-<i>`, the list above as the defects, the prior `<!-- plan-review summary -->` comments for dedup, and the plan issue as where it posts. Its find stage is one **cross-read** reader on the auditor tier: hold each decision in scope against the others, the decisions it rests on, the principles, the Design, and the code, citing both sides of every tension by title and quoted sentence.

**Derivable, so applied directly:** index drift; a contradiction where the record itself settles one side — a later decision that explicitly governs the question, or the code as it stands — and nothing else rests on the losing side. Every other finding is a **tension**.

**Tensions are answered by an agent**, per `/deciding`'s *Answering a gate*, and act as:

- **Amend** — a clarification dissolves it: amend the decision, correct the gist.
- **Reconsider** — one side needs re-deciding: post a friction note on it carrying the tension and reconsider it per `/wayfinder`'s *Correcting a decision*, whatever its friction count.
- **Drop** — over-proving: close the risk with the best guess recorded as a decision, or stop the spike and record what it found.

Only what `/deciding` escalates reaches the human. The workflow posts `<!-- plan-review summary -->` on the plan — every finding ID with its outcome, opening with the last round it covered.
