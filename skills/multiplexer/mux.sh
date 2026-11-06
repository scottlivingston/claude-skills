#!/usr/bin/env bash
# Drive whichever agent multiplexer this session runs inside, per SKILL.md.
#
#   mux.sh which
#       Prints herdr, rex, or none.
#   mux.sh session <dir> <label> <prompt>
#       Opens <dir> as a new workspace (Herdr) or session (Rex) without taking
#       focus, starts Claude Code there, and gives it <prompt>. Prints
#       mux=<name> TAB id=<workspace or session id> TAB label=<label>.
#   mux.sh pane <dir> <label> <command> [args...]
#       Opens a pane below this one running the command, without taking focus,
#       kept open after it exits. Prints mux=<name> TAB pane=<pane id>.
#
# Exit status 3: no multiplexer — the caller carries on without one. Any other
# failure leaves whatever it opened in place and says what it printed.
set -euo pipefail

die() { echo "mux: $*" >&2; exit 1; }

which_mux() {
  if [ -n "${MUX:-}" ]; then echo "$MUX"; return; fi
  # Herdr runs inside a terminal app, so when both are present Herdr is the inner one.
  if [ "${HERDR_ENV:-}" = 1 ] && [ -n "${HERDR_PANE_ID:-}" ]; then echo herdr; return; fi
  if [ -n "${REX_SESSION:-}" ] && [ -n "${REX_BLOCK:-}" ]; then echo rex; return; fi
  echo none
}

rex_bin() {
  if command -v rex >/dev/null; then command -v rex; return; fi
  for b in /Applications/Rex*.app/Contents/Helpers/Rex\ Server.rex/Contents/MacOS/rex; do
    [ -x "$b" ] && { echo "$b"; return; }
  done
  die "the rex CLI is not on PATH or in /Applications"
}

need_jq() { command -v jq >/dev/null || die "jq is required"; }

herdr_session() {
  local dir=$1 label=$2 prompt=$3 opened workspace pane name branch root common
  # A linked worktree opens through Herdr's worktree helper, so Herdr knows its branch.
  common=$(git -C "$dir" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)
  branch=$(git -C "$dir" branch --show-current 2>/dev/null || true)
  if [ -n "$common" ] && [ -n "$branch" ] && [ "$(git -C "$dir" rev-parse --path-format=absolute --git-dir)" != "$common" ]; then
    root=$(cd "$common/.." && pwd)
    opened=$(herdr worktree open --cwd "$root" --branch "$branch" --label "$label" --no-focus)
    if [ "$(jq -r '.result.already_open' <<< "$opened")" = true ]; then
      die "$dir is already open in Herdr workspace $(jq -r '.result.workspace.workspace_id' <<< "$opened"); start the session there by hand"
    fi
  else
    opened=$(herdr workspace create --cwd "$dir" --label "$label" --no-focus)
  fi
  workspace=$(jq -r '.result.workspace.workspace_id // empty' <<< "$opened")
  pane=$(jq -r '.result.root_pane.pane_id // ([.. | .pane_id? // empty] | first) // empty' <<< "$opened")
  [ -n "$pane" ] || die "Herdr opened no pane: $opened"

  # Agent names must match [a-z][a-z0-9_-]{0,31}.
  name=$(printf '%s' "$label" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9_-' '-')
  case "$name" in [a-z]*) ;; *) name="e-$name" ;; esac
  name=${name:0:32}
  herdr agent start "$name" --kind claude --pane "$pane" --timeout 60000 >/dev/null
  herdr agent prompt "$name" "$prompt" >/dev/null
  printf 'mux=herdr\tid=%s\tlabel=%s\n' "$workspace" "$label"
}

rex_session() {
  local dir=$1 label=$2 prompt=$3 created
  created=$("$(rex_bin)" new "$label" -c "$dir" --window Claude --keep-open --json -- claude "$prompt")
  printf 'mux=rex\tid=%s\tlabel=%s\n' "$(jq -r '.session_id' <<< "$created")" "$label"
}

herdr_pane() {
  local dir=$1 label=$2; shift 2
  local out pane
  out=$(herdr pane split --pane "$HERDR_PANE_ID" --direction down --ratio 0.3 --no-focus --cwd "$dir")
  pane=$(jq -r '.result.pane.pane_id' <<< "$out")
  herdr pane rename "$pane" "$label" >/dev/null 2>&1 || true
  herdr pane run "$pane" "$(printf '%q ' "$@")" >/dev/null
  printf 'mux=herdr\tpane=%s\n' "$pane"
}

rex_pane() {
  local dir=$1 label=$2; shift 2
  local out
  out=$("$(rex_bin)" split -s "$REX_SESSION" -b "$REX_BLOCK" --split=below --ratio 30 --label "$label" \
    --focus=false --keep-open -c "$dir" --json -- "$@")
  printf 'mux=rex\tpane=%s\n' "$(jq -r '.block_ids[0]' <<< "$out")"
}

cmd=${1:-}; shift || true
mux=$(which_mux)
case "$cmd" in
  which) echo "$mux"; exit 0 ;;
  session) [ $# -eq 3 ] || die "usage: mux.sh session <dir> <label> <prompt>" ;;
  pane) [ $# -ge 3 ] || die "usage: mux.sh pane <dir> <label> <command> [args...]" ;;
  *) die "usage: mux.sh which | session <dir> <label> <prompt> | pane <dir> <label> <command...>" ;;
esac
[ "$mux" = none ] && { echo "mux: not running inside Herdr or Rex" >&2; exit 3; }
need_jq
dir=$(cd "$1" && pwd); shift
"${mux}_${cmd}" "$dir" "$@"
