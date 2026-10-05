# Effort log format

One file per effort, at `<effort-log dir>/<slug>.md`. Sections in this order; the slices accumulate at the bottom, newest last. The last slice's heading carries the effort's current stage — nowhere else does.

```markdown
# <Effort name>

Branch: `<branch>` · PR per slice: <yes | no | not asked> · Status: active

## Destination

<One paragraph in the human's words: what they want, who it's for, what "good enough to stop" looks like. Constraints already known.>

## Where it stands

<A few lines: what exists and runs today, and how to see it. Rewritten at every Reflect; before the first slice, "nothing yet".>

## Fog

- <something wanted but not yet shapeable> — <what would clear it>

## Slices

### Slice 1 — <name> · <build | spike | research> · <stage>

Why now: <one line>
Base: `<sha>` · Build branch: `<branch>`

**Decisions**
- <one line each, in the human's terms, appended as they settle>

**Brief**
- Delivers: <what the human will be able to see or do>
- Done when: <observable checks>
- Not in this slice: <what's deliberately left for later>

**Build** — <agent report: what was built, how to see it, deviations; merge sha>

**Review** — <fixes applied, tickets filed, answers given>

**Learned** — <what surprised; what it changes about the destination or the fog>
```

## Stages

`shaping` → `building` → `reviewing` → `reflecting` → `done` for a build slice; `exploring` → `reflecting` → `done` for a spike or research slice. Sections a slice hasn't reached yet are left out rather than written empty.
