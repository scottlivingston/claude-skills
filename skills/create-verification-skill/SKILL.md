---
name: create-verification-skill
description: Generate a project-local skill per app that drives the real app the way a user does — web, CLI/TUI, desktop, service, any stack — and proves behavior with captured evidence. `/create-verification-skill [app...]` in a repo or monorepo with no scripted way to exercise its apps.
disable-model-invocation: true
---

# Create a verification skill

Generate `.claude/skills/verify-<app>/` for each app: a project-local skill that launches the real app, exercises a feature the way a user would, and captures evidence. Every one lives in the repo root's `.claude/skills/`, monorepo or not, with `<app>` the app's workspace or directory name. Its reader is the next agent, arriving cold and mid-task, who has never seen the app. It proves behavior through the user's path; it is not a test recipe — those live in `TESTING.md`, per `/testing`.

## 0. Pick the apps

Apps named as arguments are the list. Otherwise list the repo's user-facing apps — in a monorepo, the workspace packages a user runs or touches, not shared libraries — drop any that already have a `verify-<app>` skill, and confirm the list with the human (load `/hitl-questions` first). Steps 1–4 then run for one app at a time, each proved before the next starts, and an app another one needs running goes first.

**Done when:** the human has confirmed the list of apps.

## 1. Interview the repo

Answer these from the codebase for the app in hand. Ask the human only what no lookup can settle.

- **Surface:** what a user actually touches — web UI, CLI/TUI, desktop app, API, mobile app, library. An app with several picks its primary one and notes the rest.
- **Run:** how the app starts locally from the repo root, preferring the repo's own documented command scoped to this app (a workspace filter or task target); ports, env vars, seed data, auth, and any sibling app it needs running.
- **Drive:** how an agent can interact with it. Existing harnesses first — Playwright/Cypress specs, expect scripts, PTY helpers, curl-able endpoints, a debug port. Only then a generic recipe: browser/CDP for web and Electron, tmux/PTY for CLI/TUI, plain HTTP for services.
- **Observe:** what evidence can be captured — screenshots, terminal transcripts, response bodies, logs, exit codes, DB state.
- **Isolate:** whether two instances can run side by side (ports, data dirs, profiles). Where they can't, the generated skill says so and refuses to drive an instance it didn't start.

A checkout that doesn't build or start gets fixed first, or reported precisely — a skill written against a broken base teaches wrong steps. When an irrelevant missing asset blocks startup (a static dir the API never serves, a sample config), the generated skill may create it, marked as verification scaffolding, and remove it in cleanup.

**Done when:** every bullet has an answer grounded in a file, a command's output, or the human.

## 2. Generate the skill

Write `.claude/skills/verify-<app>/SKILL.md` with frontmatter — `name: verify-<app>` and a `description` naming the app, the surface, and when to reach for it — and these sections, each grounded in what the interview found:

- **App:** the app's directory in the repo, and the shared packages it depends on.
- **Launch:** the exact command, run from the repo root, that starts the app for verification, the ready signal (a log line, a port answering, a prompt), and teardown. A short-lived CLI or TUI has no server to keep alive: launch is building the binary or installing deps once, then each drive gets its own isolated PTY or tmux session. A sibling app this one needs is started by pointing at that sibling's `verify-<sibling>` Launch section, never by copying it.
- **Doctor:** one read-only check answering "is this instance worth driving?" — process up, right build, port owned by us, auth valid. The agent runs it first and again whenever anything looks off.
- **Drive:** the harness recipe with this repo's real selectors and commands, on stable handles — ARIA labels, data attributes, prompt strings, route paths.
- **Evidence:** what a proof captures and where it lands. Proof exercises the real user path, never internal setters or test-only endpoints; captures the action and the resulting state, not just the final screen; checks side effects (files written, rows inserted, messages sent) alongside what's visible; mocks only where a production boundary already isolates the external system. A dry-run or test mode is verified by observing what it actually skips (files, network, git refs) — some dry-runs still touch the network or open a browser.
- **Cleanup:** tears down exactly what the run started, tracked by PID or session name rather than process name, plus scratch state. Evidence survives cleanup, at a location the skill names.
- **Helpers:** every shipped script is executable, and its invocation appears in the skill body.

**Done when:** the skill has every section above and no placeholder remains.

## 3. Seed the feature map

Write `.claude/skills/verify-<app>/features/README.md` and one file per user-facing feature — the top 3–5 to start, found in routes, commands, menus, or docs — in the shape of [`references/feature-map-example/`](references/feature-map-example/). Each file says, from the user's point of view, what the feature is, how to reach it, how to drive it, and what observable end state proves it, under four H2s: `Sub-features`, `How to get to it (user POV)`, `Driving it with <harness>`, `Gotchas`. The map is the repo's maintained verification source: a proof that drives one convenient entry point is incomplete when the map lists others.

**Done when:** the README indexes every feature file and every feature file has the four sections.

## 4. Prove it

Run the generated skill's own instructions end to end: launch, doctor, drive one mapped feature, capture evidence, clean up. Fix what fails, running the generated cleanup after every failed attempt so broken runs don't strand processes and ports. A generated skill that was never executed is a draft.

**Done when:** one clean run completed and its evidence still exists at the named location after cleanup.

Then point the human at `/maintain-verification-skill` for keeping the map honest as the app changes.
