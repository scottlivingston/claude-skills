#!/usr/bin/env python3
"""What a wayfinder effort needs that `sc`, its forge, leaves to the workflow.

`sc` holds the tracker, the changes, the statuses, the pools, the effort
branch, and the gate that runs CI and lands changes; every agent reaches those
through `sc` itself. This file holds the two things left over: filling the
build and review templates, and checking a charter's shape.

Run `effort.py --help` and `effort.py <command> --help` for the commands.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
MARKER = {"answers": "<!-- wayfinder review-answers ", "decision": "<!-- decision-record -->"}


def die(msg, code=1):
    print(f"effort: {msg}", file=sys.stderr)
    sys.exit(code)


def git(*args, cwd=None, check=True):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        die(f"git {' '.join(args)}: {r.stderr.strip() or r.stdout.strip()}")
    return r


def repo_root():
    """The main checkout: the worktree that owns the common git directory."""
    r = git("worktree", "list", "--porcelain", check=False)
    if r.returncode != 0:
        die("not inside a git repository")
    return Path(r.stdout.split("\n", 1)[0].removeprefix("worktree ").strip())


def sc(*args, cwd=None, check=True):
    """Runs sc and returns its stdout; a read command passes --json and gets the parsed value."""
    if not shutil.which("sc"):
        die("sc is not on PATH — build Sous Chef and put its binary there")
    r = subprocess.run(["sc", *args], cwd=cwd or repo_root(), capture_output=True, text=True)
    if check and r.returncode != 0:
        die(f"sc {' '.join(args)}: {r.stderr.strip() or r.stdout.strip()}")
    if "--json" in args and r.returncode == 0:
        return json.loads(r.stdout)
    return r.stdout.strip()


def head_of(ref):
    r = git("rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}", check=False)
    return r.stdout.strip() or None


# ── The effort ───────────────────────────────────────────────────────────────


class Effort:
    def __init__(self, slug):
        self.slug = slug
        self.branch = f"effort/{slug}"
        self.charter_path = f"docs/wayfinder/{slug}.md"
        self.root = repo_root()

    @staticmethod
    def resolve(slug):
        slug = slug or os.environ.get("WAYFINDER_EFFORT")
        if not slug:
            die("name the effort with --effort <slug>")
        e = Effort(slug)
        if not head_of(f"refs/heads/{e.branch}"):
            die(f"no branch {e.branch} here — Shape creates it, per SHAPE.md")
        return e

    def charter(self):
        r = git("show", f"{self.branch}:{self.charter_path}", check=False)
        if r.returncode != 0:
            die(f"no charter at {self.charter_path} on {self.branch}")
        return r.stdout

    def plan(self):
        """The effort's plan issue number: the wayfinder:plan issue whose body opens by naming this effort branch."""
        line = f"Effort branch: {self.branch}"
        for i in sc("issue", "list", "--label", "wayfinder:plan", "--search", line, "--json"):
            if self.issue(i["number"])["body"].split("\n", 1)[0].strip() == line:
                return i["number"]
        return None

    def issue(self, n):
        return sc("issue", "view", str(n), "--json")

    def change(self, n):
        c = sc("change", "view", str(n), "--json")
        if c["target"] != self.branch:
            die(f"change {n} targets {c['target']}, not {self.branch}")
        return c


def emit(data):
    print(json.dumps(data, indent=2))


# ── the charter's shape ───────────────────────────────────────────────────────


CHARTER_SECTIONS = ("Destination", "Acceptance behaviors", "Principles", "Design", "Out of scope", "Limits", "Delegated")
CHARTER_LIMITS = ("Pieces at once", "Build slots", "Drive slots")


def charter_problems(text):
    """What in a charter's shape would stop an effort, per CHARTER.md; empty when it is sound."""
    out = [f"charter has no '## {s}' section" for s in CHARTER_SECTIONS if not re.search(rf"^## {re.escape(s)}", text, re.M)]
    behaviors = re.findall(r"^- \*\*(B\d+):.*$", text, re.M)
    if not behaviors:
        out.append("charter lists no '- **B<n>: …**' behaviors")
    bad = [m.group(1) for m in re.finditer(r"^- \*\*(B\d+):.*$", text, re.M) if "→" not in m.group(0)]
    if bad:
        out.append("behaviors with no '→ <observable end state>': " + " ".join(bad))
    out += [f"charter Limits has no number for '{l}'" for l in CHARTER_LIMITS if not re.search(rf"^- \*\*{re.escape(l)}:\*\* *\d+", text, re.M)]
    return out


def cmd_charter_check(a):
    problems = charter_problems(Path(a.file).read_text() if a.file else Effort.resolve(a.effort).charter())
    for line in problems:
        print(line)
    sys.exit(1 if problems else 0)


# ── filling a workflow template ──────────────────────────────────────────────


def model_tiers(root):
    """Each tier's model per /model-policy's resolver; inherit is None."""
    r = subprocess.run(["bash", str(HERE.parent / "model-policy" / "resolve-model-policy.sh"), str(root)],
                       capture_output=True, text=True)
    if r.returncode != 0:
        die(f"resolve-model-policy.sh: {r.stderr.strip()}")
    tiers = dict(line.split("\t")[0].split("=", 1) for line in r.stdout.splitlines() if "=" in line)
    return {k: (None if v == "inherit" else v) for k, v in tiers.items()}


def files_named(ref, name):
    out = git("ls-tree", "-r", "--name-only", ref).stdout.splitlines()
    return sorted((f for f in out if f == name or f.endswith("/" + name)), key=lambda f: (f.count("/"), f))


def scope_of(path):
    return "repo root" if "/" not in path else path.rsplit("/", 1)[0]


def test_notes(ref):
    """Every TESTING.md on the ref, verbatim, each under the scope it binds."""
    return "\n\n".join(f"# {f} (binds: {scope_of(f)})\n\n" + git("show", f"{ref}:{f}").stdout.strip()
                       for f in files_named(ref, "TESTING.md"))


def standards_sources(ref, base):
    """The CONVENTIONS.md files on the ancestor paths of the files the ref changes."""
    changed = git("diff", "--name-only", f"{base}...{ref}").stdout.splitlines()
    dirs = {""} | {"/".join(f.split("/")[:n]) for f in changed for n in range(1, f.count("/") + 1)}
    return [{"path": f, "scope": scope_of(f)} for f in files_named(ref, "CONVENTIONS.md")
            if (f.rsplit("/", 1)[0] if "/" in f else "") in dirs]


def verify_skill(e, ref, override):
    """The verify skill's repo path: the charter's Verified through line, else the one on the ref."""
    if override is not None:
        return override.rstrip("/")
    m = re.search(r"Verified through\s+`?([^`\s]*verify-[A-Za-z0-9._-]+)", e.charter())
    if m:
        return m.group(1).rstrip("/")
    out = git("ls-tree", "-d", "--name-only", f"{ref}:.claude/skills", check=False).stdout.split()
    found = [d for d in out if d.startswith("verify-")]
    return f".claude/skills/{found[0]}" if len(found) == 1 else ""


def builds_on(e, piece):
    section = piece["body"].split("## Builds on", 1)[1] if "## Builds on" in piece["body"] else ""
    return [e.issue(n) for n in re.findall(r"^\s*-\s*#(\d+)", section.split("\n## ", 1)[0], re.M)]


def fill_slots(kind, values):
    src = (HERE / f"{kind}.template.js").read_text()
    slots = re.findall(r"^const (\w+) = FILL\b", src, re.M)
    if missing := [s for s in slots if s not in values]:
        die(f"{kind}.template.js has slots fill does not know: {', '.join(missing)}")
    for name in slots:
        src = src.replace(f"const {name} = FILL", f"const {name} = {json.dumps(values[name])}", 1)
    return src


def cmd_fill(a):
    e = Effort.resolve(a.effort)
    plan_n = e.plan()
    plan = e.issue(plan_n) if plan_n else die("the effort has no plan yet")
    tiers = model_tiers(e.root)
    common = {
        "CHARTER_PATH": e.charter_path, "SLUG": e.slug, "EFFORT_BRANCH": e.branch, "REPO_ROOT": str(e.root),
        "EXECUTOR_MODEL": tiers["executor"], "DECIDER_MODEL": tiers["decider"],
    }
    if a.kind == "build":
        piece = e.issue(a.number)
        branch = f"piece/{e.slug}/{piece['number']}"
        ref = branch if head_of(f"refs/heads/{branch}") else e.branch
        skill = verify_skill(e, ref, a.verify_skill)
        app = a.app or skill.rsplit("verify-", 1)[-1]
        if not app:
            die("no verify skill is named by the charter or on the branch: pass --app <app>, the app this piece's verify skill is for")
        fix = Path(a.fix_input).read_text() if a.fix_input else ""
        values = {**common, "PLAN_REF": f"#{plan['number']}",
                  "PIECE": {k: piece[k] for k in ("number", "title", "body")},
                  "DECISIONS": [{"ref": f"#{d['number']}", "title": d["title"], "body": d["body"]} for d in builds_on(e, piece)],
                  "PIECE_BRANCH": branch, "WORKTREE": str(e.root / ".claude" / "worktrees" / e.slug / f"piece-{piece['number']}"),
                  "MODE": "fix" if fix else "build", "FIX_INPUT": fix,
                  "VERIFY_SKILL": skill, "APP": app, "TEST_NOTES": test_notes(ref)}
        ident, manifest = piece["number"], {"piece": piece["number"], "mode": values["MODE"]}
    else:
        c = e.change(a.number)
        if not c["head"]:
            die(f"change {a.number} has no head")
        if c["issue"] is None:
            die(f"change {a.number} is linked to no piece")
        piece = e.issue(c["issue"])
        # A round a dead run posted twice is read from its newest comment.
        rounds = sorted({int(n): x for x in c["comments"]
                         for n in re.findall(r"^\s*<!-- wayfinder review (\d+) -->", x["body"])}.items())
        rnd = a.round or max((n for n, _ in rounds), default=0) + 1
        first = min((x["at"] for _, x in rounds), default=None)
        answers = [x["body"] for x in c["comments"] if x["body"].lstrip().startswith(MARKER["answers"])]
        if first:
            answers += [x["body"] for x in piece["comments"] if x["at"] >= first and MARKER["decision"] in x["body"]]
        skill = verify_skill(e, c["head"], a.verify_skill)
        values = {**common, "PLAN": {"number": plan["number"], "title": plan["title"]},
                  "CHANGE": {"number": c["number"], "title": c["title"]}, "HEAD_SHA": c["head"],
                  "PIECE": {k: piece[k] for k in ("number", "title", "body")},
                  "DECISIONS": [{k: d[k] for k in ("number", "title", "body")} for d in builds_on(e, piece)],
                  "ROUND": rnd, "PRIOR_ROUNDS": [x["body"] for n, x in rounds if n < rnd], "PRIOR_ANSWERS": answers,
                  "STANDARDS_SOURCES": standards_sources(c["head"], e.branch),
                  "VERIFY_SKILL": skill, "APP": a.app or skill.rsplit("verify-", 1)[-1],
                  "WORKTREE": str(e.root / ".claude" / "worktrees" / e.slug / f"review-{c['number']}"),
                  "TEST_NOTES": test_notes(c["head"])}
        ident, manifest = c["number"], {"change": c["number"], "piece": piece["number"], "round": rnd, "head": c["head"]}
    out = Path(a.out) if a.out else Path(os.environ.get("TMPDIR", "/tmp")) / "wayfinder" / e.slug / f"{a.kind}-{ident}.js"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(fill_slots(a.kind, values))
    emit({"script": str(out), "kind": a.kind, **manifest, "decisions": [d["number"] for d in builds_on(e, piece)],
          "verify_skill": values["VERIFY_SKILL"], "models": {"executor": tiers["executor"], "decider": tiers["decider"]}})


# ── CLI ──────────────────────────────────────────────────────────────────────


def main():
    p = argparse.ArgumentParser(prog="effort.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--effort", "-e", help="the effort's slug (default: $WAYFINDER_EFFORT)")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("charter-check", help="print what in the charter's shape would stop the effort; exits 1 when anything does")
    s.add_argument("--file", help="a charter file to check (default: the charter on the effort branch)")
    s.set_defaults(fn=cmd_charter_check)

    s = sub.add_parser("fill", help="fill the build or review workflow template from sc and the effort branch, and print the script's path")
    s.add_argument("kind", choices=["build", "review"]); s.add_argument("number", type=int, help="the piece (build) or the change (review)")
    s.add_argument("--fix-input", help="build: a file holding the review round's findings and answers, or the conflict; makes it fix mode")
    s.add_argument("--round", type=int, help="review: this round's number, when a dead run left a comment for it")
    s.add_argument("--verify-skill", help="the verify skill's repo path, when the charter's line does not settle it; '' for the piece that builds it")
    s.add_argument("--app", help="the <app> of verify-<app>, when no verify skill exists yet")
    s.add_argument("--out", help="where to write the script (default: $TMPDIR/wayfinder/<slug>/<kind>-<number>.js)")
    s.set_defaults(fn=cmd_fill)

    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
