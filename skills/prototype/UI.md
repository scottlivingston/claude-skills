# UI Prototype

Generate **several radically different UI variations** on a single route, switchable from a floating bottom bar. The user flips between variants in the browser, picks one (or steals bits from each), then throws the rest away.

If the question is about logic/state rather than what something looks like — wrong branch. Use [LOGIC.md](LOGIC.md).

## When this is the right shape

- "What should this page look like?"
- "I want to see a few options for this dashboard before committing."
- "Try a different layout for the settings screen."
- Any time the user would otherwise spend a day picking between three vague mockups in their head.

## Where the variants live

Prefer mounting in an existing page; an empty route hides design problems. The variants render on that route, gated by a `?variant=` URL search param — its data fetching, params, and auth stay, and only the rendered subtree swaps. Something without a page yet that would naturally live inside one (a new dashboard section, a settings card, a step in an existing flow) still mounts in its host page.

Only when nothing has a plausible host — an entirely new top-level surface — create a throwaway route following the project's existing routing convention, named so it's obviously a prototype (e.g. `prototype` in the path), with the same `?variant=` pattern.

## Process

### 1. State the question and pick N

Default to **3 variants**. More than 5 stops being radically different and starts being noise — cap there.

Write down the plan in one line, in the prototype's location or a top-of-file comment:

> "Three variants of the settings page, switchable via `?variant=`, on the existing `/settings` route."

### 2. Generate radically different variants

Draft each variant. Hold each one to:

- The page's purpose and the data it has access to.
- The project's component library / styling system (TailwindCSS, shadcn, MUI, plain CSS, whatever).
- A clear exported component name, e.g. `VariantA`, `VariantB`, `VariantC`.

Variants must be **structurally different** — different layout, different information hierarchy, different primary affordance, not just different colours or copy. If two drafts come out too similar, redo one with explicit "do not use a card grid" guidance.

### 3. Wire them together

A single dispatcher component on the route reads `?variant=` (default `A`) and renders the chosen variant plus the switcher bar. On an existing page, data fetching stays above the dispatcher.

### 4. Build the switcher bar

One shared `PrototypeSwitcher` component, wherever shared UI lives: a small fixed bar at the bottom centre showing the current variant key and, if it exports one, its name (`B — Sidebar layout`). Arrows and ←/→ cycle variants via a shareable URL param; the bar is visually distinct and dev-only.

### 5. Hand it over

Surface the URL (and the `?variant=` keys). The user will flip through whenever they get to it. The interesting feedback is usually **"I want the header from B with the sidebar from C"** — that's the actual design they want.

### 6. Capture the answer and clean up

Once a variant has won, capture the answer — which variant and why — then capture the prototype the way the [SKILL](SKILL.md) describes. Fold the winner into the real code and move the rest onto the throwaway branch, not into main:

- **On an existing page** — fold the winner into the page; drop the losing variants, the dispatcher, and the bar from main.
- **On a throwaway route** — promote the winning variant to a real route; drop the throwaway route, the dispatcher, and the bar from main.

The full set of variants is the primary source, so it lands on the throwaway branch, not the bin.

## Anti-patterns

- **Sharing too much code between variants.** A shared `<Header>` is fine; a shared `<Layout>` defeats the point. Each variant should be free to throw out the layout.
- **Wiring variants to real mutations.** Read-only prototypes are fine. If a variant needs to mutate, point it at a stub — the question is "what should this look like", not "does the backend work".
- **Promoting the prototype directly to production.** Rewrite the winner properly when you fold it in.
