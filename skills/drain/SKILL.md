---
name: drain
description: Work a wayfinder map's agent frontier — decisions, designs, prototypes, research, tasks, reconsiderations — in parallel background agents, folding each result into the map as it lands and opening reconsiderations where friction builds. Use to advance charting while escalated tickets wait for the human. Invoke only when the user explicitly asks for it or when /next routes to this stage — never spontaneously.
---

Drain the **agent frontier** of a wayfinder map: every open, unblocked, unclaimed ticket labelled `afk`. This session is the map's **coordinator** — its single writer, per `/wayfinder`'s folding rule, claiming the map for as long as it runs — and the ticket agents decide, research, and propose; they never edit the map body.

The user invokes with a map (URL or number). Read the wayfinder skill in this plugin for the map vocabulary, and invoke `/issue-tracker` for the tracker operations.

## Process

1. **Claim the map** (unless this session already holds it), load its body, and query the frontier.
2. **Select the `afk` subset.** A ticket missing its mode label gets `afk` unless it is a task only the human can do.
3. **Claim first, then spawn.** Claim each selected ticket before any work, then spawn one background agent per ticket, in parallel, on the **decider tier** (load `/model-policy` to resolve it). Each agent gets the map's Destination, Principles, Design, and Notes, its ticket body, the names of the tickets it blocks, and the brief below.
4. **Fold as each agent finishes** — confirm the ticket is closed with its record, then fold it per `/wayfinder`: index, apply proposals, count toward the checkpoint, check the reconsideration trigger, seal what completed. Folds run one at a time, in finishing order, and proposal comments posted on the map fold the same way. When a checkpoint is due, run it before spawning more: `/map-review <map> checkpoint` in a subagent, whose repairs come back as proposals for this session to fold.
5. **Repeat**: folds unblock and create tickets. Loop steps 1–4 until the frontier holds no `afk` ticket and no agent is running; then make `/wayfinder`'s charting pass if fog remains, and loop again if it charted anything. Unclaim the map when done.
6. **Report**: one line per ticket resolved (by name, with its gist), reconsiderations opened and their outcomes, slices sealed, and every escalation now waiting on the human — the human's queue.

## The agent brief

- **Decision, design, prototype ticket**: load `/deciding` and decide per it, ending the record with `## Map changes proposed` per `/wayfinder`.
- **Reconsider ticket**: load `/wayfinder` and `/deciding`, then work the ticket per wayfinder's Reconsideration — the correction plan, its refutation, and its escalation rule.
- **Research ticket**: load `/research` and follow it — cited findings in a markdown file linked from the ticket, the options they leave open, a recommendation labelled as one.
- **Task ticket**: do the work, then record what was done and the facts later tickets depend on.
- **Every ticket** ends its resolution with `## Map changes proposed` when it has any, per `/wayfinder`.
- **Friction**: anything you had to bend around an earlier decision gets a friction note on it, per `/deciding`.
- **Close the ticket** and remove the claim. Edit no other ticket's body and never the map body.
- **Can't finish** (blocked on access, or escalated): leave it open, unclaim it, and post what was found and why it stopped — the escalation draft, when it escalated.
