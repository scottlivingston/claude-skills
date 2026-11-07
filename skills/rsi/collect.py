"""List recent agent sessions and sample the ones /rsi scores.

Usage: python3 -I collect.py --since <ISO time> --out <dir> [--repo DIR]
                             [--max N] [--exclude <session id>] [--no-agents]
                             [-- <extra skill-doctor collector flags>]

Collection is skill-doctor's collector, vendored unmodified in upstream/: it
reads every local source it supports (Claude Code, Codex, Warp, Pi, Grok
Build, ZCode, Hermes), sub-agent sessions included, and writes a condensed
transcript per session under <out>/upstream/. This layer adds what /rsi needs
on top:

  - Claude Code plugin skills: the collector matches bare skill names, so it
    misses `scott-skills:iterate`. Claude Code sessions are re-read for their
    `attributionSkill` records, Skill tool calls, and the plugin version
    whose skill files they loaded.
  - Sub-agent sessions inherit their parent session's skills and version, so
    a workflow's agents count toward the skill that launched them.
  - Eval runs (sessions run from a temp directory), sessions before --since,
    and the --exclude session are dropped.
  - Sampling spreads across skills and holds a quarter of the slots each for
    sub-agent sessions and sessions with no skill.

Prints one JSON object to stdout:
  window     {since, until}: until is the newest swept session's mtime
  plugin     this repo's plugin name
  owned      skills this repo owns: `<plugin>:<skill>` and .claude/skills names
  unused     owned skills no swept session used
  sources    what the collector scanned, per harness
  coverage   fraction of swept top-level sessions that used any skill
  sessions   every swept session (see `row` below)
  sampled    the `transcript` of each session to score
"""
import argparse
import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

UPSTREAM = Path(__file__).resolve().parent / "upstream"
sys.path.insert(0, str(UPSTREAM))
import collect_sessions as upstream  # noqa: E402

TEMP_PREFIXES = ("/tmp/", "/private/tmp/", "/private/var/folders/", "/var/folders/")
BASE_DIR_RE = re.compile(r"Base directory for this skill: \S*/plugins/cache/[^/]+/([^/]+)/([^/]+)/skills/([^/\s]+)")


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--since", required=True, help="ISO timestamp; sessions modified after it")
    p.add_argument("--out", required=True, help="scratch directory for the collector's output")
    p.add_argument("--repo", default=".", help="the skills repo, for which skills it owns")
    p.add_argument("--max", type=int, default=20, help="sessions to sample")
    p.add_argument("--exclude", action="append", default=[], help="session id to skip")
    p.add_argument("--no-agents", action="store_true", help="leave sub-agent sessions out")
    p.add_argument("extra", nargs="*", help="flags passed through to the collector, after --")
    return p.parse_args()


def owned_skills(repo: Path):
    plugin = json.loads((repo / ".claude-plugin" / "plugin.json").read_text())["name"]
    owned = {f"{plugin}:{d.name}" for d in (repo / "skills").iterdir() if (d / "SKILL.md").is_file()}
    local = repo / ".claude" / "skills"
    if local.is_dir():
        owned |= {d.name for d in local.iterdir() if (d / "SKILL.md").is_file()}
    return plugin, owned


def read_claude_session(path: Path):
    """The skills a Claude Code session ran, as the harness names them, and the
    plugin version whose skill files it loaded."""
    skills, version = [], None
    for d in upstream.iter_jsonl_records(path):
        s = d.get("attributionSkill")
        if s and s not in skills:
            skills.append(s)
        content = (d.get("message") or {}).get("content")
        if not isinstance(content, list):
            content = [{"type": "text", "text": content}] if isinstance(content, str) else []
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "tool_use" and block.get("name") == "Skill":
                s = (block.get("input") or {}).get("skill")
                if s and s not in skills:
                    skills.append(s)
            elif block.get("type") == "text" and version is None:
                m = BASE_DIR_RE.search(block.get("text") or "")
                if m:
                    version = {"plugin": m.group(1), "version": m.group(2)}
    return skills, version


def qualify(names, plugin, owned):
    """Name a bare skill the collector detected the way Claude Code would."""
    out = []
    for n in names:
        q = n if ":" in n or n in owned or f"{plugin}:{n}" not in owned else f"{plugin}:{n}"
        if q not in out:
            out.append(q)
    return out


def run_collector(out: Path, days: int, repo: Path, include_agents: bool, extra):
    argv = [
        "collect_sessions.py", "--out", str(out), "--all-conversations", "--include-global-skills",
        "--skills-dir", str(repo / "skills"), "--days", str(days),
        "--max-sessions", "1000000", "--per-skill", "1000000", "--no-skill", "1000000",
    ]
    if include_agents:
        argv.append("--include-subagents")
    saved, sys.argv, stdout = sys.argv, argv + list(extra), sys.stdout
    sys.stdout = sys.stderr  # the collector's progress lines stay off our JSON
    try:
        upstream.main()
    finally:
        sys.argv, sys.stdout = saved, stdout
    return json.loads((out / "inventory.json").read_text())


def sample(rows, limit):
    """Round-robin across skills, newest first, so every skill in use gets read.
    Sub-agent sessions and sessions with no skill are each held a quarter of
    the slots, and fill any the others leave empty."""
    agents = [r for r in rows if r["kind"] == "agent"]
    bare = [r for r in rows if r["kind"] == "session" and not r["skills"]]
    skilled = [r for r in rows if r["kind"] == "session" and r["skills"]]

    def round_robin(pool, budget, picked):
        by_skill = {}
        for r in pool:
            for k in r["skills"] or [""]:
                by_skill.setdefault(k, []).append(r)
        queues = [q for _, q in sorted(by_skill.items(), key=lambda kv: -len(kv[1]))]
        while budget > 0 and any(queues):
            for q in queues:
                while q and q[0]["transcript"] in picked:
                    q.pop(0)
                if q and budget > 0:
                    picked.append(q.pop(0)["transcript"])
                    budget -= 1

    quarter = max(1, limit // 4)
    picked = []
    round_robin(skilled, limit - min(len(agents), quarter) - min(len(bare), quarter), picked)
    round_robin(agents, min(len(agents), quarter), picked)
    round_robin(bare, min(len(bare), quarter), picked)
    for pool in (skilled, agents, bare):
        round_robin(pool, limit - len(picked), picked)
    return picked


def main():
    a = parse_args()
    since = datetime.fromisoformat(a.since.replace("Z", "+00:00"))
    if since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    repo = Path(a.repo).resolve()
    plugin, owned = owned_skills(repo)
    out = Path(a.out).expanduser().resolve() / "upstream"
    days = max(1, math.ceil((now - since).total_seconds() / 86400) + 1)
    inventory = run_collector(out, days, repo, not a.no_agents, a.extra)

    rows, parents = [], {}
    for s in inventory["sessions"]:
        modified = datetime.fromisoformat(s["modified_at"])
        if modified.tzinfo is None:
            modified = modified.replace(tzinfo=timezone.utc)
        cwd = s["meta"].get("cwd") or ""
        sid = str(s["meta"].get("id"))
        is_agent = s["meta"].get("thread_source") == "subagent"
        source = s["file"]
        parent = None
        if s["harness"] == "claude" and is_agent:
            parent = Path(source).parent.parent.name  # <project>/<session>/subagents/<agent>.jsonl
        elif is_agent:
            parent = s["meta"].get("parent_id")
        if modified <= since or cwd.startswith(TEMP_PREFIXES) or sid in a.exclude or (parent and parent in a.exclude):
            continue
        skills, ran = qualify(s["skills_used"], plugin, owned), None
        if s["harness"] == "claude":
            own, ran = read_claude_session(Path(source))
            skills = own + [k for k in skills if k not in own and f"{plugin}:{k}" not in own]
        row = {
            "id": sid,
            "harness": s["harness"],
            "kind": "agent" if is_agent else "session",
            "parent": parent,
            # what the scorer reads: the raw Claude Code transcript, which
            # autopsy's renderer numbers by record, or the collector's
            # condensed transcript for every other source
            "transcript": source if s["harness"] == "claude" else s.get("transcript_path"),
            "source": source,
            "cwd": cwd,
            "modified": modified.isoformat(),
            "skills": skills,
            "ran": ran,
            **{k: s["stats"].get(k) for k in ("user_turns", "tool_calls", "repeated_tool_calls", "error_outputs", "has_code_edits")},
        }
        if not row["transcript"]:
            continue
        rows.append(row)
        if row["kind"] == "session":
            parents[sid] = row

    for r in rows:
        p = parents.get(r["parent"]) if r["kind"] == "agent" else None
        if p:
            r["skills"] = r["skills"] or list(p["skills"])
            r["ran"] = r["ran"] or p["ran"]

    rows.sort(key=lambda r: r["modified"], reverse=True)
    top = [r for r in rows if r["kind"] == "session"]
    used = {k for r in rows for k in r["skills"]}
    json.dump({
        "window": {"since": since.isoformat(), "until": rows[0]["modified"] if rows else since.isoformat()},
        "plugin": plugin,
        "owned": sorted(owned),
        "unused": sorted(owned - used),
        "sources": inventory.get("sources", {}),
        "coverage": round(sum(1 for r in top if r["skills"]) / len(top), 3) if top else 0,
        "sessions": rows,
        "sampled": sample(rows, a.max),
    }, sys.stdout, indent=1)


if __name__ == "__main__":
    main()
