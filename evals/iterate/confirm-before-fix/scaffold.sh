#!/usr/bin/env bash
# Seeds the repo on `main` and points the effort's Checkout: line at it, so the
# effort runs in this checkout and the session goes straight to Choose.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$here/../../lib/seed-repo.sh" "$here/fixture"
git branch -m main
index=docs/efforts/cleanup/index.md
awk -v co="Checkout: \`$PWD\`" '{ print } /^Branch: / { print ""; print co }' "$index" > "$index.tmp"
mv "$index.tmp" "$index"
git -c user.name=eval -c user.email=eval@example.invalid commit -qam "effort checkout"
