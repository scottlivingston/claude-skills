#!/usr/bin/env bash
# Seed an eval run's working directory with a committed git repo.
# Usage, from a case's scaffold.sh:  "$(dirname "$0")/../../lib/seed-repo.sh" <fixture-dir>
# Copies <fixture-dir>'s contents into the current directory and commits them as
# one "initial" commit, so the agent under test sees a clean tree and `git diff`
# shows exactly what it changed.
set -euo pipefail

src=${1:?usage: seed-repo.sh <fixture-dir>}
[ -d "$src" ] || { echo "seed-repo.sh: no fixture directory at $src" >&2; exit 1; }

cp -R "$src/." .
git init -q
git add -A
git -c user.name=eval -c user.email=eval@example.invalid commit -qm initial
