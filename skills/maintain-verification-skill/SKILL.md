---
name: maintain-verification-skill
description: Keep a project's verification skill and feature map honest — a source reader per feature, one live pass driving every feature, at most one PR of proven corrections. `/maintain-verification-skill [app]` periodically, or after an app's user-facing surface changes.
disable-model-invocation: true
---

# Maintain a verification skill

The upkeep loop for a skill made by `/create-verification-skill`, or any project-local verification skill with a feature map. A map rots as the app changes. The unit of rigor is the feature, not the sentence: every feature file is covered from source and every feature is driven live, without proving each bullet.

## Outcomes

Every run ends on exactly one, named in the report:

- **clean** — every feature got source and live coverage and nothing needs shipping. No branch, no PR.
- **changed** — one PR ships proven doc, harness, or map corrections.
- **blocked** — coverage couldn't finish, or a proven fix couldn't ship safely. The report says exactly what blocked it.

## Edit scope

Edits stay inside the verification skill's own directory — its `SKILL.md`, `features/`, and the harness scripts it owns. Product code is read, never edited: a behavior the map describes that the app no longer has is either doc drift (fix the map) or a product regression (report it to the human).

## Pass

0. **Locate the target** — a project-local skill with launch and drive sections and a feature map, in the repo root's `.claude/skills/verify-*/`. A named app selects `verify-<app>`. With no name, one candidate is the target; several are normal in a monorepo, so ask whether to maintain one or all of them, loading `/hitl-questions` first. Several targets run the whole pass one at a time, each with its own outcome and at most its own PR. None: stop and point at `/create-verification-skill`.

1. **Index hygiene.** Reconcile the feature map README against its sibling files and fix missing, extra, duplicate, and dead entries.

2. **Source wave.** One read-only background agent per feature file, launched together on the **decider tier** (load `/model-policy` to resolve it). Each explains from source how its user-facing feature works and returns: feature summary, source entry points, likely drift with citations (or none), and one live-verification recipe. These agents never drive the app and never edit files.

   **Done when:** every feature file has a returned summary.

3. **Reconcile.** Merge overlapping recipes into as few app states as practical. Spot-check cited drift; leave clean claims unproven. Sweep recent churn under the app's directory and the shared packages its skill names for user-facing surfaces the map lacks, naming a concrete source path before calling one missing.

4. **Live pass** — required even when source looks clean. You own all driving, under the verification skill's own launch model: one long-lived instance driven serially for servers and UIs, or a fresh isolated session per drive for short-lived CLIs. Its Launch section decides, not this skill. Drive every feature at least once, and hold three invariants whatever fails:
   - **Health before driving.** Run doctor before the first drive, on each fresh session where sessions are the unit, and again after any failed drive. Where doctor can't see the failure (a wedged UI on a healthy process), reset to a known state or relaunch.
   - **Evidence survives.** Every proof captured so far is still at its named location after each cleanup — checked, not assumed.
   - **Nothing outlives its use.** Residue from a failed attempt is cleaned whether the session is stuck, exited, or shared. On a shared instance, clean the residue and keep the instance.

   A doctor failure caused by skill drift is drift: fix it within edit scope, restart only what the fix invalidated, and retry once before calling the run **blocked**. A feature that can't be reached is *verified-unreachable* only with the concrete prerequisite (auth, entitlement, OS, external state) and the route attempted. If the map omits that prerequisite, that is drift. Every harness fix from triage is driven live again before it ships. Final teardown comes after the last drive, re-proofs included, and keeps the evidence.

   **Done when:** every feature was driven live or recorded as verified-unreachable, and teardown left only evidence.

5. **Triage** each discrepancy:
   - **Doc drift** — the map's user-POV description is wrong or missing. Fix the map.
   - **Harness gap** — the behavior works but the harness can't drive it. Fix the harness under the same helper rule as generation: scripts executable, invocation shown in the skill body.
   - **Product gap** — the app is actually broken. Record it for the human and leave it out of the PR.

6. **Ship or stop.** For **changed**, open one PR of the proven corrections, from a branch, after re-reading every changed file. For **clean** or **blocked**, no PR. Report the outcome, the features covered, the unreachable prerequisites, and any product gaps.

Keep run notes (features covered, unreachable prerequisites, confirmed drift, outcome) in scratch, uncommitted.
