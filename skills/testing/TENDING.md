# Tending a TESTING.md

The off-purpose checks `/tend` runs on a `TESTING.md`, against what [SKILL.md](SKILL.md) says the file is for. Each names its proof and the repair the proof licenses.

- **Dead invocation** — a command that no longer resolves: a missing script, target, package, binary, or flag. Proof: run the cheapest form that shows it resolves, from the repo root — the runner's list, help, or dry-run, or the recipe's own filter on one test — never the full suite, and never a service the recipe brings up. A test that runs and fails is the code's problem, not the doc's. Repair: the invocation the environment now offers for the same job; none found is a question.
- **Not cold** — a command that needs a `cd`, a running service, or an env var its line doesn't name. Proof: it fails from the repo root for that reason. Repair: name the precondition on the same line.
- **Stale scoping** — *Scoping to a change* names packages, paths, or dependency edges the tree no longer has, or misses packages it has. Proof: the workspace manifests. Repair: recompute the named sets from the manifests.
- **Drifted cache** — a recipe restating a lookup (a scripts block, a task description) that no longer matches it. Proof: the lookup's present output. Repair: strike the copy, per `/cold-read`'s stale-cache repair. A copy that still matches stays: it puts the fact on the line where an agent needs it.
- **Off-heading content** — a heading outside the five in *Sections*, or prose that isn't a recipe. Repair: move recipes under the section they serve; what isn't a recipe is checked as `/cold-read` residue or misfiled below.
- **Copy, not delta** — a scoped file restating a root section unchanged. Proof: the root section's text. Repair: strike the copy.
- **Misfiled entry** — a coding standard or setup instruction. Proof: the scope sentence in SKILL.md's *The file*. Repair: move a standard into the governing `CONVENTIONS.md`; setup is a question naming where it belongs.
