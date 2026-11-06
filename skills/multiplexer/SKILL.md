---
name: multiplexer
description: Open new Claude Code sessions and side panes in whichever agent multiplexer this session runs inside — Herdr or Rex — through one script, or carry on without one. Consult before a workflow skill hands work to a session of its own or shows the human something running beside the conversation.
---

# Multiplexer

Workflow skills open places for work to happen: a fresh session that takes over an effort, a pane running the thing the human should look at. [mux.sh](mux.sh), run from this skill's directory, does each in whichever multiplexer is in use, so a skill says what it wants opened and never which tool opens it.

## Which multiplexer?

The script resolves it from the session's environment: Herdr when `HERDR_ENV=1`, Rex when `REX_SESSION` and `REX_BLOCK` are set, Herdr when both are (it runs inside a terminal, so it is the inner one), otherwise none. Setting `MUX=herdr|rex|none` overrides the detection. `mux.sh which` prints the answer.

## Operations

- **Hand off** — `mux.sh session <dir> <label> <prompt>`: opens the directory as its own Herdr workspace or Rex session, starts Claude Code there, and gives it the prompt, without taking the human's focus. A linked git worktree opens through Herdr's worktree helper so Herdr tracks its branch. Tell the human the label it printed; the new session owns the work from here.
- **Side pane** — `mux.sh pane <dir> <label> <command> [args...]`: runs a command in a pane below this one, without taking focus, kept open after it exits. For what the human watches — a dev server, a watcher, a prototype — never for work whose result this session needs, which runs in its own shell.

**Exit status 3 means no multiplexer**: the caller falls back to saying what to run, and never treats it as a failure. Any other failure leaves whatever was opened in place; report what the script printed.

## Adding a multiplexer

A new one is a pair of functions in `mux.sh` — `<name>_session` and `<name>_pane` — and a detection line in `which_mux`; the operations above are the contract every backend meets.
