# Shape

The one session that is the human's. It ends with a charter an agent can build from without asking the human anything, an effort branch that can run, and a lead that has taken over. Load `/grilling`, `/domain-modeling`, and `/hitl-questions` now.

Each step below ends on its own done-when; don't start the next before it holds.

1. **Name the destination**: the working thing, in one or two lines. **Done when** the human has confirmed the wording. **If the whole effort fits one agent session**, it needs no lead: say so, point at `/iterate`, and stop.

2. **Write the acceptance behaviors**: what the human will see when it works, each as a `B<n>` line in [CHARTER.md](CHARTER.md)'s shape — how a user reaches it and the observable end state that proves it. **Done when** every behavior names something an agent can observe by driving the app, and the human agrees the list is the definition of done. Behaviors agents add during the run never change that list; Close judges against it.

3. **Settle the verification harness** — the `verify-<app>` skill that can drive those behaviors:
   - The app has one → each behavior gets a feature file in its feature map, marked pending in its first line until a piece proves it.
   - The app exists without one → load `/create-verification-skill` and run it for this app now, then add the feature files as above.
   - Greenfield → nothing can be driven yet. The charter says so, and Plan must make a walking skeleton plus its verify skill the first foundation piece, with the app taking its port and data directory from the environment so copies can run side by side.

   **Done when** the charter's verification line names an existing skill, or the foundation piece that will build it.

4. **Settle the principles.** Load `/principles` and read the governing `PRINCIPLES.md` files; draft what's missing with the human, asking which way they lean on the trade-offs this effort will hit. **Done when** you can predict their call on the hardest decisions you can foresee.

5. **Agree the design and what's out of scope** — the major parts, the interfaces between them, the flows that matter — at the altitude the human holds it. **Done when** the human has confirmed both sections.

6. **Set the CI jobs and the limits.** CI is the commands the gate runs on every change, per [CHARTER.md](CHARTER.md): take them from `TESTING.md`'s Green set and the repo's build, lint, and type checks, and run each once here to see it pass. The limits: pieces at once, build slots, drive slots (from the verify skill's answer on running instances side by side), the machines and services agents may use, the proof bar, and the human tasks already known. For the proof bar, ask how hard a piece should be proven before it lands: every long run a piece repeats slows the whole effort, so name the ones that run only at Verify or Close, and the kinds of failure not worth hardening against. **Done when** every CI job passes on the current branch and every Limits line has a value.

7. **Prediction test.** Write how you would decide the hardest calls you can foresee, one line each with the ground you'd cite, and let the human correct them. Fold every correction into the principles or design. **Done when** a pass comes back with no correction.

8. **Cold read.** Write the charter to `docs/wayfinder/<slug>.md`, then spawn one fresh agent on the auditor tier (load `/model-policy` to resolve it) given only the charter's path and asked for every question it would have to guess on to build this. Each question is answered in the charter or listed under **Delegated** with the human's OK. An answer that rewords a behavior rewords its feature file too: after step 9 the effort branch changes only through the gate. **Done when** no question is open.

9. **Create the effort** with [wf.py](wf.py), the local forge SKILL.md describes. From the branch the effort should start from, with what it builds on committed, run `wf.py setup <slug> --charter docs/wayfinder/<slug>.md`, adding `--add <path>` for each uncommitted file or directory Shape made that the effort needs — the verify skill, its feature files. Setup creates `effort/<slug>` with those committed, the store, and the hook that protects the branch. Then delete the copies it committed from this checkout, so they can't collide with the effort when it merges back. Run [preflight.sh](preflight.sh) `<slug>`, fix whatever it reports, and rerun it. Then create the plan (`wf.py issue create --label wayfinder:plan`) in the body shape SKILL.md gives it, with every behavior in the map "not covered yet" and **Where it stands** reading "Not planned yet." **Done when** preflight passes and the plan exists.

10. **Hand off.** Load `/multiplexer` and hand off to a tab of this session: the repo root, the plan's title as the label, `/wayfinder <slug>` as the prompt, and the decider tier's model for the session. Tell the human the label, and that they talk to the lead there from now on. With no multiplexer, give them the command to start it and stop.
