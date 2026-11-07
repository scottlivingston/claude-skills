"""SessionStart hook: in the plugin's own repo, say when /rsi or /autopsy is due.

Prints a one-line systemMessage when the last /rsi run (the newest line of
.rsi/history.jsonl) is a week old or missing, or when open snags wait in
~/.claude/snags/. Anywhere else, and when nothing is due, prints nothing.
"""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

DUE_AFTER_DAYS = 7


def main():
    plugin_root = Path(os.environ.get("CLAUDE_PLUGIN_ROOT", Path(__file__).resolve().parent.parent))
    project = Path(os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd()))
    try:
        ours = json.loads((plugin_root / ".claude-plugin" / "plugin.json").read_text())["name"]
        here = json.loads((project / ".claude-plugin" / "plugin.json").read_text())["name"]
    except (OSError, ValueError, KeyError):
        return
    if ours != here:
        return

    notes = []
    history = project / ".rsi" / "history.jsonl"
    lines = [l for l in history.read_text().splitlines() if l.strip()] if history.is_file() else []
    if not lines:
        notes.append("/rsi has never graded this plugin's skills")
    else:
        last = datetime.fromisoformat(json.loads(lines[-1])["at"])
        days = (datetime.now(timezone.utc) - last).days
        if days >= DUE_AFTER_DAYS:
            notes.append(f"the last /rsi run was {days} days ago")

    snags = Path(os.environ.get("CLAUDE_CONFIG_DIR", Path.home() / ".claude")) / "snags"
    open_snags = sum(1 for f in snags.glob("*.md") if "\nStatus: open" in f.read_text(errors="replace")) if snags.is_dir() else 0
    if open_snags:
        notes.append(f"{open_snags} open snag{'s' if open_snags != 1 else ''} wait{'' if open_snags != 1 else 's'} for /autopsy")

    if notes:
        message = "Skill upkeep: " + "; ".join(notes) + "."
        json.dump({"systemMessage": message}, sys.stdout)


if __name__ == "__main__":
    main()
