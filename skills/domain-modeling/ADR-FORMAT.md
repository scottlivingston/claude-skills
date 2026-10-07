# ADR Format

An **ADR** — a record of an architectural decision — lives in `docs/adr/`, and ADRs use sequential numbering: `0001-slug.md`, `0002-slug.md`, etc.

## Template

```md
# {Short title of the decision}

{1-3 sentences: what's the context, what did we decide, and why.}
```

An ADR can be a single paragraph.

## Optional sections

Only include these when they add genuine value. Most ADRs won't need them.

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`) — useful when decisions are revisited
- **Considered Options** — only when the rejected alternatives are worth remembering
- **Consequences** — only when non-obvious downstream effects need to be called out

## Numbering

Scan the `docs/adr/` the ADR goes in for the highest existing number and increment by one — each context's directory numbers its own.

## When to offer an ADR

All three of these must be true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will look at the code and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

Decisions that typically pass: architectural shape, integration patterns between contexts, technology choices that would take a quarter to swap out, ownership and scope boundaries (the explicit no-s included), deliberate deviations from the obvious path, constraints the code doesn't show, and alternatives rejected for non-obvious reasons.
