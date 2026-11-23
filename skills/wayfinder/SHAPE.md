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

6. **Set the CI jobs and the limits.** CI is the commands the gate runs on every change, written as the jobs of an `sc.toml` per [CHARTER.md](CHARTER.md): take them from `TESTING.md`'s Green set and the repo's build, lint, and type checks, and run each once here to see it pass. Write them into the `sc.toml` at the repo root, with the rest of what CHARTER.md says an effort's `sc.toml` holds, and leave the edit uncommitted for step 9. The limits: pieces at once, build slots, drive slots (from the verify skill's answer on running instances side by side), the machines and services agents may use, the proof bar, and the human tasks already known. For the proof bar, ask how hard a piece should be proven before it lands: every long run a piece repeats slows the whole effort, so name the ones that run only at Verify or Close, and the kinds of failure not worth hardening against. Then have the human size the pools to match, since only they can: `sc pool list` shows `build` and `drive-<app>` once a job has named each (`sc run --pool <name> -- true` creates one, with 4 slots), and `+` and `-` on the Queue screen of `sc tui` resize the selected pool. **Done when** every CI job passes on the current branch, every Limits line has a value, and both pools have the slots the charter gives them.

7. **Prediction test.** Write how you would decide the hardest calls you can foresee, one line each with the ground you'd cite, and let the human correct them. Fold every correction into the principles or design. **Done when** a pass comes back with no correction.

8. **Cold read.** Write the charter to `docs/wayfinder/<slug>.md`, then spawn one fresh agent on the auditor tier (load `/model-policy` to resolve it) given only the charter's path and asked for every question it would have to guess on to build this. Each question is answered in the charter or listed under **Delegated** with the human's OK. An answer that rewords a behavior rewords its feature file too: after step 9 the effort branch changes only through the gate. **Done when** no question is open.

9. **Create the effort** on `sc`, the local forge SKILL.md describes. Check the charter's shape first: `effort.py charter-check --file docs/wayfinder/<slug>.md` ([effort.py](effort.py)) prints what would stop the effort. Then, from the branch the effort should start from, with what it builds on committed:
   - Commit everything Shape made on a throwaway branch `shape/<slug>`: the charter, `sc.toml`, the verify skill and its feature files. The effort's first commit can only be made this way, since nothing but the gate moves the effort branch once it exists.
   - Run `sc init` from that checkout, so `sc` records the `effort/*` pattern, then `sc branch create effort/<slug> --from shape/<slug>`.
   - Switch back to the base branch and delete `shape/<slug>`. What it committed leaves this checkout with it, so nothing here can collide with the effort when it merges back.

   Don't run `sc init` again from a checkout whose `sc.toml` lacks the `effort/*` entry while the effort runs: it would stop protecting the branch. Run [preflight.sh](preflight.sh) `<slug>`, fix whatever it reports, and rerun it. Then create the plan (`sc issue create --label wayfinder:plan`) in the body shape SKILL.md gives it, its **Base** line naming the branch the effort started from, with every behavior in the map "not covered yet" and **Where it stands** reading "Not planned yet." **Done when** preflight passes and the plan exists.

10. **Hand off.** Load `/multiplexer` and hand off to a tab of this session: the repo root, the plan's title as the label, `/wayfinder <slug>` as the prompt, the decider tier's model for the session, and `200k` as where it compacts, since the lead runs for days and re-reads its whole context on every event. Tell the human the label, and that they talk to the lead there from now on. With no multiplexer, give them the command to start it and stop.
