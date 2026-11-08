---
name: deciding
description: The contract for an agent making a decision on the human's behalf — the grounds it must cite, the decision record it posts, the three cases that escalate to the human, friction notes when an earlier decision strains, and agent-answered review gates. Consult before any agent makes a call in a wayfinder effort, answers a gate question on a wayfinder plan, or fills a spec gap.
---

# Deciding

In a wayfinder effort the human sets the destination, the principles, and the high-level design; agents make the calls in between. This contract is what makes those calls auditable and correctable: every decision names what it stands on, so a wrong one can be traced, and every strain on an earlier decision is reported, so compounding shows up early instead of being built around.

## Grounds

Decide only from grounds you can cite, consulted in this order:

1. **Principles** — the plan's own principles (per `/wayfinder`), then the governing `PRINCIPLES.md` files (load `/principles`). A principle that settles the question settles it.
2. **The design** — the plan's Design section: the call that serves it over one that merely fits it.
3. **Earlier decisions** — the plan's or spec's decisions, and the records on pieces already built. Resting on one is a dependency you record.
4. **Prior art** — the reference solutions `PRINCIPLES.md` names first, then how comparable, well-regarded systems solve the same problem. Research it (load `/research`) when it isn't already on the plan; "the established solutions converge on X" is a ground, "X seems standard" is not.
5. **The code** — what already exists and the conventions near the change.

Facts come from lookups, never from assumption. Where a design question needs structure, follow `/design`'s method for shape and seams; where it needs behaviour seen running, build a throwaway per `/prototype` and judge it against the grounds yourself.

## The decision record

Every agent decision is posted as one comment opening `<!-- decision-record -->`:

```markdown
<!-- decision-record -->
## Decision

<the call, stated so a spec can lift it — snippets where a shape says it better than prose>

## Grounds

- **Principle:** "<quoted>" — <file or plan section>
- **Design:** "<quoted line of the plan's Design>"
- **Prior art:** <system> — <how it does it> (<link>)
- **Rests on:** [<decision title>](link) — <what this leans on>

## Rejected

- <alternative> — <the ground it lost on>

## Reversal

<two-way | one-way> — <what undoing it would cost once built>
```

Omit a Grounds line that has nothing to cite, but a record citing nothing beyond the code is not a decision — it escalates as *no grounds settle it*. Every **Rests on** entry also becomes a structural dependency per `/issue-tracker`, so what depends on a decision is a query, not a reading.

## Escalate in exactly three cases

Everything else is decided and recorded. Escalate when:

1. **No grounds settle it** — principles conflict on it or are silent, and neither the design nor converging prior art picks a side.
2. **It's a one-way door** — undoing it once built costs a migration, a broken external consumer, or a commitment outside the repo: persisted data shapes, public or cross-service interfaces, money, accounts, third parties, deleting anything.
3. **It would change the human's inputs** — the call contradicts a principle or the design, or only makes sense if one of them changes.

An escalation is drafted, never open: the question, the options with what each costs, the one you'd pick and the ground for it, written per `/hitl-questions`' cold-reader rules — so the human gives a verdict on concrete text. Where the decision lives on a ticket, its mode is switched from `afk` to `hitl` (per `/issue-tracker`), the draft is posted opening `<!-- escalation -->`, and a push notification goes out (load via `ToolSearch("select:PushNotification")`; skip silently if unavailable). Work that doesn't depend on the answer carries on. The human's answer is recorded as a decision record whose ground is the human, and if it states a rule that will recur, the rule goes to `PRINCIPLES.md` per `/principles`.

## Friction notes

Compounding starts when a new call bends around an old one. When anything you decide or build has to make a special case, an exception to a principle, or a workaround because of an earlier decision — or finds evidence that decision was wrong — post a **friction note** on that decision instead of absorbing it, and mark it `friction` (per `/issue-tracker`):

```markdown
<!-- friction -->
**From:** <what you were doing — a decision, a ship park, a review finding, research, a checkpoint>, linked
**Strain:** <what had to bend, and how>
**Evidence:** <quoted — the line, the finding, the source>
**Suggests:** <what may be wrong with the decision, if you can say>
```

Post it and carry on with your own work on the record as it stands; never quietly re-decide the earlier decision. What happens to accumulated friction is the owning workflow's call.

## Answering a gate

A review gate on a wayfinder plan — a ship wave or the plan review — is answered by an agent instead of the human. One decider agent (tier per `/model-policy`) takes the pending-questions comment and, per block, picks the verdict the gate admits from the grounds above, posting a decision record for any answer that decides something new. A block that hits one of the three cases stays for the human and is escalated as above; the rest act per the gate's own verdicts, and the gate's summary records which were agent-answered. An answer that departs from a plan decision posts a friction note on that decision.
