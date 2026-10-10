# Effort log format

One directory per effort, at `<effort-log dir>/<slug>/`: an **index** holding what every slice needs, and one file per slice holding what only that slice needs. The index's last slice line carries the effort's current stage — nowhere else does.

## `index.md`

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

- [Slice 1 — <name>](slice-1.md) · <build | spike | research> · <stage>
```

One line per slice, newest last; a slice's stage changes on its line here.

## `slice-<n>.md`

```markdown
# Slice <n> — <name>

Why now: <one line>
Base: `<sha>` · Build branch: `<branch>` (one per part when the brief has parts)

**Decisions**
- <one line each, in the human's terms, appended as they settle>

**Brief**
- Delivers: <what the human will be able to see or do>
- Done when: <observable checks>
- Not in this slice: <what's deliberately left for later>
- Parts (only when the work splits): <part> — <files it owns>; Done when: <its checks>

**Build** — <agent report, one per part: what was built, how to see it, deviations; merge sha>

**Review** — <fixes applied, tickets filed, answers given>

**Learned** — <what surprised; what it changes about the destination or the fog>
```

## Stages

`shaping` → `building` → `reviewing` → `reflecting` → `done` for a build slice; `exploring` → `reflecting` → `done` for a spike or research slice. Sections a slice hasn't reached yet are left out rather than written empty.

## An old single-file log

A log that is one `<slug>.md` with its slices inline is split into this layout the first time `/iterate` opens it — each slice's section moved verbatim into its own file, the stage moved to its index line — and the split committed before anything else.
