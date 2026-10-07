---
name: domain-modeling
description: Build and sharpen a project's domain model. Use when the user wants to pin down domain terminology or a ubiquitous language, record an architectural decision, or when another skill needs to maintain the domain model.
---

# Domain Modeling

Build and sharpen the project's domain model as you design: challenge terms, probe edge cases, and write the glossary and decisions down the moment they settle. Merely reading `CONTEXT.md` for vocabulary doesn't need this skill.

## File structure

Most repos have a single context — a bounded context, the part of the system within which each term has one meaning:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `CONTEXT-MAP.md` exists at the root, the repo has multiple contexts and the map points to where each one lives; work in the context the topic belongs to, and ask if that's unclear:

```
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── CONTEXT.md
│       └── docs/adr/
```

Create files lazily — only when you have something to write. If no `CONTEXT.md` exists, create one when the first term is resolved. If no `docs/adr/` exists, create it when the first ADR is needed.

## During the session

### Challenge the language

Call out a term that conflicts with `CONTEXT.md` the moment it's used, propose a precise canonical term for a vague or overloaded one, and invent edge-case scenarios that force precision about where concepts divide.

### Cross-reference with code

When the user states how something works, check whether the code agrees, and surface a contradiction in domain language ("Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"). Keep the disagreeing line's `path:line` ready for when the user asks to see it.

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` right there, not in a batch later, in the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md). It is a glossary and nothing else — no implementation details, specs, or scratch notes.

### Offer ADRs sparingly

Offer an ADR only when the three-part test in [ADR-FORMAT.md](./ADR-FORMAT.md) passes. The format lives there too.
