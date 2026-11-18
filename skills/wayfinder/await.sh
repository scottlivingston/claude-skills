#!/bin/sh
# Wait for a backgrounded command to finish, for at most nine minutes a call.
#
# Usage: await.sh <output file>
#
# A workflow agent cannot idle until a background command's completion notice:
# its turn ending is its final report. It starts the command in the background
# as `<command>; echo "exit: $?"`, then calls this in the foreground with the
# command's output file, again and again until it prints "finished". Each call
# returns inside the Bash tool's ten-minute limit, so no wait is left running.
set -u

[ $# -eq 1 ] || { echo "usage: await.sh <output file>" >&2; exit 64; }
out=$1
waited=0
while [ "$waited" -lt 540 ]; do
  line=$(grep '^exit: [0-9][0-9]*$' "$out" 2>/dev/null | tail -1)
  if [ -n "$line" ]; then
    tail -n 40 "$out"
    echo "finished: $line"
    exit 0
  fi
  sleep 5
  waited=$((waited + 5))
done
tail -n 40 "$out" 2>/dev/null
echo "still running: call await.sh again"
