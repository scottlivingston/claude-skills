# Design It Twice

When the user wants to explore alternative interfaces for a chosen deepening candidate, run several designers in parallel. Based on "Design It Twice" (Ousterhout) — your first idea is unlikely to be the best.

Uses the vocabulary in [SKILL.md](SKILL.md) — **module**, **interface**, **seam**, **adapter**, **leverage**.

## Process

### 1. Frame the problem space

Before running the designers, write a user-facing explanation of the problem space for the chosen candidate:

- The constraints any new interface would need to satisfy
- The dependencies it would rely on, and which category they fall into (see [DEEPENING.md](DEEPENING.md))
- A rough illustrative code sketch to ground the constraints — not a proposal, just a way to make the constraints concrete

Show this to the user, then immediately proceed to Step 2. The user reads and thinks while the designers work.

### 2. Run the designers

Run the designers as one dynamic `Workflow` (this skill is your authorization to use it), on the decider tier (load `/model-policy` to resolve it). **Start from [design-it-twice.template.js](design-it-twice.template.js) — fill it, don't author from scratch.** It gives each designer a different design constraint and asks each for a **radically different** interface.

Fill it with a technical brief separate from the user-facing explanation in Step 1: file paths, coupling details, the dependency category from [DEEPENING.md](DEEPENING.md), and what sits behind the seam. Hand it both [SKILL.md](SKILL.md)'s vocabulary and the project's `CONTEXT.md` (per `/domain-modeling`), so every design names things in the architecture's language and the project's domain language.

### 3. Present and compare

Present designs sequentially so the user can absorb each one, then compare them in prose. Contrast by **depth** (leverage at the interface), **locality** (where change concentrates), and **seam placement**.

After comparing, give your own recommendation: which design you think is strongest and why. If elements from different designs would combine well, propose a hybrid. Be opinionated — the user wants a strong read, not a menu.
