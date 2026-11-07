---
name: writing-for-agents
description: Writing documents for agents. Use when creating or editing skills, or modifying AGENTS.md or CLAUDE.md.
---

Reference for writing any document an agent consumes — a skill, an `AGENTS.md` / `CLAUDE.md`, a doc reached by a pointer. The same levers make each one predictable — the agent taking the same _process_ every run, not producing the same output.

When the document you're writing is a skill, read [`SKILL-MECHANICS.md`](SKILL-MECHANICS.md) for invocation choice and router skills.

## Context pointers

A **context pointer** is a reference held in the agent's context that names some out-of-context material and encodes the condition for reaching it. A skill's description is one; a line in `AGENTS.md` naming a doc is the same object. The pointer's _wording_, not its target, decides when the agent reaches the material — and how reliably. A must-have target behind a weakly worded pointer gets reached on some runs and not others: sharpen the wording first, and inline the material only if sharpening fails.

A pointer does two jobs — state what the material is, and list the branches that should trigger reaching it (a branch is a distinct case the document handles). Every word of an always-loaded pointer costs on every turn, so prune it harder than the body:

- **Put the trigger word first** — the word the agent should match on leads the pointer.
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

## Naming

Call each concept by a word the model already knows, and use that same word everywhere the concept appears — in the doc, in other docs, and in the code. Coin a term only when other documents must refer to the concept by name; define it where it's introduced. Otherwise write it out in plain words, even when that takes a few more.

## Prohibitions

Lead with the behaviour you want ("write one-line comments"); that's what the agent acts on. When the model falls into a specific failure by default, name the failure right after the target, with an example of what it looks like — a named failure is easier to spot and avoid than one left implied.

## Pruning

- **One owner per fact.** Each rule, list, or format lives in the one document whose subject it is, and everything else points at it. Duplication costs maintenance and tokens and inflates a meaning's prominence past its real rank. A rule never names the documents that consume its output or describes how they read it — that is the consumer's to say.
- The **environment** is a source of truth too — `package.json` scripts, config files, the directory layout, `--help` output — and a document that restates it is a **cache**, earning its load only when the lookup is expensive. Cache what the agent cannot find by looking: the unwritten convention, the reason behind a choice, the gotcha no config confesses.
- **Outcomes, not mechanics.** Say what must be true, not the commands that make it true. Spell out a step only where agents would otherwise vary and the variance hurts: an ordering with consequences, a default direction on failure, a trap the obvious approach falls into.
- **Give the reason** when it helps the agent apply the rule to cases the rule doesn't list. A rule the agent would follow on its own needs no reason.
- Check every line for **relevance**: does it still bear on what the document does? A line loses relevance by never bearing on the task (mere exposition, or a branch that should be disclosed) or by going stale as the behaviour or world it describes changes. Shorter documents are easier to keep relevant. Without pruning, a document gathers **sediment**: stale layers that settle because adding feels safe and removing feels risky. `/cold-read` cores through it.
- **No-ops.** A sentence that doesn't change what the agent would do anyway costs load and says nothing. Whether it does is settled by running the agent with and without it, not by judgement: load `/evals` and compare. A sentence no eval has shown to be redundant stays.
