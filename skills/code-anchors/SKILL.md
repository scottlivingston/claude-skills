---
name: code-anchors
description: The anchor format for citing code to the human — verified, clickable path:line references, never pasted snippets. Consult when the user asks to see the code behind a question or claim, or when a specific line genuinely must be cited.
---

# Code anchors

Shared convention for citing code to the human. HITL exchanges speak the project's domain language by default — capabilities and concepts, not file paths — so an anchor appears when the human *asks* to see the code, or when a claim genuinely needs its source cited. When code is cited, this is how: a clickable reference the human cmd-clicks and reads in their own editor, never pasted code.

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
2. **Verified claims only.** A statement of the form "the code currently does X" rests on code you have read this conversation, whether or not an anchor appears. If you can't cite it, you haven't verified it — go read the code or drop the claim.
3. **Ration them.** One to three anchors per ask — the load-bearing ones only. More than that is a dump, and anchors woven through prose make it unreadable; the anchor list sits after the prose, not inside it.
4. **Anchor the decision point, not the file.** Point at the specific line where the behavior forks or the value is set, not `:1` of a file.

## When an anchor isn't the right answer

An anchor assumes the human wants to read the source. When what they're missing is a working model of the area — the question references a subsystem they've never dealt with — the fix is `/domain-expansion`: a plain-language briefing on what the system does today, in the project's own vocabulary, with the code itself still one ask away.
