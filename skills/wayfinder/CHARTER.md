# The effort charter

Shape writes it, `effort.py setup` commits it, the effort branch carries it at `docs/wayfinder/<slug>.md`, and every agent of the run reads it from its checkout. Only the human changes it: an agent that finds it wrong escalates per `/deciding`'s third case.

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

## Limits

- **Pieces at once:** <n, default 4>
- **Build slots:** <how many builds and tests the host runs at once: the size of `sc`'s `build` pool, which CI jobs share>
- **Drive slots:** <how many running copies of the app the host can hold: the size of `sc`'s `drive-<app>` pool; 1 when instances can't run side by side>
- **Machines and services:** <what agents may use>
- **Proof bar:** <what a piece shows before it lands, and which long runs — soak, stress, repeats under load — wait for Verify or Close instead>
- **Human tasks known now:** <each, or none>

## Delegated

- <a question the cold read raised that the human handed to the agents to decide>
```

Every section is present; **Delegated** and **Out of scope** may say "none". A behavior's end state names something an agent can observe — never "works correctly".

## CI lives in `sc.toml`

The effort's CI is not in the charter: it is the jobs of the `sc.toml` at the repo root, which `effort.py setup` commits beside the charter (`sc init --help` shows the file's shape).

```toml
[jobs.<job name>]
command = "<one shell command, run from the repo root of a clean checkout; exit 0 is green>"
pool = "build"
timeout = "<how long it may run, e.g. 30m; sc's default is 20m>"
```

The jobs are what a hosted pipeline would run, as commands the gate runs on this machine against every change: the repo's Green set per `/testing`, plus its build, lint, and type checks. A job that needs several steps is a script in the repo. A job installs what it needs, runs anywhere a clean checkout sits, takes any port or data directory from the environment, and leaves no process running — the gate fails one that does. There is at least one job, and each names the `build` pool so CI and the agents' own builds share one cap. Setup adds the effort branch to `protected` and writes its `[gates."effort/<slug>"]` table, so Shape writes neither.
