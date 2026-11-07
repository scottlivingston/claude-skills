# Tending a CONVENTIONS.md

The off-purpose checks `/tend` runs on a `CONVENTIONS.md`, against what [SKILL.md](SKILL.md) says the file is for. Each names its proof and the repair the proof licenses.

- **Uncheckable rule** — a rule no reviewer could cite against a hunk ("prefer clarity", "keep it simple"). No lookup settles what the human meant: a question, drafted as a checkable rewrite for them to accept or strike.
- **Tool-enforced rule** — a rule the formatter or linter config in the tree already enforces. Proof: the config line that enables it. Repair: strike the rule. A lint that covers only part of a rule leaves it standing, since review still catches the rest.
- **Copy, not delta** — a scoped file restating a root rule unchanged. Proof: the root rule's text. Repair: strike the copy. A scoped rule that differs from the root is an override and stays.
- **Restated elsewhere** — a rule repeated in `CLAUDE.md` or `AGENTS.md`. Proof: the two texts. Repair: replace the restatement with a pointer to `CONVENTIONS.md`. A pointer that names topics without stating their rules is not a restatement.
- **Misfiled entry** — something the file is not for: how to run or set up the project, how an agent should operate, or a product preference that picks between designs. Proof: the scope sentence in SKILL.md's *The file*. Repair: move a test recipe into the governing `TESTING.md` when one exists and the recipe still resolves; anything else — and any entry bound for `PRINCIPLES.md` — is a question naming where it belongs.
