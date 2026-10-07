---
name: writing-for-agents
description: Writing documents for agents. Use when creating or editing skills, or modifying AGENTS.md or CLAUDE.md.
---

Reference for writing any document an agent consumes — a skill, an `AGENTS.md` / `CLAUDE.md`, a doc reached by a pointer. The same levers make each one predictable — the agent taking the same _process_ every run, not producing the same output.

When the document you're writing is a skill, read [`SKILL-MECHANICS.md`](SKILL-MECHANICS.md) for invocation choice and router skills.

## Context pointers

A **context pointer** is a reference held in the agent's context that names some out-of-context material and encodes the condition for reaching it. A skill's description is one; a line in `AGENTS.md` naming a doc is the same object. The pointer's _wording_, not its target, decides when the agent reaches the material — and how reliably. A must-have target behind a weakly worded pointer gets reached on some runs and not others: sharpen the wording first, and inline the material only if sharpening fails.

A pointer does two jobs — state what the material is, and list the branches that should trigger reaching it (a branch is a distinct case the document handles). Every word of an always-loaded pointer costs on every turn, so prune it harder than the body:

- **Front-load the leading word** — the pointer is where it does its triggering work.
- **One trigger per branch.** Synonyms that rename a single branch are one branch written twice; collapse them and keep only genuinely distinct branches.
- **Cut identity the body already carries.**

## The two loads

Every document and pointer you add spends one of two budgets:

- **Context load** — the cost of always-loaded material on the agent's window: an `AGENTS.md` line, a skill description, anything sitting in context every turn, spending tokens and attention whether or not it fires.
- **Cognitive load** — the cost on the human: which documents exist and when to reach for each. The human is the index. Spend it where human judgement matters, remove it where it does not.

Material reached only through a pointer escapes context load at the price of the pointer's own line; material with no pointer at all rides entirely on cognitive load.

## Information hierarchy

A document is built from steps (the ordered actions the agent performs) and reference (definitions, rules, facts consulted when needed), in any mix. The core decision is where each piece sits on a ladder ranked by how immediately the agent needs it:

1. **In-file step** — the primary tier: what the agent does, in order.
2. **In-file reference** — consulted when needed. A flat set of peer rules on one rung is fine.
3. **Disclosed reference** — pushed into a separate file (a sibling, or anywhere any document can point at), reached by a context pointer, loaded only when the pointer fires.

Push too little down and the top bloats; push too much and you hide material the agent needs.

**Progressive disclosure** is the move down the ladder, and it protects the hierarchy more than it saves tokens. The test is branching: inline what every branch needs, and push behind a pointer what only some branches reach. Undisclosed reference buries a document's steps and makes attending to them a coin-flip.

Within a file, keep a concept's definition, rules, and caveats under one heading, so reading one part brings its neighbours with it.

A document can be too long even when every line is live and unique: attention thins across the excess. Disclose reference behind pointers, and split by branch or sequence so each path carries only what it needs.

## Steps and completion criteria

Every step ends on a **completion criterion** — the condition that tells the agent the work is done. Two properties make it a lever:

- **Clarity** — can the agent tell done from not-done? A vague bound ("understanding reached") invites premature completion, pulled by the visible steps still ahead. Sharpen the bound first; only if it is irreducibly fuzzy _and_ you observe the rush, hide the later steps by splitting the sequence — which works only across a real context boundary (a hand-off or a subagent dispatch, not an inline call).
- **Exhaustiveness** — how much it requires. "Every modified model accounted for" forces thorough work where "produce a change list" does not. It binds reference too: "every rule applied" gives an all-reference document its bar.

The strongest criteria are both checkable and exhaustive.

## When to split

Splitting one document into two spends one of the two loads, so split only when the cut earns it:

- **By sequence** — split a run of steps where the steps ahead tempt the agent to rush the one in front of it; merging sequences does the reverse.
- **By invocation** — skill-specific: see [`SKILL-MECHANICS.md`](SKILL-MECHANICS.md).

## Leading words

A **leading word** is a compact concept already living in the model's pretraining that the agent thinks with while running the document (_lesson_, _fog of war_, _tracer bullets_). Repeated as a token, never as a sentence, it anchors a whole region of behaviour in the fewest tokens by recruiting priors the model already holds. A coined term recruits none and must be defined and remembered: coin one only for a concept other documents must reference by name or a state a tool records. Everything else stays in plain words.

It anchors twice. In the body, _execution_: the agent reaches for the same behaviour every time the word appears, and inside flat reference it focuses attention on a class of thing to look for. In a pointer, _invocation_: when the same word lives in your prompts, your docs, and your codebase, the agent links that shared language to the material and reaches it more reliably.

Hunt for opportunities to refactor with leading words. A triad spelled out at three sites, a pointer spending a sentence to gesture at one idea — each is a passage begging to collapse into a single token:

- "fast, deterministic, low-overhead" → _tight_ (a _tight_ loop).
- "a loop you believe in" → _red_ — a fuzzy gate becomes a binary observable state (the loop goes _red_ on the bug, or it doesn't).

**Negation** steers badly: a prohibition drags the forbidden behaviour into context and makes it _more_ available — _don't think of an elephant_. State the target behaviour ("write one-line comments") so the banned one is never spoken. Keep a prohibition only as a hard guardrail you cannot phrase positively, and pair it with the positive target.

## Pruning

- **One owner per fact.** Each rule, list, or format lives in the one document whose subject it is, and everything else points at it. Duplication costs maintenance and tokens and inflates a meaning's prominence past its real rank. A rule never names the documents that consume its output or describes how they read it — that is the consumer's to say.
- The **environment** is a source of truth too — `package.json` scripts, config files, the directory layout, `--help` output — and a document that restates it is a **cache**, earning its load only when the lookup is expensive. Cache what the agent cannot find by looking: the unwritten convention, the reason behind a choice, the gotcha no config confesses.
- **Outcomes, not mechanics.** Say what must be true, not the commands that make it true. Spell out a step only where agents would otherwise vary and the variance hurts: an ordering with consequences, a default direction on failure, a trap the obvious approach falls into.
- **One clause of why**, and only when it changes a call at the margin. A rule the agent would follow on its own needs no failure story, and a default is argued once or not at all.
- Check every line for **relevance**: does it still bear on what the document does? A line loses relevance by never bearing on the task (mere exposition, or a branch that should be disclosed) or by going stale as the behaviour or world it describes changes. Shorter documents are easier to keep relevant. Without pruning, a document gathers **sediment**: stale layers that settle because adding feels safe and removing feels risky. `/cold-read` cores through it.
- Hunt **no-ops** sentence by sentence: an instruction the model already obeys by default pays load to say nothing. The test — does it change behaviour versus the default? — is model-relative, settled by running the document, not by debate. When a sentence fails, delete the whole sentence. A leading word too weak to beat the default (_be thorough_) is a no-op too; the fix is a stronger word (_relentless_).
