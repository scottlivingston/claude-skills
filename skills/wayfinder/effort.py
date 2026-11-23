#!/usr/bin/env python3
"""What a wayfinder effort needs that `sc`, its forge, leaves to the workflow.

`sc` holds the tracker, the changes, the statuses, the pools, and the gate that
runs CI and lands changes; every agent reaches those through `sc` itself. This
file holds only wayfinder's own vocabulary on top of it: setting an effort up
and retiring it, each piece's state, filling the build and review templates,
and the change-body format check.

Run `effort.py --help` and `effort.py <command> --help` for the commands.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tomllib
from pathlib import Path

HERE = Path(__file__).resolve().parent
REVIEW_STATUSES = ["wayfinder/pr-format", "wayfinder/spec", "wayfinder/standards"]
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


def rows(value, key):
    """A list command's rows, whether sc printed them bare or under their name."""
    return value if isinstance(value, list) else value[key]


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
    def known():
        out = git("config", "--local", "--get-regexp", r"^wayfinder\..*\.base$", check=False).stdout
        return sorted(line.split(" ", 1)[0][len("wayfinder."):-len(".base")] for line in out.splitlines())

    @staticmethod
    def resolve(slug):
        slug = slug or os.environ.get("WAYFINDER_EFFORT")
        found = Effort.known()
        if not slug:
            if len(found) != 1:
                die("name the effort with --effort <slug>" + (f" (one of: {', '.join(found)})" if found else " — none is set up here"))
            slug = found[0]
        if slug not in found:
            die(f"no effort '{slug}' here — run effort.py setup {slug} first")
        return Effort(slug)

    def base(self):
        return git("config", "--local", f"wayfinder.{self.slug}.base").stdout.strip()

    def head(self):
        return head_of(f"refs/heads/{self.branch}")

    def charter(self):
        r = git("show", f"{self.branch}:{self.charter_path}", check=False)
        if r.returncode != 0:
            die(f"no charter at {self.charter_path} on {self.branch}")
        return r.stdout

    def config(self, ref=None):
        """The sc.toml on a ref (default: the effort branch), parsed."""
        r = git("show", f"{ref or self.branch}:sc.toml", check=False)
        if r.returncode != 0:
            die(f"no sc.toml on {ref or self.branch}")
        return tomllib.loads(r.stdout)

    def ci_jobs(self, ref=None):
        return [{"name": n, "command": j["command"], "pool": j.get("pool", "default")}
                for n, j in self.config(ref).get("jobs", {}).items()]

    def required(self):
        return self.config().get("gates", {}).get(self.branch, {}).get("required", [])

    def plan(self):
        """The effort's plan issue number: the wayfinder:plan issue whose body names this effort branch."""
        for i in rows(sc("issue", "list", "--label", "wayfinder:plan", "--json"), "issues"):
            body = sc("issue", "view", str(i["number"]), "--json")["body"]
            if re.match(rf"\s*Effort branch:\s*{re.escape(self.branch)}\s*$", body.split("\n", 1)[0]):
                return i["number"]
        return None

    def issue(self, n):
        return sc("issue", "view", str(n), "--json")

    def changes(self):
        """Every change into the effort branch, oldest first."""
        return [c for c in rows(sc("change", "list", "--json"), "changes") if c["target"] == self.branch]

    def change(self, n):
        c = sc("change", "view", str(n), "--json")
        if c["target"] != self.branch:
            die(f"change {n} targets {c['target']}, not {self.branch}")
        return c


def statuses_of(change):
    return {s["name"]: s for s in change["statuses"]}


def emit(data):
    print(json.dumps(data, indent=2))


# ── setup and finish ─────────────────────────────────────────────────────────


def protect(text, branch):
    """sc.toml's text with the effort branch protected and gated on its CI jobs and the review statuses."""
    cfg = tomllib.loads(text)
    jobs = list(cfg.get("jobs", {}))
    if not jobs:
        die("sc.toml lists no [jobs.<name>] — the effort needs at least one CI job")
    if branch not in cfg.get("protected", []):
        if "protected" in cfg:
            text, n = re.subn(r"(?ms)^(protected\s*=\s*\[)(.*?)(\])",
                              lambda m: m.group(1) + m.group(2).rstrip().rstrip(",") + (", " if m.group(2).strip() else "") + json.dumps(branch) + m.group(3),
                              text, count=1)
            if not n:
                die("can't find sc.toml's protected list to add the effort branch to; add it by hand and rerun")
        else:
            text = f"protected = [{json.dumps(branch)}]\n" + text
    if branch not in cfg.get("gates", {}):
        required = [f"ci/{j}" for j in jobs] + REVIEW_STATUSES
        text = text.rstrip("\n") + f"\n\n[gates.{json.dumps(branch)}]\nrequired = {json.dumps(required)}\n"
    after = tomllib.loads(text)
    if branch not in after.get("protected", []) or branch not in after.get("gates", {}):
        die("could not add the effort branch to sc.toml; add it to protected and gates by hand and rerun")
    return text


def unprotect(text, branch):
    """sc.toml's text with the effort branch out of protected and its gate table gone."""
    quoted = re.escape(json.dumps(branch))
    text = re.sub(rf"(?ms)^(protected\s*=\s*\[)(.*?)(\])",
                  lambda m: m.group(1) + re.sub(rf"\s*{quoted}\s*,?", "", m.group(2)).rstrip().rstrip(",") + m.group(3), text, count=1)
    return re.sub(rf"(?ms)^\[gates\.{quoted}\]\n.*?(?=^\[|\Z)", "", text).rstrip("\n") + "\n"


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


def cmd_setup(a):
    e = Effort(a.slug)
    if a.slug in Effort.known() or e.head():
        die(f"effort '{a.slug}' is already set up, or {e.branch} already exists")
    src = Path(a.charter).resolve()
    if not src.exists():
        die(f"no charter file at {a.charter}")
    problems = charter_problems(src.read_text())
    if problems:
        die("the charter is not in CHARTER.md's shape, so nothing was created:\n  " + "\n  ".join(problems))
    base = a.base or git("rev-parse", "--abbrev-ref", "HEAD", cwd=e.root).stdout.strip()
    toml_src = Path(a.sc_toml).resolve() if a.sc_toml else None
    if toml_src and not toml_src.exists():
        die(f"no file at {a.sc_toml}")
    if not toml_src and git("cat-file", "-e", f"{base}:sc.toml", check=False).returncode != 0:
        die(f"{base} has no sc.toml: write the effort's CI jobs to a file and pass it as --sc-toml")

    checkout = e.root / ".claude" / "worktrees" / a.slug / "setup"
    checkout.parent.mkdir(parents=True, exist_ok=True)
    git("worktree", "add", "-b", e.branch, str(checkout), base)
    (checkout / e.charter_path).parent.mkdir(parents=True, exist_ok=True)
    (checkout / e.charter_path).write_text(src.read_text())
    toml = checkout / "sc.toml"
    toml.write_text(protect((toml_src or toml).read_text(), e.branch))
    for extra in a.add or []:
        rel = Path(extra).resolve().relative_to(e.root)
        if not (e.root / rel).exists():
            die(f"--add {extra}: no such file or directory")
        if (e.root / rel).is_dir():
            shutil.copytree(e.root / rel, checkout / rel, dirs_exist_ok=True)
        else:
            (checkout / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(e.root / rel, checkout / rel)
    git("add", "-A", cwd=checkout)
    git("commit", "-m", f"Charter for {a.slug}", cwd=checkout)
    # sc reads the protected branches from the sc.toml of the working tree it is run in.
    registered = sc("init", cwd=checkout)
    git("worktree", "remove", "--force", str(checkout))
    git("config", "--local", f"wayfinder.{a.slug}.base", base)
    emit({"effort": a.slug, "branch": e.branch, "base": base, "charter": e.charter_path,
          "ci": e.ci_jobs(), "required": e.required(), "sc": registered})


def cmd_show(a):
    e = Effort.resolve(a.effort)
    gates = [g for g in rows(sc("gate", "list", "--json"), "gates") if g["branch"] == e.branch]
    emit({"slug": e.slug, "branch": e.branch, "base": e.base(), "charter": e.charter_path, "repo": str(e.root),
          "plan": e.plan(), "head": e.head(), "ci": e.ci_jobs(), "required": e.required(),
          "gate": gates[0]["state"] if gates else None})


def cmd_check_base(a):
    """Runs every CI job once on the effort branch's head, through its pool."""
    e = Effort.resolve(a.effort)
    jobs = e.ci_jobs()
    if not jobs:
        die(f"sc.toml on {e.branch} lists no jobs")
    sha = e.head()
    checkout = e.root / ".claude" / "worktrees" / e.slug / "base"
    if checkout.exists():
        git("worktree", "remove", "--force", str(checkout))
    git("worktree", "add", "--detach", str(checkout), sha)
    failed = False
    try:
        for job in jobs:
            r = subprocess.run(["sc", "run", "--pool", job["pool"], "--", "sh", "-c", job["command"]],
                               cwd=checkout, env={**os.environ, "SC_CI": "1"})
            print(f"{'PASS' if r.returncode == 0 else 'FAIL'}  ci/{job['name']} on {sha[:10]} (exit {r.returncode})")
            failed |= r.returncode != 0
    finally:
        git("worktree", "remove", "--force", str(checkout), check=False)
    sys.exit(1 if failed else 0)


def cmd_finish(a):
    """Retires the effort once the human has taken its branch: closes what is still open into it and unprotects it."""
    e = Effort.resolve(a.effort)
    base, head = e.base(), e.head()
    merged = bool(head) and git("merge-base", "--is-ancestor", head, base, check=False).returncode == 0
    if not merged and not a.force:
        die(f"{e.branch} is not merged into {base} — merge it first, or pass --force when it was squashed or is being abandoned")
    closed = []
    for c in e.changes():
        if c["state"] == "open":
            sc("change", "close", str(c["number"]))
            closed.append(c["number"])
    toml = e.root / "sc.toml"
    edited = False
    if toml.exists():
        before = toml.read_text()
        after = unprotect(before, e.branch)
        if after != before:
            toml.write_text(after)
            edited = True
        # Re-reading the protected list from here is what takes the effort branch off it.
        sc("init", cwd=e.root)
    still = e.branch in sc("repo", "view", "--json").get("protected", [])
    git("config", "--local", "--unset", f"wayfinder.{e.slug}.base")
    emit({"finished": e.slug, "branch": e.branch, "merged": merged, "closed_changes": closed,
          "sc_toml_edited": edited, "still_protected": still,
          "next": (f"commit the sc.toml edit on {base}" if edited else None) or
                  (f"{e.branch} is still protected: run sc init from a checkout whose sc.toml does not list it" if still else None)})


# ── derived piece state ──────────────────────────────────────────────────────


def cmd_pieces(a):
    """Every piece of the plan with sc's derived state, `parked` laid over it, and its change."""
    e = Effort.resolve(a.effort)
    plan = e.plan()
    if plan is None:
        emit([])
        return
    changes = e.changes()
    out = []
    for i in rows(sc("issue", "list", "--parent", str(plan), "--json"), "issues"):
        mine = [c for c in changes if c["issue"] == i["number"]]
        open_c = next((c for c in reversed(mine) if c["state"] == "open"), None)
        st = statuses_of(e.change(open_c["number"])) if open_c else {}
        state = i["state"]
        if "wayfinder:parked" in i["labels"] and state not in ("done", "dropped"):
            state = "parked"
        out.append({"number": i["number"], "title": i["title"], "labels": i["labels"], "assignee": i["assignee"],
                    "state": state, "blockedBy": [b["number"] for b in i["blocked_by"]],
                    "change": open_c["number"] if open_c else (mine[-1]["number"] if mine else None),
                    "headSha": open_c["head"] if open_c else None,
                    "statuses": {k: v["state"] for k, v in st.items()},
                    "conflict": st.get("sc/merge", {}).get("state") == "fail"})
    emit(out)


# ── the change-body format check ─────────────────────────────────────────────


def cmd_pr_lint(a):
    """The change body format build.template.js writes."""
    e = Effort.resolve(a.effort)
    c = e.change(a.number)
    body, problems = c["body"], []
    m = re.search(r"^Closes #(\d+)", body, re.M)
    if not m:
        problems.append("no 'Closes #<piece>' line")
    elif c["issue"] != int(m.group(1)):
        problems.append(f"the body closes #{m.group(1)} but the change is linked to issue {c['issue']}")
    else:
        piece = e.issue(m.group(1))
        acc = re.search(r"^## Acceptance\s*\n(.*?)(?=^## |\Z)", piece["body"], re.M | re.S)
        wanted = sorted(set(re.findall(r"^- (B\d+)", acc.group(1), re.M))) if acc else []
        beh = re.search(r"^## Behaviors\s*\n(.*?)(?=^## |\Z)", body, re.M | re.S)
        lines = beh.group(1) if beh else ""
        for b in wanted:
            line = re.search(rf"^- {b}:.*$", lines, re.M)
            if not line:
                problems.append(f"Behaviors has no line for {b}")
            elif "evidence:" not in line.group(0).lower():
                problems.append(f"{b} has no evidence")
    for s in ("Behaviors", "Decisions", "Deviations"):
        if not re.search(rf"^## {s}", body, re.M):
            problems.append(f"no '## {s}' section")
    if not c["head"]:
        die(f"change {a.number} has no head: its branch is gone")
    sc("status", "set", c["head"], "wayfinder/pr-format", "fail" if problems else "pass", "--description",
       ("; ".join(problems) if problems else "change body has evidence for every behavior")[:140])
    if problems:
        print("\n".join(problems))
        sys.exit(1)
    print("ok")


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
        "EFFORT_CMD": f"python3 {HERE / 'effort.py'} --effort {e.slug}", "AWAIT_CMD": str(HERE / "await.sh"),
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
        # sc replaces no comment, so a round a dead run posted twice is read from its newest comment.
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
    p.add_argument("--effort", "-e", help="the effort's slug (default: $WAYFINDER_EFFORT, or the only effort here)")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("setup", help="create effort/<slug> with the charter and sc.toml committed, and have sc protect and gate it")
    s.add_argument("slug")
    s.add_argument("--charter", required=True, help="the charter file to commit as docs/wayfinder/<slug>.md")
    s.add_argument("--sc-toml", help="the sc.toml to commit, holding the CI jobs (default: the base branch's own)")
    s.add_argument("--base", help="branch to start from (default: the main checkout's current branch)")
    s.add_argument("--add", action="append", help="a file or directory in the main checkout to commit beside the charter (repeatable)")
    s.set_defaults(fn=cmd_setup)

    s = sub.add_parser("charter-check", help="print what in the charter's shape would stop the effort; exits 1 when anything does")
    s.add_argument("--file", help="a charter file to check (default: the charter on the effort branch)")
    s.set_defaults(fn=cmd_charter_check)

    s = sub.add_parser("show", help="print the effort: branch, base, charter, plan, head, CI jobs, required statuses, gate")
    s.set_defaults(fn=cmd_show)

    s = sub.add_parser("pieces", help="every piece of the plan with its derived state, its open change, and that change's statuses")
    s.set_defaults(fn=cmd_pieces)

    s = sub.add_parser("fill", help="fill the build or review workflow template from sc and the effort branch, and print the script's path")
    s.add_argument("kind", choices=["build", "review"]); s.add_argument("number", type=int, help="the piece (build) or the change (review)")
    s.add_argument("--fix-input", help="build: a file holding the review round's findings and answers, or the conflict; makes it fix mode")
    s.add_argument("--round", type=int, help="review: this round's number, when a dead run left a comment for it")
    s.add_argument("--verify-skill", help="the verify skill's repo path, when the charter's line does not settle it; '' for the piece that builds it")
    s.add_argument("--app", help="the <app> of verify-<app>, when no verify skill exists yet")
    s.add_argument("--out", help="where to write the script (default: $TMPDIR/wayfinder/<slug>/<kind>-<number>.js)")
    s.set_defaults(fn=cmd_fill)

    s = sub.add_parser("pr-lint", help="check a change's body format and set wayfinder/pr-format on its head")
    s.add_argument("number", type=int); s.set_defaults(fn=cmd_pr_lint)

    s = sub.add_parser("check-base", help="run every CI job once on the effort branch's head")
    s.set_defaults(fn=cmd_check_base)

    s = sub.add_parser("finish", help="retire the effort after its branch is merged: close its open changes and unprotect the branch")
    s.add_argument("--force", action="store_true", help="finish though the effort branch is not an ancestor of its base")
    s.set_defaults(fn=cmd_finish)

    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
