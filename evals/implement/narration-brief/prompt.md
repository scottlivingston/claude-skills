---
description: A ship implementer building a ticket that replaces one mechanism with another writes comments and docs that state the current behaviour — no echo of the ticket's "replace the shared key" framing, no ticket IDs — and cleans up the narrated comment already in a file it touches. The prompt is ship's implementer brief, including its /implement rule line; keep that line in step with skills/ship/workflow.template.js.
tags: [implement, ship, smoke]
expected_outcome: auth.ts exports mintToken and verifyToken signed with a server key; client.ts fetches its token with fetchToken; auth.ts, client.ts and the README describe tokens as they are, with no mention of a shared key, no "no longer"/"previously"/"the old", and no ticket numbers — including the pre-existing "no longer retries forever … #41" comment in client.ts.
max_turns: 30
allowed_tools: [Read, Glob, Grep, Skill]
---

You are the implementer for one ticket of ship wave 2, working in an ISOLATED WORKTREE. Never touch any other ticket.

Your ticket (#57 — Server-signed connect tokens):

Replace the shared connect key with per-viewer tokens the server signs. Today every client holds the same key (RAID_SHARED_KEY), so anyone with the web bundle can connect.

- `src/auth.ts`: `mintToken(viewerId)` returns `<viewerId>.<signature>`, an HMAC-SHA256 of the viewer id under a server key read from RAID_SERVER_KEY; `verifyToken(token)` returns the viewer id, or null for a forged or malformed token. `admit` and the shared key go away.
- `src/client.ts`: `connect(url, viewerId, open)` fetches its token with `fetchToken` from `src/api.ts` and presents it instead of the key.
- README: update the Connecting section.

Done when: no client holds a shared secret, and a forged token is refused.

Your wave-stamped plan:

Rewrite auth.ts around mintToken/verifyToken with node:crypto's createHmac and timingSafeEqual; thread viewerId through connect and swap SHARED_KEY for the fetched token, keeping the retry loop; rewrite the README's Connecting section for RAID_SERVER_KEY and tokens.

Discipline (/implement + /tdd): red–green at the spec's seams — red test first, then the code that greens it; typecheck regularly; run single test files regularly; commit in your worktree as you go.
Per /implement: Comments and docs state what the code does now, for a reader who never saw the old version: never "no longer", "used to", "the old X", the replaced mechanism's name, or a ticket or decision ID. In the files you touch, rewrite any comment or doc that narrates a past change or has gone false. What changed belongs in the commit message.
