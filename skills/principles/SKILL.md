---
name: principles
description: Where a repo's core principles live — PRINCIPLES.md at root, per-directory deltas in monorepos, nearest scope wins — the rules an agent decides product and architecture questions against. Consult when an agent decides on the human's behalf, when charting a wayfinder map, or when setting up or amending a repo's PRINCIPLES.md.
---

# Principles

Where the rules an agent **decides** against live, so every decider finds the same ones and a decision can cite the rule that settled it. `CONVENTIONS.md` (per `/conventions`) says how code is written and is checked against a diff; `PRINCIPLES.md` says what the product and its architecture favour when two designs both work, and is cited by decisions.

## The file

`PRINCIPLES.md` at the repo root is the canonical home. It holds two kinds of entry:

- **Principles** — a preference that picks between workable designs: "a failed sync never loses local edits; the user resolves conflicts, the system never does", "one way to do a thing, even when a second would be shorter". Each is one bullet, stated so a decision can quote it and an agent can tell whether a candidate honours it.
- **Reference solutions** — existing systems this repo deliberately resembles, each with what to take from it: "auth flows as Stripe's dashboard does them — magic link first, password optional". Deciders reach for these first when the principles are silent.

Order principles by precedence, highest first: when two conflict on a decision, the higher one wins unless the conflict is itself the question (per `/deciding`).

Create it at a map's charting session if the repo has none (per `/wayfinder`); thereafter it grows when a human answer to an escalation states a rule that will recur.

## Monorepo scoping

Any directory may carry its own `PRINCIPLES.md`, binding everything beneath it, exactly as `/conventions` scopes `CONVENTIONS.md`: nearest ancestor wins on conflict, and scoped files are deltas over the root ("as root, except…" plus additions), never copies. [find-principles.sh](find-principles.sh), run from this skill's directory with the paths a decision touches, lists each governing file and the directory it binds, or `none`.

A decision that touches no paths yet — most map decisions — is governed by the root file plus the scoped files for the areas the map's Notes name.

## Map-specific principles

A wayfinder map may add principles for its own effort in its **Principles** section (per `/wayfinder`). They bind that map's decisions only, rank above the repo's files for it, and follow the same delta rule: name what they add or override, never copy the repo's list. A map principle that turns out to hold beyond the effort is promoted into `PRINCIPLES.md` when the map closes.

## Changing a principle

Principles are the human's. An agent never edits `PRINCIPLES.md` or a map's Principles section on its own judgement; it appends only text a human answer settled, quoting that answer's ticket.
