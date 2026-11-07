# raid

A browser game where stream viewers join the boss fight.

## Running

`npm run server` starts the game server on port 7000; `npm run web` serves the client.

## Connecting

Clients connect with the key in `RAID_SHARED_KEY` (default `dev-key`). The server admits any
client presenting it, and refuses the rest. Set the same value on the server and in the web build.
