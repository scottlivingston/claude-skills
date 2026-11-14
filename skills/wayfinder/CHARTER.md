# The effort charter

Shape writes it, `wf.py setup` commits it, the effort branch carries it at `docs/wayfinder/<slug>.md`, and every agent of the run reads it from its checkout. Only the human changes it: an agent that finds it wrong escalates per `/deciding`'s third case.

```markdown
# <effort title>

## Destination

<the working thing, in one or two lines>

## Acceptance behaviors

- **B1: <behavior>** — <how a user reaches it> → <the observable end state that proves it: a screen, an output, a file, a row>
- **B2: …**

Verified through `.claude/skills/verify-<app>/` (or: built by the first foundation piece).

## Principles

<deltas over the governing PRINCIPLES.md for the trade-offs this effort will hit; "none beyond PRINCIPLES.md" when there are none>

## Design

<the major parts, the interfaces between them, the flows that matter — at the altitude the human holds it>

## Out of scope

- <what this effort deliberately leaves alone>

## CI

- **<job name>:** `<one shell command, run from the repo root of a clean checkout; exit 0 is green>`
- **<job name>:** `…`

## Limits

- **Pieces at once:** <n, default 4>
- **Build slots:** <how many builds and tests the host runs at once; the gate runs this many CI jobs side by side>
- **Drive slots:** <how many running copies of the app the host can hold; 1 when instances can't run side by side>
- **Machines and services:** <what agents may use>
- **Human tasks known now:** <each, or none>

## Delegated

- <a question the cold read raised that the human handed to the agents to decide>
```

Every section is present; **Delegated** and **Out of scope** may say "none". A behavior's end state names something an agent can observe — never "works correctly".

**CI** is what a hosted pipeline would run, as commands the gate runs on this machine against every change: the repo's Green set per `/testing`, plus its build, lint, and type checks. Each job is one line in exactly that shape, since `wf.py` parses it; a job that needs several steps is a script in the repo. A job installs what it needs, runs anywhere a clean checkout sits, takes any port or data directory from the environment, and leaves no process running — the gate fails one that does. There is at least one job.
