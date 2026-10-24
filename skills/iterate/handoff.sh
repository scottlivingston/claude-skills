#!/usr/bin/env bash
# Hand an effort to a new Claude Code session in its own Herdr workspace:
# open the effort's checkout as a workspace, start Claude in its shell pane,
# and send it `/iterate <slug>`. The checkout must already be a worktree of
# this repo on the effort branch. Prints the workspace's id and label.
# Exit status 3 means not running inside Herdr — the caller keeps the effort
# itself; any other failure leaves whatever workspace it opened in place.
set -euo pipefail

[ $# -eq 2 ] || { echo "usage: handoff.sh <checkout-path> <slug>" >&2; exit 1; }
checkout=$1
slug=$2

[ "${HERDR_ENV:-}" = 1 ] || { echo "handoff: not running inside Herdr" >&2; exit 3; }
command -v jq >/dev/null || { echo "handoff: jq is required" >&2; exit 1; }

branch=$(git -C "$checkout" branch --show-current)
[ -n "$branch" ] || { echo "handoff: $checkout is not on a branch" >&2; exit 1; }
# The main checkout's root: herdr resolves a branch's worktree from the repo it's run in.
root=$(cd "$(git -C "$checkout" rev-parse --path-format=absolute --git-common-dir)/.." && pwd)

# Agent names must match [a-z][a-z0-9_-]{0,31}.
name=$(printf '%s' "$slug" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9_-' '-')
case "$name" in [a-z]*) ;; *) name="e-$name" ;; esac
name=${name:0:32}

opened=$(herdr worktree open --cwd "$root" --branch "$branch" --label "$slug" --no-focus)
workspace=$(jq -r '.result.workspace.workspace_id' <<< "$opened")
if [ "$(jq -r '.result.already_open' <<< "$opened")" = true ]; then
  echo "handoff: $checkout is already open in Herdr workspace $workspace; start the session there by hand" >&2
  exit 1
fi
pane=$(jq -r '.result.root_pane.pane_id' <<< "$opened")

herdr agent start "$name" --kind claude --pane "$pane" --timeout 60000 >/dev/null
herdr agent prompt "$name" "/iterate $slug" >/dev/null

printf 'workspace=%s\tlabel=%s\tagent=%s\n' "$workspace" "$slug" "$name"
