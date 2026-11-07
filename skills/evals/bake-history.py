"""Write each replay case's history.jsonl with a given plugin's skill text.

Usage: python3 -I bake-history.py <plugin-root> <case-dir-or-eval-dir>...

A transcript stores every skill it loaded as a hidden user record holding that
skill's body as it was then, and a resumed session obeys that stored copy, not
the plugin's current file. So for each case directory holding a session.jsonl
(searched recursively under each argument), this copies the session to
history.jsonl with every stored body of a skill <plugin-root> has replaced by
<plugin-root>/skills/<name>/SKILL.md as it is now. Skills from other plugins
stay as recorded. Prints one line per case: the skills rebaked and those left.
"""

import json
import os
import re
import sys

PREFIX = "Base directory for this skill: "


def skill_body(path):
    with open(path) as f:
        text = f.read()
    # strip YAML frontmatter, as Claude Code does when it loads a skill
    match = re.match(r"^---\n.*?\n---\n", text, re.S)
    return (text[match.end():] if match else text).lstrip("\n")


def rebake(text, plugin_root, session_id):
    """Return (new text, skill name, rebaked?) for one stored skill body."""
    head, _, rest = text.partition("\n\n")
    name = os.path.basename(head[len(PREFIX):].rstrip("/"))
    skill_dir = os.path.join(plugin_root, "skills", name)
    skill_md = os.path.join(skill_dir, "SKILL.md")
    if not os.path.isfile(skill_md):
        return text, name, False
    # keep the invocation's arguments, which follow the body
    args = ""
    marker = rest.rfind("\n\n\nARGUMENTS: ")
    if marker != -1:
        args = rest[marker:]
    body = skill_body(skill_md)
    body = body.replace("${CLAUDE_SKILL_DIR}", skill_dir)
    body = body.replace("${CLAUDE_SESSION_ID}", session_id or "")
    return f"{PREFIX}{skill_dir}\n\n{body.rstrip()}{args or chr(10)}", name, True


def bake_case(case_dir, plugin_root):
    rebaked, kept, out = set(), set(), []
    with open(os.path.join(case_dir, "session.jsonl")) as f:
        for line in f:
            if not line.strip():
                continue
            record = json.loads(line)
            content = record.get("message", {}).get("content")
            if record.get("type") == "user" and record.get("isMeta") and isinstance(content, list):
                for part in content:
                    if part.get("type") == "text" and part.get("text", "").startswith(PREFIX):
                        part["text"], name, done = rebake(
                            part["text"], plugin_root, record.get("sessionId")
                        )
                        (rebaked if done else kept).add(name)
            out.append(json.dumps(record))
    with open(os.path.join(case_dir, "history.jsonl"), "w") as f:
        f.write("\n".join(out) + "\n")
    return rebaked, kept


def main(plugin_root, roots):
    plugin_root = os.path.abspath(plugin_root)
    found = 0
    for root in roots:
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d != "results"]
            if "session.jsonl" not in filenames:
                continue
            found += 1
            rebaked, kept = bake_case(dirpath, plugin_root)
            print(
                f"{dirpath}: rebaked {', '.join(sorted(rebaked)) or 'nothing'}"
                + (f"; left as recorded: {', '.join(sorted(kept))}" if kept else "")
            )
    if not found:
        print("no replay cases (no session.jsonl) under " + ", ".join(roots))


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2:])
