---
description: A wayfinder builder building a piece that replaces one mechanism with another writes comments and docs that state the current behaviour — no echo of the ticket's "replace the shared key" framing, no ticket IDs — and cleans up the narrated comment already in a file it touches. The prompt follows wayfinder's build-stage brief, including its /implement rule line; keep that line in step with COMMENT_RULE in skills/wayfinder/build.template.js.
tags: [implement, wayfinder, smoke]
expected_outcome: auth.ts exports mintToken and verifyToken signed with a server key; client.ts fetches its token with fetchToken; auth.ts, client.ts and the README describe tokens as they are, with no mention of a shared key, no "no longer"/"previously"/"the old", and no ticket numbers — including the pre-existing "no longer retries forever … #41" comment in client.ts.
max_turns: 30
allowed_tools: [Read, Glob, Grep, Skill]
---

You build one piece of a wayfinder effort, in its own worktree. Never touch any other piece.

Your piece (#57 — Server-signed connect tokens):

Replace the shared connect key with per-viewer tokens the server signs. Today every client holds the same key (RAID_SHARED_KEY), so anyone with the web bundle can connect.

- `src/auth.ts`: `mintToken(viewerId)` returns `<viewerId>.<signature>`, an HMAC-SHA256 of the viewer id under a server key read from RAID_SERVER_KEY; `verifyToken(token)` returns the viewer id, or null for a forged or malformed token. `admit` and the shared key go away.
- `src/client.ts`: `connect(url, viewerId, open)` fetches its token with `fetchToken` from `src/api.ts` and presents it instead of the key.
- README: update the Connecting section.

Done when: no client holds a shared secret, and a forged token is refused.

The build plan:

Rewrite auth.ts around mintToken/verifyToken with node:crypto's createHmac and timingSafeEqual; thread viewerId through connect and swap SHARED_KEY for the fetched token, keeping the retry loop; rewrite the README's Connecting section for RAID_SERVER_KEY and tokens.

Tests follow the repo's TESTING.md; there is no test-first rule. Typecheck regularly, run single test files regularly, and commit in your worktree as you go.
Per /implement: Comments and docs state what the code does now, for a reader who never saw the old version: never "no longer", "used to", "the old X", the replaced mechanism's name, or a ticket or decision ID. In the files you touch, rewrite any comment or doc that narrates a past change or has gone false. What changed belongs in the commit message.
