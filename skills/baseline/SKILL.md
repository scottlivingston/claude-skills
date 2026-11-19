---
name: baseline
description: Seed a repo with Scott's default rules — mise for every command, the lint gate, comment and test standards, the doc set — global defaults plus the defaults for each language the repo holds. `/baseline` in a new repo, or again in a seeded one to bring it back to the defaults.
disable-model-invocation: true
---

# Baseline

Bring a repo to the defaults that hold across every repo, so that afterwards the repo carries them itself: its lint gate enforces the mechanical ones, its `CONVENTIONS.md` holds the ones review checks, and its `CLAUDE.md` and `TESTING.md` hold the ones an agent follows. Nothing in a seeded repo points back at this skill.

The defaults live beside this file:

- [`global.md`](global.md) — rules for every repo, whatever its language.
- `<language>.md` — a language's rules and how it meets each gate requirement `global.md` sets, with its installable files under `<language>/`. Today: [`rust.md`](rust.md).

## 1. Compare the repo to the defaults

Read `global.md`, then find the repo's languages and read the file for each one that has one. A language with no file gets the global rules only: tell the human which gate requirements are left unenforced for it, and write no checks of your own for them.

Give every rule in the files you read one status, from the repo as it stands:

- **held** — the repo already does it, by a check or in the doc the rule lands in.
- **missing** — nothing in the repo speaks to it.
- **differs** — the repo does something else on purpose: another formatter, a different cap, a stated exception.

**Done when:** every rule in every applicable file has a status grounded in a file or a command's output.

## 2. Settle what differs

A rule that differs is the human's call: the repo may be right for itself. Load `/hitl-questions` and put each one to the human as "adopt the default" or "keep the repo's, as a stated exception". A kept exception is written into the repo doc the rule would have landed in, so the next run finds it held.

**Done when:** no rule is left with the status differs.

## 3. Install the gate

Make the repo's `lint` task enforce every gate requirement in `global.md`, the way each language file says. Three traps:

- **Tools are pinned.** Every tool goes into `mise.toml` at an exact current version with the lockfile on, never `latest`.
- **A new check finds old code.** Fix what it finds in the same change. Never loosen a cap, add an exclude, or allow a lint to get to green. If the findings are too many to fix in this session, stop and give the human the count per check before going further.
- **Shipped files are copied, not rewritten.** A file under `<language>/copy/` lands byte for byte at the same path in the repo, so a later run can tell drift from a local edit. A repo-specific check goes in a file of its own beside them.

**Done when:** `mise run lint` exits 0 on the repo and its output shows each check's fixtures ran.

## 4. Write the rules into the repo's docs

Each remaining rule lands in the file its section of `global.md` or the language file names, in that file's own shape: load `/conventions` before writing `CONVENTIONS.md` and `/testing` before writing `TESTING.md`. Copy a rule's wording as given, and replace a placeholder with the repo's own names. A rule the gate enforces is not restated as a rule; `CONVENTIONS.md` opens with one paragraph listing what the gate covers.

**Done when:** every rule with the status missing is either enforced by the gate or written in its doc, and no rule appears in two docs.

## 5. Prove it

Run the repo's own gate in the order its `TESTING.md` now states, start to finish. Then report to the human: the rules added, the exceptions kept, the old findings fixed, and anything left unenforced.

**Done when:** the whole gate is green and the report names every rule whose status changed.

## Adding a language

A new `<language>.md` answers every gate requirement in `global.md` with a check that language's files ship, lists that language's own rules by the doc they land in, and keeps its installable files under `<language>/copy/` and `<language>/merge/` as `rust.md` describes.
