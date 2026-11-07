# Vendored: skill-doctor's session collector

`collect_sessions.py`, `warp_decoder.py`, `test_collect_sessions.py` and `LICENSE` are copied unmodified from [warpdotdev/common-skills](https://github.com/warpdotdev/common-skills/tree/main/.agents/skills/skill-doctor/scripts) at commit `7c4eb852de8d7c3e68c81802e1c59db9a611f914`, under its MIT license.

Keep them unmodified. Everything /rsi changes about collection lives in [../collect.py](../collect.py), which imports this collector and post-processes its inventory, so an update is a plain recopy of these four files at a newer commit, then `python3 -I -m unittest test_collect_sessions` from this directory and a `collect.py` run to confirm its inventory still has the fields `collect.py` reads.
