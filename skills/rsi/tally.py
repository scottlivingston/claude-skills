"""Turn a scoring wave's reports into grades, and track them across /rsi runs.

Usage: python3 -I tally.py --inventory <inventory.json> --reports <wave result.json>
                           --history <repo>/.rsi/history.jsonl [--write]

Labels become scores through each rubric's own table in scorers/. Prints one
JSON object: this run's entry (the line --write appends to the history, unless a label is unknown), the
change since the previous entry, and the failed sessions with their incidents.

A session fails when any applicable rubric scores below 0.5;
`insufficient_evidence` is not applicable. The overall grade weights the rubric
means and skill coverage as skill-doctor does.
"""
import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

RUBRICS = ("efficiency", "code-quality", "procedure-compliance", "verbosity")
WEIGHTS = {"efficiency": 0.25, "code-quality": 0.25, "procedure-compliance": 0.2, "verbosity": 0.15, "coverage": 0.15}
NOT_APPLICABLE = "insufficient_evidence"


def label_scores(rubric: str):
    text = (Path(__file__).parent / "scorers" / f"{rubric}.md").read_text()
    pairs = re.findall(r'- value: "([^"]+)"\s+description: ".*?"\s+score: ([\d.]+)', text, re.S)
    return {label: float(score) for label, score in pairs}


def mean(xs):
    return round(sum(xs) / len(xs), 3) if xs else None


def grade(per_rubric, coverage):
    if any(per_rubric[r] is None for r in RUBRICS if r != "code-quality"):
        return None
    values = dict(per_rubric, coverage=coverage)
    if values["code-quality"] is None:
        values["code-quality"] = 0.5
    return round(sum(WEIGHTS[k] * values[k] for k in WEIGHTS), 3)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--inventory", required=True)
    p.add_argument("--reports", required=True)
    p.add_argument("--history", required=True)
    p.add_argument("--write", action="store_true")
    a = p.parse_args()

    inventory = json.loads(Path(a.inventory).read_text())
    reports = json.loads(Path(a.reports).read_text())["scored"]
    tables = {r: label_scores(r) for r in RUBRICS}
    sessions = {s["transcript"]: s for s in inventory["sessions"]}

    rows, failed, unknown = [], [], []
    for rep in reports:
        scores = {}
        for r in RUBRICS:
            label = rep["scores"][r]["label"]
            if label == NOT_APPLICABLE and r == "code-quality":
                continue
            if label not in tables[r]:
                unknown.append(f"{Path(rep['transcript']).name}: {r}={label}")
                continue
            scores[r] = tables[r][label]
        session = sessions.get(rep["transcript"], {})
        rows.append({"skills": session.get("skills", []), "scores": scores})
        if any(v < 0.5 for v in scores.values()):
            failed.append({
                "transcript": rep["transcript"],
                "source": session.get("source"),
                "harness": session.get("harness"),
                "kind": session.get("kind"),
                "ran": session.get("ran"),
                "inCharge": rep["inCharge"],
                "failing": {r: rep["scores"][r] for r, v in scores.items() if v < 0.5},
                "incidents": rep["incidents"],
            })

    per_rubric = {r: mean([row["scores"][r] for row in rows if r in row["scores"]]) for r in RUBRICS}
    skills = {}
    for row in rows:
        for skill in row["skills"]:
            skills.setdefault(skill, []).append(row)
    per_skill = {
        skill: {"sessions": len(rs), **{r: mean([x["scores"][r] for x in rs if r in x["scores"]]) for r in RUBRICS}}
        for skill, rs in sorted(skills.items())
    }

    history = Path(a.history)
    plugin_json = history.resolve().parent.parent / ".claude-plugin" / "plugin.json"
    entry = {
        "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "repo_version": json.loads(plugin_json.read_text())["version"] if plugin_json.is_file() else None,
        "since": inventory["window"]["since"],
        "until": inventory["window"]["until"],
        "sessions_swept": len(inventory["sessions"]),
        "sessions_scored": len(rows),
        "sessions_failed": len(failed),
        "harnesses": sorted(inventory.get("sources", {})),
        "coverage": inventory["coverage"],
        "unused": inventory.get("unused", []),
        "rubrics": per_rubric,
        "overall": grade(per_rubric, inventory["coverage"]),
        "skills": per_skill,
    }

    previous = None
    if history.is_file():
        lines = [l for l in history.read_text().splitlines() if l.strip()]
        previous = json.loads(lines[-1]) if lines else None

    def delta(now, before):
        return None if now is None or before is None else round(now - before, 3)

    change = None
    if previous:
        change = {
            "since_run": previous["at"],
            "overall": delta(entry["overall"], previous.get("overall")),
            "rubrics": {r: delta(per_rubric[r], previous["rubrics"].get(r)) for r in RUBRICS},
            "skills": {
                s: {r: delta(v[r], previous["skills"][s].get(r)) for r in RUBRICS}
                for s, v in per_skill.items() if s in previous.get("skills", {})
            },
        }

    written = bool(a.write and not unknown)
    if written:
        history.parent.mkdir(parents=True, exist_ok=True)
        with history.open("a") as f:
            f.write(json.dumps(entry, separators=(",", ":")) + "\n")

    json.dump({"written": written, "entry": entry, "change": change, "failed": failed, "unknown_labels": unknown},
              sys.stdout, indent=1)


if __name__ == "__main__":
    main()
