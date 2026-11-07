---
name: evals
description: Test whether a plugin's skill text changes what an agent does — eval cases under evals/, their graders, running them, and A/B-comparing a skill edit against the text before it. Consult before writing or running an eval, before claiming a skill edit fixes a behaviour, or before deleting a skill sentence as redundant.
---

# Evals

An eval runs a real agent on a prompt, in a clean sandbox with only this plugin loaded, and grades what it did. It is how a claim about skill text — "this rule stops the agent narrating history", "this sentence does nothing" — becomes something you have observed rather than argued. The tool is `claude plugin eval`; its reference is https://code.claude.com/docs/en/plugin-evals.md, and this skill covers only how this repo uses it.

## Layout

```
evals/
├── <skill>/<case>/     one directory per case, under the skill whose text it tests
│   ├── prompt.md       frontmatter + the prompt, written as a user would type it
│   ├── graders/*.md    one grader per file
│   ├── case.yaml       only for what prompt.md can't hold: a scaffold script, a transcript to resume
│   ├── scaffold.sh     seeds the run's working directory from fixture/
│   └── fixture/        the files the agent starts with
├── lib/                helpers cases share; not a case
└── results/            run output, gitignored
```

- **Tags.** Every case's `tags` include the skill it tests, so `--tag <skill>` runs that skill's cases. Add `smoke` to the few cheap cases that together cover the plugin's core, for a fast run before a release.
- **Fixtures.** A case that needs files seeds them with [evals/lib/seed-repo.sh](../../evals/lib/seed-repo.sh), which commits `fixture/` as a clean git repo so the agent's changes show in `git diff`. The case's `scaffold.sh` is one line calling it, and `case.yaml` names it under `context.scaffold_script`.

## Writing a case

A case guards one behaviour. Before it counts, show that it can fail.

- **Reproduce the conditions, not the instruction.** Phrase the prompt the way the human would, without naming the skill or the rule under test. When the behaviour depends on the situation — a change that makes an existing comment false, a long discussion before the request — build that situation into the fixture or the transcript.
- **Grade with lookups before judgement.** A `regex` over a file the agent wrote, `tool_used` for whether a skill fired (the docs give the `Skill` input pattern), `file_exists` for an artifact. Use an `llm` grader only for what no pattern can decide, and give it a PASS/FAIL rubric.
- **Pair every "didn't do the bad thing" grader with a "did the task" grader.** A run that changes nothing passes every negative check.
- **Prove the grader goes red.** Run the regex against the untouched fixture and against a hand-written bad output, and check it flags both while passing a hand-written good one. A grader nobody has seen fail proves nothing.
- **Prove the case goes red**, when the case backs a fix: it must fail on the text before the fix. A case that passes on both sides shows the behaviour doesn't reproduce in that setup, not that the fix works — say so rather than presenting it as evidence.

## Replaying a real session

Some behaviour only shows up deep in a session: the agent writes for the conversation it is in, not for a stranger. A **replay case** resumes a real transcript just before the turn that went wrong, so the agent faces the same context it did then.

- **Cut** the transcript with [cut-transcript.py](cut-transcript.py) `<transcript> <record> <case-dir>`, where `<record>` is the user turn that opened the incident (numbered as `/autopsy`'s `render.py` numbers them). It writes `session.jsonl` and prints that turn's text, which is the case's prompt, verbatim.
- **Bake** with [bake-history.py](bake-history.py) `<plugin-root> <eval-dir>`. A transcript stores each skill it loaded as a copy of the body from that time, and a resumed session obeys the copy, not the plugin's file. Baking writes `history.jsonl` from `session.jsonl` with this plugin's current text swapped in; `case.yaml` names `history.jsonl` under `context.history_file`. [run-evals.sh](run-evals.sh) bakes before every run, each side of an A/B with its own text, so baking is never a separate step.
- **Run on the session's model** — pass `--model` with the model the transcript records — and with `--ablation none`, since the history carries the skill text even when the plugin is removed.
- **The workspace is empty.** The replay starts in a fresh directory, not the session's repo. Grade the reply when the turn was about what the agent said; when it depended on files, the scaffold recreates the ones it needs.
- **Long transcripts cost more per run**, since the whole history is input each time. Estimate before a batch: a transcript of a few hundred KB runs several times the cost of a fixture case.
- **Replay cases stay out of git.** They live under `evals/local/<skill>/<case>/`, which is gitignored, because a transcript can hold anything from the human's other work and this repo is public. A case moves into `evals/<skill>/` only after the human has read the scrubbed transcript and said yes.

## Running

Every run goes through [run-evals.sh](run-evals.sh), called by its full path in this skill's directory (`${CLAUDE_SKILL_DIR}/run-evals.sh`): it bakes replay histories before each run, and it is the one command the sandbox exception covers. Flags after `--` go to `claude plugin eval` unchanged; `--repo <dir>` targets a plugin repo other than the current directory's, so the call never needs a `cd`.

Runs cost real tokens — roughly $0.10–0.20 per agent run on a small fixture — and the output prints the cost. Tell the human the run count before a run that will cost more than a few dollars.

| Purpose | Arguments to `run-evals.sh` |
| --- | --- |
| Check a case loads and its graders work | `-- --case <name> --runs 1 --ablation none` |
| Trust a result | the same with `--runs 5` or more |
| Did a skill edit change behaviour? | `--base HEAD -- --case <name> --runs 5` |
| Before a release | `-- --tag smoke` |

Add `--allow-tools Edit Write` (or the Bash patterns it needs) when the agent must change files — by default it can only read. Add `--scaffold` for a case with a scaffold script; that script runs as the human, outside the sandbox, so pass it only for cases written in this repo, and expect the human's settings to ask before every such run. Add `--keep-temp` to read what the agent actually wrote: the workspace is `<kept dir>/sealed/home/cwd`, opened with `chmod 700` on the kept directory and on `sealed`, and nothing that loads git config runs inside it.

**`--base <ref>`** makes the run an A/B: the working tree's cases run against the plugin at the ref (in a throwaway worktree) and against the working tree, both in parallel, and it prints each case's score on both sides and every grader whose pass rate moved. It is the tool for every "did this edit help" question, including whether a sentence is a no-op: delete it in the working tree, compare against `HEAD`, and the sentence earns its place only if a score drops.

`--base` swaps only the plugin, so it can't compare text a workflow template writes into an agent's prompt: that text lives in the case's prompt, the same on both sides. Write the case's prompt as the template renders it, copy the case to `evals/local/<skill>/<case>-without/` with the line under test removed, and run both with `--case '<case>*'`.

**Reading scores.** One run is an anecdote. At five runs a case, a difference of one run either way is noise; look for a grader that moved by two or more, then read the kept workspaces to see why.

## Sandbox

An eval run starts its own Claude process, which reads the user's login from the macOS keychain and writes under `/tmp` — both outside Claude Code's Bash sandbox. Inside the sandbox it fails with `EPERM: operation not permitted, mkdtemp '/tmp/e-…'` or `Not logged in`.

The fix is the human's, in `~/.claude/settings.json` (project settings can't loosen a sandbox that forbids unsandboxed commands):

- `sandbox.excludedCommands` gets one entry: the **installed** plugin's copy of the script, `/Users/<user>/.claude/plugins/cache/<marketplace>/<plugin>/*/skills/evals/run-evals.sh *`. Never the repo's copy or a bare file-name pattern: the repo is writable from inside the sandbox, so any agent could change the script and then run it outside, while the plugin cache is not.
- `permissions.ask` gets `Bash(*run-evals.sh* --scaffold*)`, so a run that executes case scripts outside the sandbox always waits for the human, auto mode included.

An exclusion covers a call only when every part of it matches, so run the script bare: no pipe into `tail`, no `cd` in front, no redirect. Until the release that puts the script in the cache — or when the exclusion is missing — give the human the exact command to run with the `!` prefix, and read the results from the files it writes.
