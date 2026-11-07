# Tending CONTEXT.md, CONTEXT-MAP.md, and ADRs

The off-purpose checks `/tend` runs on the domain model's files, against [CONTEXT-FORMAT.md](CONTEXT-FORMAT.md) and [ADR-FORMAT.md](ADR-FORMAT.md). Each names its proof and the repair the proof licenses.

## CONTEXT.md

- **Not a glossary entry** — an implementation detail, spec, or scratch note: how the code does something (a mechanism, a storage choice, a fallback path) rather than what the term is or a domain rule it obeys. Domain rules belong in the definition. A question drafted as the strike, since where mechanism ends and rule begins is the human's call.
- **General term** — a programming concept any programmer defines the same way (timeout, retry, DTO). A question, since whether the project's sense is special is the human's call.
- **Loose definition** — longer than two sentences, or saying what the term does rather than what it is. A question, drafted as the tightened definition.
- **Dead term** — a term nothing in the tree names. Proof: history shows the code once did. Repair: strike it, as a `/cold-read` ghost. With no such history it may be a term still to come: a question.

## CONTEXT-MAP.md

- **Unmapped context** — a `CONTEXT.md` in the tree that the map doesn't list. Repair: add its row, described by that file's own opening line.

## ADRs

An ADR is a record of a decision at a point in time, so its body stays as written: contrast with the past, names since changed, and claims the code has moved past are its content, and `/cold-read`'s defects apply only to its **references** — the paths, links, `path:line`s, ADR numbers, and tracker numbers in it — and its **Status**.

- **Moved reference** — the target moved or its line drifted. Proof: history or a search finds it at its present place. Repair: re-point. A target deleted outright stays as written: it is the record.
- **Unnamed reference** — the body cites a spec, map, or review by description alone, and history names it. Repair: add the name or link beside the description, leaving the words.
- **Stale Status** — a later ADR says it supersedes or amends this one, and this one's Status doesn't say so. Repair: add it, in the form the directory's ADRs already use.
- **Number collision** — two ADRs in one directory share a number. Renumbering breaks anything that cites them: a question.
