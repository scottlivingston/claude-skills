"""Render a Claude Code session transcript (.jsonl) as readable text.

Usage: python3 -I render.py <transcript.jsonl> [--from N] [--to N] [--full]

Each line starts with the transcript's record index, so a finding can cite
`<transcript>:<index>`. Marks the records friction hunts care about: skills
loaded, output style, interrupts, rejected or failed tool calls.
"""
import json
import sys

args = sys.argv[1:]
path = args[0]
lo = int(args[args.index("--from") + 1]) if "--from" in args else 0
hi = int(args[args.index("--to") + 1]) if "--to" in args else 10**9
full = "--full" in args
cap = (lambda s, n: s) if full else (lambda s, n: s if len(s) <= n else s[:n] + " …")

style = None
for i, line in enumerate(open(path)):
    if not lo <= i <= hi:
        continue
    d = json.loads(line)
    t = d.get("type")
    ts = d.get("timestamp", "")[11:19]
    if t == "attachment":
        a = d.get("attachment", {})
        if a.get("type") == "output_style" and a.get("style") != style:
            style = a.get("style")
            print(f"[{i}] -- output style: {style}")
        continue
    if t not in ("user", "assistant"):
        continue
    who = "HUMAN" if t == "user" else "AGENT"
    c = d.get("message", {}).get("content")
    if isinstance(c, str):
        c = [{"type": "text", "text": c}]
    for b in c or []:
        k = b.get("type")
        if k == "text":
            text = b["text"]
            if text.startswith("Base directory for this skill:"):
                print(f"[{i}] -- skill loaded: {text.splitlines()[0].split(': ', 1)[1]}")
            elif "[Request interrupted" in text:
                print(f"[{i} {ts}] !! HUMAN INTERRUPTED")
            elif d.get("isMeta"):
                continue
            else:
                print(f"\n[{i} {ts}] {who}: {cap(text, 6000)}")
        elif k == "tool_use":
            inp = b.get("input", {})
            if b["name"] == "Skill":
                print(f"[{i}] -- Skill tool: {inp.get('skill')} {inp.get('args', '')}")
            else:
                print(f"[{i}] tool {b['name']}: {cap(json.dumps(inp), 300)}")
        elif k == "tool_result":
            r = b.get("content")
            if not isinstance(r, str):
                r = " ".join(x.get("text", "") for x in r or [] if isinstance(x, dict))
            if "doesn't want to proceed" in r or "user rejected" in r.lower():
                print(f"[{i}] !! HUMAN REJECTED TOOL CALL: {cap(r, 400)}")
            elif b.get("is_error"):
                print(f"[{i}] !! tool error: {cap(r, 300)}")
            else:
                print(f"[{i}] result: {cap(r, 200)}")
