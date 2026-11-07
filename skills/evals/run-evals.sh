#!/usr/bin/env bash
# Run a plugin's eval cases — the one entry point for evals, so one sandbox
# exception covers every run.
#
# Usage:
#   run-evals.sh [--repo DIR] [--base REF] [--keep] [-- <claude plugin eval flags>]
#
# DIR is the plugin's repo, by default the one holding the current directory.
# Everything after `--` goes to `claude plugin eval` unchanged, e.g.
#   run-evals.sh -- --case history-narration --runs 5 --scaffold --allow-tools Edit Write
# Cases come from evals/ unless --eval-dir is passed through. Replay cases
# (a session.jsonl) get their history.jsonl baked with the plugin's skill text
# before every run.
#
# Without --base: one run against the working tree, with the eval's own output.
#
# With --base REF: an A/B. The same cases run against the plugin at REF (the
# base, in a throwaway worktree) and against the working tree (the candidate),
# in parallel, and the score change per case and per grader is printed. Both
# sides run the working tree's cases, so a case written for this change runs
# against the old text too, and each side's replay histories carry that side's
# skill text. --keep leaves the worktree, both JSON results and both logs behind
# and prints where; a failed A/B always keeps its logs.
#
# Exit status: the eval's own without --base; with it, 0 when both sides
# finished (whatever the scores) and 2 when either was partial or could not start.
set -euo pipefail

base_ref=
repo=.
keep=0
while [ $# -gt 0 ]; do
  case $1 in
    --base) base_ref=${2:?--base needs a ref}; shift 2 ;;
    --repo) repo=${2:?--repo needs a directory}; shift 2 ;;
    --keep) keep=1; shift ;;
    --) shift; break ;;
    *) echo "run-evals.sh: unknown option $1 (eval flags go after --)" >&2; exit 64 ;;
  esac
done

here=$(cd "$(dirname "$0")" && pwd)
root=$(git -C "$repo" rev-parse --show-toplevel)
eval_dir=evals
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  [ "${args[$i]}" = --eval-dir ] && eval_dir=${args[$((i + 1))]}
done
[ -d "$root/$eval_dir" ] || { echo "run-evals.sh: no eval directory at $root/$eval_dir" >&2; exit 1; }

bake() { # <plugin root> <label>
  python3 -I "$here/bake-history.py" "$1" "$1/$eval_dir" | sed "s/^/$2: /" >&2
}

if [ -z "$base_ref" ]; then
  bake "$root" bake
  cd "$root"
  exec claude plugin eval . --trust-plugin --no-publish ${args[@]+"${args[@]}"}
fi

work=$(mktemp -d "${TMPDIR:-/tmp}/run-evals.XXXXXX")
base_tree="$work/base"
failed=0
cleanup() {
  if [ "$keep" = 1 ]; then
    echo "kept: base worktree $base_tree, results and logs in $work" >&2
    return
  fi
  git -C "$root" worktree remove --force "$base_tree" 2>/dev/null || true
  if [ "$failed" = 1 ]; then
    echo "logs kept in $work" >&2
  else
    rm -rf "$work"
  fi
}
trap cleanup EXIT

git -C "$root" worktree add --quiet --detach "$base_tree" "$base_ref"
# Both sides run the candidate's cases; results/ stays out of the copy.
rm -rf "${base_tree:?}/$eval_dir"
mkdir -p "$base_tree/$eval_dir"
(cd "$root/$eval_dir" && tar --exclude=./results -cf - .) | (cd "$base_tree/$eval_dir" && tar -xf -)
bake "$base_tree" base
bake "$root" candidate

run_side() { # <name> <plugin dir>
  local s=0
  (cd "$2" && claude plugin eval . --json "$work/$1.json" --trust-plugin --no-publish \
    --ablation none ${args[@]+"${args[@]}"}) >"$work/$1.log" 2>&1 || s=$?
  echo "$s" >"$work/$1.status"
}

base_sha=$(git -C "$base_tree" rev-parse --short HEAD)
echo "base: $base_ref ($base_sha)   candidate: working tree of $root" >&2
echo "running both sides in parallel; logs in $work/{base,candidate}.log" >&2
run_side base "$base_tree" &
run_side candidate "$root" &
wait

status=0
for side in base candidate; do
  s=$(cat "$work/$side.status")
  # 0 pass, 1 below threshold (still a full result); anything else is not a result
  if [ "$s" != 0 ] && [ "$s" != 1 ] || [ ! -s "$work/$side.json" ]; then
    echo "run-evals.sh: the $side run did not finish (exit $s). Its log:" >&2
    tail -20 "$work/$side.log" >&2
    status=2
  fi
done
[ "$status" = 0 ] || { failed=1; exit "$status"; }

python3 -I "$here/compare-report.py" "$work/base.json" "$work/candidate.json"
