# Code anchors

Shared convention for grounding HITL moments in the codebase. Whenever a skill puts a question, a proposal, or a claim about existing code to the human, the human must be able to *see that code* without breaking flow — they cmd-click a reference and read it in their own editor. Anchors are how: clickable references, never pasted code.

## The anchor format

An anchor is a backticked, repo-relative path with a line number:

```
`src/billing/invoice.ts:142` — where the retry backoff is computed (`computeBackoff`)
```

- **Relative path from the working directory**, `:line` suffix, wrapped in backticks. This is the form editors (Zed, VS Code, JetBrains) make cmd-clickable in a terminal. No `file://` URLs, no markdown links around paths. (While a TUI like Claude Code holds the terminal's mouse mode, plain cmd-click is forwarded to the app — in Zed, **shift+cmd+click** bypasses that and follows the anchor.)
- **Verify before you cite.** Read the file and confirm the line number in this conversation — never guess or recall one. A wrong anchor is worse than none: the human lands somewhere irrelevant and stops trusting the links.
- **Name the symbol beside the anchor** (`computeBackoff` above) so the reference survives small drift and the human knows what they're looking for when they land.
- **One line of *why look here* per anchor.** What they'll see and why it bears on the question — not what the code does line-by-line; the code says that itself.

## Rules

1. **Never paste the code an anchor points to.** The human reads it in their editor; pasted snippets go stale, bloat the exchange, and train them to stop clicking. (Quoting a single identifier or value inline to make a sentence readable is fine.)
2. **Anchor claims, not vibes.** Any statement of the form "the code currently does X" carries an anchor. If you can't anchor it, you haven't verified it — go read the code or drop the claim.
3. **Ration them.** A question carries 1–3 anchors — the load-bearing ones only. A guided tour (see below) carries up to ~8, ordered as a reading path. More than that is a dump, not an anchor set.
4. **Anchor the decision point, not the file.** Point at the specific line where the behavior forks or the value is set, not `:1` of a file.

## When anchors aren't enough

Anchors assume the human roughly knows the terrain and just needs the exact spot. When they don't — the question references a subsystem they've never read — the fix is a **guided tour**, not more anchors on the question: the `/domain-expansion` skill takes the pending question and walks the human through the relevant code as an ordered reading path. Skills that ask anchored questions should remind the human this exists rather than pre-emptively touring everything.
