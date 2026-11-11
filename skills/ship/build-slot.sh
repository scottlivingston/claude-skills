#!/bin/sh
# Run one build or test command in one of a fixed number of host-wide slots.
#
# Usage: build-slot.sh <slots> <pool> -- <command> [args...]
#
# Every agent of a ship run wraps its heavy commands in this script with the
# same <slots> and <pool>, so at most <slots> of them run at once on the host
# however many agents are working. A caller waits, polling every two seconds,
# until a slot frees. A slot whose holder died (killed agent, closed terminal)
# is reclaimed on the next poll. Exits with the command's status; a TERM or
# INT stops the command as well.
set -u

[ $# -ge 4 ] && [ "$3" = "--" ] || { echo "usage: build-slot.sh <slots> <pool> -- <command> [args...]" >&2; exit 64; }
slots=$1
pool=$(printf '%s' "$2" | tr -c 'A-Za-z0-9._-' '_')
shift 3
case $slots in ''|*[!0-9]*|0) echo "build-slot.sh: <slots> must be a positive integer" >&2; exit 64 ;; esac

# /tmp is shared by every process on the host. Where a sandbox refuses it,
# $TMPDIR is shared by every agent of the session, which is the run.
dir=/tmp/build-slots/$pool
mkdir -p "$dir" 2>/dev/null || { dir=${TMPDIR:-/tmp}/build-slots/$pool; mkdir -p "$dir" || exit 1; }

held=""
child=""
release() { [ -n "$held" ] && rm -rf "$held"; held=""; }
# A signal stops the command too, so a killed caller leaves no build running.
stop() { [ -n "$child" ] && kill "$child" 2>/dev/null; release; exit "$1"; }
trap release EXIT
trap 'stop 130' INT
trap 'stop 143' TERM

waited=0
while [ -z "$held" ]; do
  i=1
  while [ "$i" -le "$slots" ]; do
    s=$dir/$i
    if mkdir "$s" 2>/dev/null; then
      echo $$ > "$s/pid"
      held=$s
      break
    fi
    pid=$(cat "$s/pid" 2>/dev/null)
    # A slot with no live holder is stale. A fresh slot may not have its pid
    # written yet, so only reclaim one whose pid file exists.
    if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
      rm -rf "$s"
      continue
    fi
    i=$((i + 1))
  done
  if [ -z "$held" ]; then
    [ "$waited" -eq 0 ] && echo "build-slot: all $slots slots of '$pool' busy, waiting" >&2
    waited=1
    sleep 2
  fi
done

"$@" &
child=$!
wait "$child"
status=$?
child=""
release
exit $status
