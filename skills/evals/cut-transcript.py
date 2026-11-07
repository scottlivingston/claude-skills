"""Turn a real session into a replay case: everything before one user turn.

Usage: python3 -I cut-transcript.py <transcript.jsonl> <record> <case-dir>

<record> is the index of the user turn to replay, counted from 0 as autopsy's
render.py numbers them. Writes <case-dir>/session.jsonl holding every record
before it, and prints that turn's text: the case's prompt.md body, verbatim.
bake-history.py turns session.jsonl into the history.jsonl the case resumes.
"""

import json
import os
import sys


def turn_text(record):
    """The human's words in a user record, or None for anything else."""
    if record.get("type") != "user" or record.get("isMeta"):
        return None
    content = record.get("message", {}).get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        if any(part.get("type") == "tool_result" for part in content):
            return None
        texts = [part["text"] for part in content if part.get("type") == "text"]
        return "\n".join(texts) if texts else None
    return None


def main(transcript, index, case_dir):
    with open(transcript) as f:
        lines = f.read().splitlines()
    if not 0 <= index < len(lines):
        sys.exit(f"record {index} is outside the transcript (0..{len(lines) - 1})")
    text = turn_text(json.loads(lines[index]))
    if text is None:
        sys.exit(
            f"record {index} is not a turn the human typed (a tool result, a skill "
            "body, or a system record); pick the user record that opens the turn"
        )
    os.makedirs(case_dir, exist_ok=True)
    with open(os.path.join(case_dir, "session.jsonl"), "w") as f:
        f.write("\n".join(lines[:index]) + "\n")
    print(text)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(sys.argv[1], int(sys.argv[2]), sys.argv[3])
