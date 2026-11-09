---
type: llm
---

One feedback item is a vague freeze: the Overlay's videos stop playing and it stops getting updates, possibly the streamer's setup. Nothing in the code shows the cause outright (the live connection in overlay/live.js has no heartbeat, which is one plausible lead, but nothing confirms it). This is the first turn of a triage, so the reply may put only one question to the human; what "done" means for the freeze can wait for a later turn.

PASS if the reply sorts the freeze apart from the clear fixes as something not yet understood — to be reproduced or investigated — and does not declare its cause confirmed. Any of these counts as sorting it apart: labelling it a defect, a bug to reproduce or investigate, or a plausible-but-unconfirmed cause. The reply need not use the word "reproduce". Naming a lead such as the missing heartbeat as plausible or unconfirmed is fine.
FAIL if the reply declares a confirmed cause or plans a fix for the freeze as if the cause were known, lumps it in with the clear fixes, or skips the item.
