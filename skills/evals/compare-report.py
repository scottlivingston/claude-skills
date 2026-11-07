"""Print the score change between two `claude plugin eval --json` results.

Usage: compare-report.py <base.json> <candidate.json>

One row per case (mean score base -> candidate, runs per arm), then one row
per grader whose pass rate moved, then the cost of both arms. Cases present in
only one arm are listed with a dash on the other side.
"""

import json
import sys


def load(path):
    with open(path) as f:
        return json.load(f)


def cases(result):
    out = {}
    for case in result.get("cases", []):
        runs = case.get("arms", {}).get("with", [])
        graders = {}
        for run in runs:
            for g in run.get("graders", []):
                if g.get("scored") is False:
                    continue
                passed, total = graders.get(g["name"], (0, 0))
                graders[g["name"]] = (passed + bool(g.get("passed")), total + 1)
        errors = sum(1 for run in runs if run.get("error"))
        out[case["name"]] = {
            "score": case.get("aggregates", {}).get("score"),
            "runs": len(runs),
            "errors": errors,
            "graders": graders,
        }
    return out


def fmt(score):
    return "  -  " if score is None else f"{score:.2f}"


def main(base_path, cand_path):
    base, cand = load(base_path), load(cand_path)
    b, c = cases(base), cases(cand)
    names = sorted(set(b) | set(c))

    print(f"{'CASE':<40} {'BASE':>5} {'CAND':>5} {'DELTA':>6}  RUNS")
    for name in names:
        bs = b.get(name, {}).get("score")
        cs = c.get(name, {}).get("score")
        delta = "" if bs is None or cs is None else f"{cs - bs:+.2f}"
        runs = f"{b.get(name, {}).get('runs', 0)}/{c.get(name, {}).get('runs', 0)}"
        errs = b.get(name, {}).get("errors", 0) + c.get(name, {}).get("errors", 0)
        note = f"  {errs} run(s) errored" if errs else ""
        print(f"{name:<40} {fmt(bs):>5} {fmt(cs):>5} {delta:>6}  {runs}{note}")

    moved = []
    for name in names:
        bg = b.get(name, {}).get("graders", {})
        cg = c.get(name, {}).get("graders", {})
        for g in sorted(set(bg) | set(cg)):
            bp, bt = bg.get(g, (0, 0))
            cp, ct = cg.get(g, (0, 0))
            if bt and ct and bp / bt == cp / ct:
                continue
            moved.append(f"  {name} / {g}: {bp}/{bt} -> {cp}/{ct} passed")
    if moved:
        print("\nGraders that moved:")
        print("\n".join(moved))

    cost = (base.get("costUsd") or 0) + (cand.get("costUsd") or 0)
    print(f"\nCost: ${cost:.2f} for both sides.")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
