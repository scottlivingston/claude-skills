---
name: release
description: Bump the plugin version, commit the working tree as coherent changes, and push to origin.
disable-model-invocation: true
---

Publish the working tree as a release of the `scott-skills` plugin: read what changed, group it into commits that each stand alone, bump the version, push. The plugin has no build and no tests — the artifact is the repo itself — so the whole quality bar is that the history reads truthfully and the version moved.

## Precondition

On `main`, with a clean-enough tree to reason about: `git status -sb` and `git diff --stat`. Nothing to commit means nothing to release — say so and stop.

## Process

1. **Read every change in full** — `git diff` over the whole tree, not the `--stat`. The commit message is a claim about what the diff does; you cannot write it from filenames. Include untracked files (`git status --porcelain`) — a new skill directory shows up nowhere in `git diff`.

2. **Account for work that isn't yours.** A tree can hold edits from a parallel session in another window. Any file you did not touch in this conversation is someone else's work: name those files to the user, say what the diff appears to do, and **ask whether to include them** before committing. Never describe another session's work in a commit message as though you had made it — describe the diff, and say in the report that you did.

3. **Group into commits.** One commit per coherent change — a change is coherent when its subject line can name it without "and". Two unrelated bodies of work in one tree are two commits, in dependency order. Do not split a single change across commits to make the history look busier.

4. **Write each message** in this repo's format — subject `<area>: <what changed>`, lowercase, imperative, no trailing period, where `<area>` is the skill or the layer it cuts across (`wayfinder`, `review gates`, `add <skill>` for a new one). Then a blank line and `-` bullets, one per substantive change, each saying what now happens differently rather than which file moved. `git log -8` before writing, to match the register.

5. **Bump the version.** `.claude-plugin/plugin.json` carries `version`; the series is `0.MINOR.0`, one **minor** per release regardless of size. Append `; bump to <new version>` to the **last** commit's subject, and stage the bump with it. If this release adds or removes a skill, or changes the shape of the workflow the plugin advertises, also update the `description` in `.claude-plugin/plugin.json` **and** the matching one in `.claude-plugin/marketplace.json` — they are duplicates and must stay identical.

6. **Commit and push.** Every commit ends with the co-author trailer for the model that wrote it. Then `git push origin main`, and report the pushed range (`git log --oneline origin/main@{1}..origin/main`) so the user sees exactly what shipped.

## Rules

- **The README is part of the release.** A change to how the workflow works that the `README.md` still describes the old way is an incomplete release — check it before committing, not after pushing.
- **Never force-push, never rewrite pushed history.** A bad release is fixed by the next one.
- **Ask before including work you did not do** (step 2). This is the one place the skill stops for the human.
