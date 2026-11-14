#!/usr/bin/env python3
"""The local forge for a wayfinder effort, per SKILL.md.

Everything an effort needs from a forge, kept inside the repo's git directory:
the tracker (plan, pieces, risks, tasks, decisions, comments, blocking edges),
change records (a piece branch proposed for the effort branch, standing in for a
pull request), commit statuses, and the gate — the one process that runs CI and
moves the effort branch. Every write takes the effort's lock, so any number of
agents can call it at once.

Run `wf.py --help` and `wf.py <command> --help` for the commands. Every agent
reaches the effort through this file; nothing else writes the store.
"""

import argparse
import concurrent.futures
import fcntl
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
SLOT_CMD = HERE / "slot.sh"
REVIEW_CONTEXTS = ["wayfinder/pr-format", "wayfinder/spec", "wayfinder/standards"]
STATUS_CONTEXTS = REVIEW_CONTEXTS + ["wayfinder/verify", "wayfinder/merge"]
STATES = ("pending", "success", "failure", "error")
HOOK_MARK = "# wayfinder: only the gate moves effort branches"
HOOK = f"""#!/bin/sh
{HOOK_MARK}
[ "$1" = prepared ] || exit 0
[ "$WAYFINDER_GATE" = 1 ] && exit 0
while read -r old new ref; do
  case "$ref" in
    refs/heads/effort/*)
      if [ "$old" != "$new" ]; then
        echo "wayfinder: only the gate moves $ref — open a change with wf.py change open instead" >&2
        exit 1
      fi ;;
  esac
done
exit 0
"""


def die(msg, code=1):
    print(f"wf: {msg}", file=sys.stderr)
    sys.exit(code)


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def git(*args, cwd=None, env=None, check=True):
    r = subprocess.run(["git", *args], cwd=cwd, env=env, capture_output=True, text=True)
    if check and r.returncode != 0:
        die(f"git {' '.join(args)}: {r.stderr.strip() or r.stdout.strip()}")
    return r


def common_dir():
    r = git("rev-parse", "--path-format=absolute", "--git-common-dir", check=False)
    if r.returncode != 0:
        die("not inside a git repository")
    return Path(r.stdout.strip())


def repo_root():
    """The main checkout: the worktree that owns the common git directory."""
    out = git("worktree", "list", "--porcelain").stdout
    return Path(out.split("\n", 1)[0].removeprefix("worktree ").strip())


def gate_env():
    return {**os.environ, "WAYFINDER_GATE": "1"}


# ── The store ────────────────────────────────────────────────────────────────


class Effort:
    def __init__(self, slug):
        self.slug = slug
        self.root = common_dir() / "wayfinder" / slug
        self.branch = f"effort/{slug}"

    @staticmethod
    def resolve(slug):
        base = common_dir() / "wayfinder"
        if not slug:
            slug = os.environ.get("WAYFINDER_EFFORT")
        if not slug:
            found = sorted(p.name for p in base.glob("*") if (p / "effort.json").exists()) if base.exists() else []
            if len(found) != 1:
                die("name the effort with --effort <slug>" + (f" (one of: {', '.join(found)})" if found else " — none is set up here"))
            slug = found[0]
        e = Effort(slug)
        if not (e.root / "effort.json").exists():
            die(f"no effort '{slug}' here — run wf.py setup {slug} first")
        return e

    @contextmanager
    def lock(self):
        self.root.mkdir(parents=True, exist_ok=True)
        with open(self.root / "lock", "w") as f:
            fcntl.flock(f, fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(f, fcntl.LOCK_UN)

    def path(self, *parts):
        return self.root.joinpath(*parts)

    def read(self, *parts, default=None):
        p = self.path(*parts)
        return json.loads(p.read_text()) if p.exists() else default

    def write(self, data, *parts):
        p = self.path(*parts)
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2) + "\n")
        tmp.replace(p)

    def meta(self):
        return self.read("effort.json")

    def next_number(self, kind):
        counters = self.read("counters.json", default={})
        counters[kind] = counters.get(kind, 0) + 1
        self.write(counters, "counters.json")
        return counters[kind]

    def event(self, kind, **fields):
        with open(self.path("events.log"), "a") as f:
            f.write(json.dumps({"at": now(), "kind": kind, **fields}) + "\n")

    # issues
    def issue(self, n):
        i = self.read("issues", f"{int(n)}.json")
        if i is None:
            die(f"no issue #{n}")
        return i

    def issues(self):
        d = self.path("issues")
        return sorted((json.loads(p.read_text()) for p in d.glob("*.json")), key=lambda i: i["number"]) if d.exists() else []

    def save_issue(self, i):
        i["updated_at"] = now()
        self.write(i, "issues", f"{i['number']}.json")

    def open_blockers(self, i):
        return [b for b in i.get("blocked_by", []) if self.read("issues", f"{b}.json", default={}).get("state") == "open"]

    # changes
    def change(self, n):
        c = self.read("changes", f"{int(n)}.json")
        if c is None:
            die(f"no change {n}")
        return c

    def changes(self):
        d = self.path("changes")
        return sorted((json.loads(p.read_text()) for p in d.glob("*.json")), key=lambda c: c["number"]) if d.exists() else []

    def save_change(self, c):
        c["updated_at"] = now()
        self.write(c, "changes", f"{c['number']}.json")

    # statuses
    def statuses(self, sha):
        return self.read("statuses", f"{sha}.json", default={})

    def set_status(self, sha, context, state, description):
        s = self.statuses(sha)
        s[context] = {"state": state, "description": description[:140], "at": now()}
        self.write(s, "statuses", f"{sha}.json")

    # charter
    def charter(self, ref=None):
        m = self.meta()
        r = git("show", f"{ref or self.branch}:{m['charter']}", check=False)
        if r.returncode != 0:
            die(f"no charter at {m['charter']} on {ref or self.branch}")
        return r.stdout

    def ci_jobs(self, ref=None):
        """The charter's CI section: lines '- **<name>:** `<command>`'."""
        text = self.charter(ref)
        section = re.search(r"^## CI\s*\n(.*?)(?=^## |\Z)", text, re.M | re.S)
        if not section:
            return []
        return [{"name": m.group(1).strip(), "command": m.group(2).strip()}
                for m in re.finditer(r"^- \*\*([^*:]+):\*\*\s*`([^`]+)`", section.group(1), re.M)]

    def limit(self, name, default):
        m = re.search(rf"^- \*\*{re.escape(name)}:\*\*\s*(\d+)", self.charter(), re.M)
        return int(m.group(1)) if m else default

    def required_contexts(self):
        return [f"ci/{j['name']}" for j in self.ci_jobs()] + REVIEW_CONTEXTS

    def head(self, branch):
        r = git("rev-parse", "--verify", "--quiet", f"refs/heads/{branch}", check=False)
        return r.stdout.strip() or None


def body_arg(a):
    if getattr(a, "body_file", None):
        return Path(a.body_file).read_text() if a.body_file != "-" else sys.stdin.read()
    return getattr(a, "body", None) or ""


def emit(data, as_json=True):
    print(json.dumps(data, indent=2) if as_json else data)


# ── setup ────────────────────────────────────────────────────────────────────


def cmd_setup(a):
    e = Effort(a.slug)
    root = repo_root()
    if (e.root / "effort.json").exists():
        die(f"effort '{a.slug}' is already set up")
    charter_path = f"docs/wayfinder/{a.slug}.md"
    src = Path(a.charter).resolve()
    if not src.exists():
        die(f"no charter file at {a.charter}")
    hooks = Path(git("rev-parse", "--path-format=absolute", "--git-path", "hooks").stdout.strip())
    hook = hooks / "reference-transaction"
    if hook.exists() and HOOK_MARK not in hook.read_text():
        die(f"{hook} already exists and isn't wayfinder's; merge the two by hand, then rerun")

    base = a.base or git("rev-parse", "--abbrev-ref", "HEAD", cwd=root).stdout.strip()
    with e.lock():
        e.root.mkdir(parents=True, exist_ok=True)
        if not e.head(e.branch):
            git("branch", e.branch, base, env=gate_env())
        checkout = e.path("gate-checkout")
        if not checkout.exists():
            git("worktree", "add", str(checkout), e.branch, env=gate_env())
        dest = checkout / charter_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(src.read_text())
        git("add", charter_path, cwd=checkout)
        for extra in a.add or []:
            rel = Path(extra).resolve().relative_to(root)
            if not (root / rel).exists():
                die(f"--add {extra}: no such file or directory")
            if (root / rel).is_dir():
                shutil.copytree(root / rel, checkout / rel, dirs_exist_ok=True)
            else:
                (checkout / rel).parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(root / rel, checkout / rel)
            git("add", "--", str(rel), cwd=checkout)
        if git("diff", "--cached", "--quiet", cwd=checkout, check=False).returncode != 0:
            git("commit", "-m", f"Charter for {a.slug}", cwd=checkout, env=gate_env())
        hooks.mkdir(parents=True, exist_ok=True)
        hook.write_text(HOOK)
        hook.chmod(0o755)
        e.write({"slug": a.slug, "branch": e.branch, "charter": charter_path, "base": base,
                 "plan": None, "repo": str(root), "created_at": now()}, "effort.json")
        e.event("setup", branch=e.branch)
    emit({"effort": a.slug, "branch": e.branch, "base": base, "charter": charter_path, "store": str(e.root)})


def cmd_effort(a):
    e = Effort.resolve(a.effort)
    m = e.meta()
    emit({**m, "store": str(e.root), "head": e.head(e.branch), "ci": e.ci_jobs(),
          "gate_running": gate_running(e)})


# ── issues ───────────────────────────────────────────────────────────────────


def cmd_issue(a):
    e = Effort.resolve(a.effort)
    if a.op == "create":
        with e.lock():
            n = e.next_number("issue")
            i = {"number": n, "title": a.title, "body": body_arg(a), "state": "open", "state_reason": None,
                 "labels": sorted(set(a.label or [])), "parent": a.parent, "blocked_by": [], "comments": [],
                 "created_at": now()}
            e.save_issue(i)
            if "wayfinder:plan" in i["labels"]:
                m = e.meta()
                m["plan"] = n
                e.write(m, "effort.json")
            e.event("issue-created", issue=n, title=a.title)
        print(n)
    elif a.op == "show":
        i = e.issue(a.number)
        i["open_blockers"] = e.open_blockers(i)
        emit(i)
    elif a.op == "list":
        out = []
        for i in e.issues():
            if a.state != "all" and i["state"] != a.state:
                continue
            if a.label and not all(l in i["labels"] for l in a.label):
                continue
            if a.parent is not None and i.get("parent") != a.parent:
                continue
            if a.search and a.search not in i["body"] and a.search not in i["title"]:
                continue
            out.append({k: i[k] for k in ("number", "title", "state", "state_reason", "labels", "parent", "blocked_by")}
                       | {"open_blockers": e.open_blockers(i)})
        emit(out)
    else:
        with e.lock():
            i = e.issue(a.number)
            if a.op == "edit":
                if a.title:
                    i["title"] = a.title
                if a.body_file or a.body:
                    i["body"] = body_arg(a)
            elif a.op == "comment":
                cid = post_comment(i, a)
                e.event("comment", issue=i["number"], comment=cid, author="human" if a.human else "agent")
                print(cid)
            elif a.op == "label":
                i["labels"] = sorted((set(i["labels"]) | set(a.add or [])) - set(a.remove or []))
            elif a.op == "close":
                i["state"], i["state_reason"] = "closed", ("not_planned" if a.not_planned else "completed")
                e.event("issue-closed", issue=i["number"], reason=i["state_reason"], by="human" if a.human else "agent")
            elif a.op == "reopen":
                i["state"], i["state_reason"] = "open", None
            elif a.op == "block":
                for b in a.by or []:
                    e.issue(b)
                    if b == i["number"]:
                        die("an issue can't block itself")
                    if b not in i["blocked_by"]:
                        i["blocked_by"].append(b)
                for b in a.unblock or []:
                    i["blocked_by"] = [x for x in i["blocked_by"] if x != b]
            e.save_issue(i)


def post_comment(record, a):
    """Appends a comment to an issue or change, or replaces the body of comment --edit. Returns its id."""
    if a.edit:
        old = next((c for c in record["comments"] if c["id"] == a.edit), None) or die(f"no comment {a.edit}")
        old.update(body=body_arg(a), edited_at=now())
        return a.edit
    cid = len(record["comments"]) + 1
    record["comments"].append({"id": cid, "at": now(), "author": "human" if a.human else "agent", "body": body_arg(a)})
    return cid


def cmd_dependents(a):
    e = Effort.resolve(a.effort)
    emit([{"number": i["number"], "title": i["title"], "state": i["state"]}
          for i in e.issues() if a.number in i.get("blocked_by", [])])


# ── changes ──────────────────────────────────────────────────────────────────


def change_view(e, c):
    head = e.head(c["branch"]) if c["state"] == "open" else c.get("merged_head")
    st = e.statuses(head) if head else {}
    req = e.required_contexts()
    return {**{k: c[k] for k in ("number", "piece", "branch", "base", "title", "body", "state", "merged_sha", "comments")},
            "head": head, "statuses": st,
            "passing": bool(head) and all(st.get(x, {}).get("state") == "success" for x in req),
            "required": req}


def cmd_change(a):
    e = Effort.resolve(a.effort)
    if a.op == "open":
        if not e.head(a.branch):
            die(f"no branch {a.branch}")
        e.issue(a.piece)
        with e.lock():
            for c in e.changes():
                if c["state"] == "open" and c["branch"] == a.branch:
                    die(f"change {c['number']} is already open for {a.branch}")
            n = e.next_number("change")
            c = {"number": n, "piece": a.piece, "branch": a.branch, "base": e.branch, "title": a.title,
                 "body": body_arg(a), "state": "open", "merged_sha": None, "comments": [], "created_at": now()}
            e.save_change(c)
            e.event("change-opened", change=n, piece=a.piece)
        print(n)
    elif a.op == "show":
        emit(change_view(e, e.change(a.number)))
    elif a.op == "list":
        emit([{k: v for k, v in change_view(e, c).items() if k not in ("body", "comments")}
              for c in e.changes()
              if (a.state == "all" or c["state"] == a.state) and (a.piece is None or c["piece"] == a.piece)])
    else:
        with e.lock():
            c = e.change(a.number)
            if a.op == "edit":
                if a.title:
                    c["title"] = a.title
                if a.body_file or a.body:
                    c["body"] = body_arg(a)
            elif a.op == "comment":
                cid = post_comment(c, a)
                e.event("comment", change=c["number"], comment=cid, author="human" if a.human else "agent")
                print(cid)
            elif a.op == "close":
                c["state"] = "closed"
                e.event("change-closed", change=c["number"])
            e.save_change(c)


# ── statuses ─────────────────────────────────────────────────────────────────


def resolve_sha(e, ref):
    if re.fullmatch(r"[0-9a-f]{40}", ref):
        return ref
    if ref.isdigit():
        return change_view(e, e.change(ref))["head"] or die(f"change {ref} has no head")
    r = git("rev-parse", "--verify", "--quiet", ref, check=False)
    return r.stdout.strip() or die(f"can't resolve {ref} to a commit")


def cmd_status(a):
    e = Effort.resolve(a.effort)
    if a.op == "show":
        emit(e.statuses(resolve_sha(e, a.ref)))
        return
    if a.context not in STATUS_CONTEXTS:
        die(f"agents may post only {', '.join(STATUS_CONTEXTS)}; ci/* belongs to the gate")
    if a.state not in STATES:
        die(f"state must be one of {', '.join(STATES)}")
    with e.lock():
        sha = resolve_sha(e, a.ref)
        e.set_status(sha, a.context, a.state, a.description)
        e.event("status", sha=sha, context=a.context, state=a.state)


def cmd_pr_lint(a):
    """The change body format build.template.js writes."""
    e = Effort.resolve(a.effort)
    c = e.change(a.number)
    body, problems = c["body"], []
    m = re.search(r"^Closes #(\d+)", body, re.M)
    if not m:
        problems.append("no 'Closes #<piece>' line")
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
    head = e.head(c["branch"])
    with e.lock():
        if problems:
            e.set_status(head, "wayfinder/pr-format", "failure", "; ".join(problems))
        else:
            e.set_status(head, "wayfinder/pr-format", "success", "change body has evidence for every behavior")
    if problems:
        print("\n".join(problems))
        sys.exit(1)
    print("ok")


def cmd_ci_wait(a):
    e = Effort.resolve(a.effort)
    waited = 0
    while True:
        v = change_view(e, e.change(a.number))
        jobs = [f"ci/{j['name']}" for j in e.ci_jobs()]
        st = v["statuses"]
        if v["state"] != "open":
            emit({"result": "green" if v["state"] == "merged" else "none", "sha": v["head"], "failing": [], "note": f"change is {v['state']}"})
            sys.exit(0 if v["state"] == "merged" else 2)
        done = [x for x in jobs if st.get(x, {}).get("state") in ("success", "failure", "error")]
        if jobs and len(done) == len(jobs):
            failing = [x for x in jobs if st[x]["state"] != "success"]
            emit({"result": "red" if failing else "green", "sha": v["head"], "failing": failing,
                  "details": {x: st[x]["description"] for x in failing}})
            sys.exit(1 if failing else 0)
        if not jobs:
            emit({"result": "none", "sha": v["head"], "failing": [], "note": "the charter has no CI jobs"})
            sys.exit(2)
        if waited >= a.timeout:
            emit({"result": "none", "sha": v["head"], "failing": [],
                  "note": "timed out" + ("" if gate_running(e) else "; the gate is not running")})
            sys.exit(2)
        time.sleep(10)
        waited += 10


# ── derived piece state ──────────────────────────────────────────────────────


def piece_states(e):
    plan = e.meta().get("plan")
    changes = e.changes()
    out = []
    for i in e.issues():
        if plan is None or i.get("parent") != plan:
            continue
        mine = [c for c in changes if c["piece"] == i["number"]]
        open_c = next((c for c in reversed(mine) if c["state"] == "open"), None)
        view = change_view(e, open_c) if open_c else None
        conflict = bool(view and view["statuses"].get("wayfinder/merge", {}).get("state") == "failure")
        labels = i["labels"]
        if i["state"] == "closed":
            state = "dropped" if i["state_reason"] == "not_planned" else "done"
        elif "wayfinder:parked" in labels:
            state = "parked"
        elif "hitl" in labels:
            state = "waiting"
        elif view and view["passing"] and not conflict:
            state = "landing"
        elif view:
            state = "in-review"
        elif e.open_blockers(i):
            state = "blocked"
        elif "in-progress" in labels:
            state = "working"
        else:
            state = "ready"
        out.append({"number": i["number"], "title": i["title"], "labels": labels, "state": state,
                    "change": open_c["number"] if open_c else (mine[-1]["number"] if mine else None),
                    "headSha": view["head"] if view else None, "conflict": conflict})
    return out


def cmd_pieces(a):
    emit(piece_states(Effort.resolve(a.effort)))


# ── the gate ─────────────────────────────────────────────────────────────────


def gate_running(e):
    p = e.path("gate.lock")
    if not p.exists():
        return False
    with open(p, "w") as f:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            fcntl.flock(f, fcntl.LOCK_UN)
            return False
        except BlockingIOError:
            return True


def group_alive(pgid):
    """Whether any process is left in a job's process group."""
    try:
        os.killpg(pgid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def run_job(e, job, sha, workdir, slots, log_path, timeout):
    """Runs one CI job on one commit in a worker checkout. Returns (state, description)."""
    git("checkout", "--detach", "--force", sha, cwd=workdir)
    git("clean", "-fdq", cwd=workdir)  # keeps ignored build caches such as target/
    cmd = [str(SLOT_CMD), str(slots), "build", "--", "sh", "-c", job["command"]]
    started = time.time()
    with open(log_path, "w") as log:
        log.write(f"$ {job['command']}\n# commit {sha}\n")
        log.flush()
        p = subprocess.Popen(cmd, cwd=workdir, stdout=log, stderr=subprocess.STDOUT, start_new_session=True,
                             env={**os.environ, "WAYFINDER_CI": "1"})
        try:
            code = p.wait(timeout=timeout)
            timed_out = False
        except subprocess.TimeoutExpired:
            timed_out = True
            code = None
        # The job ran in its own process group: whatever it left behind is still in it.
        stray = group_alive(p.pid)
        for sig in (signal.SIGTERM, signal.SIGKILL):
            if not group_alive(p.pid):
                break
            try:
                os.killpg(p.pid, sig)
            except (ProcessLookupError, PermissionError):
                pass
            time.sleep(2)
        if timed_out:
            p.wait()
    secs = int(time.time() - started)
    dur = f"{secs // 60}m{secs % 60:02d}s"
    if timed_out:
        return "failure", f"timed out after {dur}; log {log_path}"
    if code != 0:
        tail = log_path.read_text(errors="replace").strip().splitlines()[2:][-1:] or ["no output"]
        return "failure", f"exit {code} after {dur}: {tail[0][:80]}"
    if stray:
        return "failure", f"passed but left processes running, which the gate stopped; log {log_path}"
    return "success", f"passed in {dur}"


def land(e, c, log):
    """Squash-merges an open, passing change into the effort branch. Returns the new sha or None."""
    checkout = e.path("gate-checkout")
    env = gate_env()
    git("reset", "--hard", "--quiet", cwd=checkout, env=env)
    git("clean", "-fdq", cwd=checkout)
    head = e.head(c["branch"])
    r = git("merge", "--squash", "--no-commit", c["branch"], cwd=checkout, env=env, check=False)
    if r.returncode != 0:
        files = git("diff", "--name-only", "--diff-filter=U", cwd=checkout, check=False).stdout.split()
        git("reset", "--hard", "--quiet", cwd=checkout, env=env)
        with e.lock():
            e.set_status(head, "wayfinder/merge", "failure", "conflicts with the effort branch: " + ", ".join(files or ["(see log)"]))
            e.event("conflict", change=c["number"], piece=c["piece"], files=files)
        log(f"change {c['number']}: conflicts in {', '.join(files)}")
        return None
    if git("diff", "--cached", "--quiet", cwd=checkout, check=False).returncode == 0:
        sha = e.head(e.branch)
    else:
        git("commit", "--quiet", "-m", f"{c['title']} (#{c['piece']})", "-m", f"Change {c['number']} from {c['branch']}.",
            cwd=checkout, env=env)
        sha = e.head(e.branch)
    with e.lock():
        e.set_status(head, "wayfinder/merge", "success", f"merged as {sha[:10]}")
        fresh = e.change(c["number"])
        fresh.update(state="merged", merged_sha=sha, merged_head=head)
        e.save_change(fresh)
        piece = e.issue(c["piece"])
        piece["state"], piece["state_reason"] = "closed", "completed"
        piece["labels"] = [l for l in piece["labels"] if l != "in-progress"]
        piece["comments"].append({"id": len(piece["comments"]) + 1, "at": now(), "author": "gate",
                                  "body": f"<!-- wayfinder merged -->\nMerged into {e.branch} as {sha} from change {c['number']}."})
        e.save_issue(piece)
        e.event("merged", change=c["number"], piece=c["piece"], sha=sha)
    log(f"change {c['number']} (#{c['piece']}) merged as {sha[:10]}")
    return sha


def cmd_gate(a):
    e = Effort.resolve(a.effort)
    lockf = open(e.path("gate.lock"), "w")
    try:
        fcntl.flock(lockf, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        die("the gate is already running for this effort")
    slots = e.limit("Build slots", 2)
    workers = [e.path("ci", f"w{k}") for k in range(slots)]
    for w in workers:
        if not w.exists():
            w.parent.mkdir(parents=True, exist_ok=True)
            git("worktree", "add", "--detach", str(w), e.branch)
    free = list(workers)
    free_lock = threading.Lock()
    running = {}  # (sha, job name) -> future
    pool = concurrent.futures.ThreadPoolExecutor(max_workers=slots)
    (e.path("logs")).mkdir(parents=True, exist_ok=True)

    def log(msg):
        print(f"{datetime.now().strftime('%H:%M:%S')}  {msg}", flush=True)

    def job_task(job, sha, change_n):
        with free_lock:
            w = free.pop()
        try:
            lp = e.path("logs", f"{sha[:12]}-{job['name']}.log")
            state, desc = run_job(e, job, sha, w, slots, lp, a.timeout)
        except Exception as ex:  # a broken worker is a failed job, never a silent pass
            state, desc = "error", f"gate error: {ex}"[:140]
        finally:
            with free_lock:
                free.append(w)
        with e.lock():
            e.set_status(sha, f"ci/{job['name']}", state, desc)
            e.event("ci", change=change_n, sha=sha, job=job["name"], state=state)
        log(f"change {change_n} {sha[:10]} ci/{job['name']}: {state} — {desc}")

    log(f"gate for {e.branch}: {slots} workers, CI jobs {', '.join(j['name'] for j in e.ci_jobs()) or 'none'}")
    while True:
        if e.meta().get("finished_at"):
            log("the effort is finished; gate stopping")
            return
        try:
            jobs = e.ci_jobs()
            for c in e.changes():
                if c["state"] != "open":
                    continue
                head = e.head(c["branch"])
                if not head:
                    continue
                st = e.statuses(head)
                for job in jobs:
                    key = (head, job["name"])
                    if f"ci/{job['name']}" in st or key in running:
                        continue
                    with e.lock():
                        e.set_status(head, f"ci/{job['name']}", "pending", "queued")
                    running[key] = pool.submit(job_task, job, head, c["number"])
            for key in [k for k, f in running.items() if f.done()]:
                running.pop(key)
            for c in e.changes():
                if c["state"] != "open":
                    continue
                v = change_view(e, c)
                if not v["passing"] or v["statuses"].get("wayfinder/merge", {}).get("state") == "failure":
                    continue
                piece = e.issue(c["piece"])
                if e.open_blockers(piece) or "wayfinder:parked" in piece["labels"]:
                    continue
                land(e, c, log)
        except SystemExit as ex:
            log(f"gate cycle failed: {ex}")
        time.sleep(a.interval)


def cmd_check_base(a):
    """Runs every CI job once on the effort branch's head, in the foreground."""
    e = Effort.resolve(a.effort)
    jobs = e.ci_jobs()
    if not jobs:
        die("the charter's ## CI section lists no jobs")
    w = e.path("ci", "base")
    if not w.exists():
        w.parent.mkdir(parents=True, exist_ok=True)
        git("worktree", "add", "--detach", str(w), e.branch)
    sha = e.head(e.branch)
    e.path("logs").mkdir(parents=True, exist_ok=True)
    failed = 0
    for job in jobs:
        lp = e.path("logs", f"{sha[:12]}-{job['name']}.log")
        state, desc = run_job(e, job, sha, w, e.limit("Build slots", 2), lp, a.timeout)
        print(f"{'PASS' if state == 'success' else 'FAIL'}  ci/{job['name']} on {sha[:10]}: {desc}")
        failed |= state != "success"
    sys.exit(1 if failed else 0)


def cmd_ci_log(a):
    """Prints the gate's log of each failing CI job on a change's head (or of --job)."""
    e = Effort.resolve(a.effort)
    v = change_view(e, e.change(a.number))
    names = [a.job] if a.job else [k[3:] for k, s in v["statuses"].items() if k.startswith("ci/") and s["state"] in ("failure", "error")]
    if not names:
        die(f"no failing CI job on change {a.number}'s head {v['head']}; name one with --job")
    for name in names:
        lp = e.path("logs", f"{v['head'][:12]}-{name}.log")
        print(f"==> ci/{name} on {v['head']}: {lp}")
        if lp.exists():
            lines = lp.read_text(errors="replace").splitlines()
            print("\n".join(lines[-a.lines:] if a.lines else lines))
        else:
            print("(no log: the job has not run on this commit)")


def cmd_ci_rerun(a):
    """Clears the finished, failed CI statuses on a change's head so the gate runs those jobs again."""
    e = Effort.resolve(a.effort)
    with e.lock():
        v = change_view(e, e.change(a.number))
        if v["state"] != "open":
            die(f"change {a.number} is {v['state']}")
        st = e.statuses(v["head"])
        cleared = [k for k, s in st.items() if k.startswith("ci/") and s["state"] in ("failure", "error")]
        for k in cleared:
            del st[k]
        e.write(st, "statuses", f"{v['head']}.json")
        e.event("ci-rerun", change=a.number, sha=v["head"], jobs=cleared)
    emit({"sha": v["head"], "rerunning": cleared})


# ── closing an effort ────────────────────────────────────────────────────────


def cmd_report(a):
    """The closing report: the one document the human reads to accept the effort."""
    e = Effort.resolve(a.effort)
    p = e.path("report.md")
    if a.op == "set":
        with e.lock():
            p.write_text(body_arg(a))
            e.event("report", head=e.head(e.branch))
        print(p)
    else:
        if not p.exists():
            die("no closing report yet")
        print(p.read_text())


def cmd_finish(a):
    """Ends the effort once the human has taken its branch: stops the gate, removes its checkouts and the hook."""
    e = Effort.resolve(a.effort)
    m = e.meta()
    head = e.head(e.branch)
    merged = bool(head) and git("merge-base", "--is-ancestor", head, m["base"], check=False).returncode == 0
    if not merged and not a.force:
        die(f"{e.branch} is not merged into {m['base']} — merge it first, or pass --force when it was squashed or is being abandoned")
    with e.lock():
        m["finished_at"] = now()
        e.write(m, "effort.json")
        e.event("finished", head=head, merged=merged)
    for _ in range(30):  # the gate sees finished_at and stops within its interval
        if not gate_running(e):
            break
        time.sleep(1)
    else:
        die("the gate is still running; stop it, then rerun finish")
    for w in [e.path("gate-checkout"), *sorted(e.path("ci").glob("*"))]:
        if w.exists():
            git("worktree", "remove", "--force", str(w), check=False)
    others = [p for p in (common_dir() / "wayfinder").glob("*/effort.json")
              if p.parent.name != e.slug and not json.loads(p.read_text()).get("finished_at")]
    hook = Path(git("rev-parse", "--path-format=absolute", "--git-path", "hooks").stdout.strip()) / "reference-transaction"
    if not others and hook.exists() and HOOK_MARK in hook.read_text():
        hook.unlink()
    emit({"finished": e.slug, "branch": e.branch, "merged": merged, "hook_removed": not others, "store": str(e.root)})


# ── the lead's watcher and the status pane ───────────────────────────────────


WAKE = {"merged", "conflict"}


def cmd_watch(a):
    """Blocks until something the lead must act on happens outside its workflows, prints it, exits."""
    e = Effort.resolve(a.effort)
    events = e.path("events.log")
    state = e.path("watch.offset")
    offset = int(state.read_text()) if state.exists() else (events.stat().st_size if events.exists() else 0)
    while True:
        if events.exists() and events.stat().st_size > offset:
            with open(events) as f:
                f.seek(offset)
                chunk = f.read()
            offset += len(chunk.encode())
            hits = []
            for line in chunk.splitlines():
                ev = json.loads(line)
                if ev["kind"] in WAKE or ev.get("author") == "human" or ev.get("by") == "human":
                    hits.append(line)
            state.write_text(str(offset))
            if hits:
                print("\n".join(hits))
                return
        time.sleep(a.interval)


def cmd_status_pane(a):
    e = Effort.resolve(a.effort)
    order = ["working", "in-review", "landing", "ready", "blocked", "waiting", "parked", "done", "dropped"]
    while True:
        try:
            m = e.meta()
            pieces = piece_states(e)
            others = [i for i in e.issues() if i["state"] == "open" and i.get("parent") != m.get("plan") and i["number"] != m.get("plan")]
            plan = e.issue(m["plan"])["title"] if m.get("plan") else "(no plan yet)"
            lines = [f"{plan}   {e.branch}   gate {'running' if gate_running(e) else 'NOT RUNNING'}   {datetime.now():%H:%M:%S}", ""]
            counts = {}
            for p in pieces:
                counts[p["state"]] = counts.get(p["state"], 0) + 1
            lines.append("   ".join(f"{s} {counts[s]}" for s in order if s in counts) or "no pieces yet")
            lines.append("")
            for p in sorted(pieces, key=lambda p: order.index(p["state"])):
                if p["state"] in ("done", "dropped"):
                    continue
                extra = f"  (change {p['change']}{', CONFLICT' if p['conflict'] else ''})" if p["change"] and p["state"] in ("in-review", "landing") else ""
                lines.append(f"  {p['state']:<10}  #{p['number']}  {p['title']}{extra}")
            lines += ["", "Waiting on you:"]
            waiting = [i for i in e.issues() if i["state"] == "open" and "hitl" in i["labels"]]
            lines += [f"  #{i['number']}  {i['title']}" for i in waiting] or ["  nothing"]
            lines += ["", "Risks being proved:"]
            risks = [i for i in others if "wayfinder:risk" in i["labels"]]
            lines += [f"  #{i['number']}  {i['title']}" for i in risks] or ["  none"]
            print("\033[H\033[2J" + "\n".join(lines), flush=True)
        except SystemExit:
            pass
        time.sleep(a.interval)


# ── CLI ──────────────────────────────────────────────────────────────────────


def main():
    p = argparse.ArgumentParser(prog="wf.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--effort", "-e", help="the effort's slug (default: $WAYFINDER_EFFORT, or the only effort here)")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("setup", help="create effort/<slug> with the charter committed, protect it, and make the store")
    s.add_argument("slug")
    s.add_argument("--charter", required=True, help="the charter file to commit as docs/wayfinder/<slug>.md")
    s.add_argument("--base", help="branch to start from (default: the main checkout's current branch)")
    s.add_argument("--add", action="append", help="a file or directory in the main checkout to commit beside the charter (repeatable)")
    s.set_defaults(fn=cmd_setup)

    s = sub.add_parser("effort", help="print the effort: branch, charter, plan, head, CI jobs, gate")
    s.set_defaults(fn=cmd_effort)

    def body(sp):
        sp.add_argument("--body", help="text")
        sp.add_argument("--body-file", help="file with the text, or - for stdin")

    s = sub.add_parser("issue", help="the tracker: plan, pieces, risks, tasks, decisions")
    isub = s.add_subparsers(dest="op", required=True)
    x = isub.add_parser("create"); x.add_argument("--title", required=True); x.add_argument("--label", action="append")
    x.add_argument("--parent", type=int, help="the plan's number, for a piece"); body(x)
    x = isub.add_parser("show"); x.add_argument("number", type=int)
    x = isub.add_parser("list"); x.add_argument("--state", default="open", choices=["open", "closed", "all"])
    x.add_argument("--label", action="append"); x.add_argument("--parent", type=int); x.add_argument("--search")
    x = isub.add_parser("edit"); x.add_argument("number", type=int); x.add_argument("--title"); body(x)
    x = isub.add_parser("comment"); x.add_argument("number", type=int); x.add_argument("--human", action="store_true", help="the human's own comment: wakes the lead")
    x.add_argument("--edit", type=int, help="replace the body of this comment id instead of adding one"); body(x)
    x = isub.add_parser("label"); x.add_argument("number", type=int); x.add_argument("--add", action="append"); x.add_argument("--remove", action="append")
    x = isub.add_parser("close"); x.add_argument("number", type=int); x.add_argument("--not-planned", action="store_true"); x.add_argument("--human", action="store_true")
    x = isub.add_parser("reopen"); x.add_argument("number", type=int)
    x = isub.add_parser("block", help="NUMBER is blocked by --by issues"); x.add_argument("number", type=int)
    x.add_argument("--by", type=int, action="append"); x.add_argument("--unblock", type=int, action="append")
    s.set_defaults(fn=cmd_issue)

    s = sub.add_parser("dependents", help="issues blocked by NUMBER, open or closed"); s.add_argument("number", type=int)
    s.set_defaults(fn=cmd_dependents)

    s = sub.add_parser("pieces", help="every piece of the plan with its derived state"); s.set_defaults(fn=cmd_pieces)

    s = sub.add_parser("change", help="change records: a piece branch proposed for the effort branch")
    csub = s.add_subparsers(dest="op", required=True)
    x = csub.add_parser("open"); x.add_argument("--piece", type=int, required=True); x.add_argument("--branch", required=True)
    x.add_argument("--title", required=True); body(x)
    x = csub.add_parser("show"); x.add_argument("number", type=int)
    x = csub.add_parser("list"); x.add_argument("--state", default="open", choices=["open", "merged", "closed", "all"]); x.add_argument("--piece", type=int)
    x = csub.add_parser("edit"); x.add_argument("number", type=int); x.add_argument("--title"); body(x)
    x = csub.add_parser("comment"); x.add_argument("number", type=int); x.add_argument("--human", action="store_true", help="the human's own comment: wakes the lead")
    x.add_argument("--edit", type=int, help="replace the body of this comment id instead of adding one"); body(x)
    x = csub.add_parser("close"); x.add_argument("number", type=int)
    s.set_defaults(fn=cmd_change)

    s = sub.add_parser("status", help="commit statuses")
    ssub = s.add_subparsers(dest="op", required=True)
    x = ssub.add_parser("set", help="REF is a sha, a change number (its head), or a ref")
    x.add_argument("ref"); x.add_argument("context"); x.add_argument("state"); x.add_argument("description")
    x = ssub.add_parser("show"); x.add_argument("ref")
    s.set_defaults(fn=cmd_status)

    s = sub.add_parser("pr-lint", help="check a change's body format and set wayfinder/pr-format on its head")
    s.add_argument("number", type=int); s.set_defaults(fn=cmd_pr_lint)

    s = sub.add_parser("ci-wait", help="wait for the gate's CI on a change's head; exit 0 green, 1 red, 2 none")
    s.add_argument("number", type=int); s.add_argument("--timeout", type=int, default=3600); s.set_defaults(fn=cmd_ci_wait)

    s = sub.add_parser("ci-log", help="print the gate's log of each failing CI job on a change's head")
    s.add_argument("number", type=int); s.add_argument("--job"); s.add_argument("--lines", type=int, default=200, help="last N lines (0 for all)")
    s.set_defaults(fn=cmd_ci_log)

    s = sub.add_parser("ci-rerun", help="run a change's failed CI jobs again on the same commit, for a failure the change didn't cause")
    s.add_argument("number", type=int); s.set_defaults(fn=cmd_ci_rerun)

    s = sub.add_parser("report", help="the closing report the human reads to accept the effort")
    rsub = s.add_subparsers(dest="op", required=True)
    x = rsub.add_parser("set"); body(x)
    rsub.add_parser("show")
    s.set_defaults(fn=cmd_report)

    s = sub.add_parser("finish", help="end the effort after its branch is merged: stop the gate, remove its checkouts and the hook")
    s.add_argument("--force", action="store_true", help="finish though the effort branch is not an ancestor of its base")
    s.set_defaults(fn=cmd_finish)

    s = sub.add_parser("gate", help="run CI on every change and land passing ones; run it in a side pane")
    s.add_argument("--interval", type=int, default=5); s.add_argument("--timeout", type=int, default=3600)
    s.set_defaults(fn=cmd_gate)

    s = sub.add_parser("check-base", help="run every CI job once on the effort branch's head")
    s.add_argument("--timeout", type=int, default=3600); s.set_defaults(fn=cmd_check_base)

    s = sub.add_parser("watch", help="the lead's watcher: exit when a merge, conflict, or human action happens")
    s.add_argument("--interval", type=int, default=5); s.set_defaults(fn=cmd_watch)

    s = sub.add_parser("status-pane", help="live view of the effort, for a side pane")
    s.add_argument("--interval", type=int, default=10); s.set_defaults(fn=cmd_status_pane)

    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
