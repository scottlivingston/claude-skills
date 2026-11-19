#!/usr/bin/env bash
# mise-tasks/lint.d/clippy-config.sh — `mise run lint:clippy-config`.
#
# Clippy reads only the nearest clippy.toml and never merges, so each scoped
# clippy.toml is the root file's bytes plus its own ban blocks. This fails when
# a scoped file does not start with the root file verbatim. Scoped files are
# discovered, not listed, so a new one is checked automatically. A repo with no
# root clippy.toml has nothing to drift from and passes.
#
# Usage: clippy-config.sh [ROOT_DIR]   (default: the repo root)
set -u

root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
rootfile="$root/clippy.toml"

if [ ! -f "$rootfile" ]; then
  echo "clippy-config: no root clippy.toml, nothing to check"
  exit 0
fi

size="$(wc -c <"$rootfile" | tr -d ' ')"
bad=0
while IFS= read -r f; do
  [ "$f" = "$rootfile" ] && continue
  if ! head -c "$size" "$f" | cmp -s - "$rootfile"; then
    echo "clippy-config: ${f#"$root"/} drifted from the root clippy.toml" >&2
    echo "  starts with the root clippy.toml verbatim; add scoped bans after it as [[...]] blocks" >&2
    bad=1
  fi
done < <(find "$root" \( -name vendor -o -name target -o -name archived -o -name node_modules -o -name .git -o -name .claude \) -prune -o \
  \( -name clippy.toml -o -name .clippy.toml \) -type f -print | sort)

[ "$bad" -eq 0 ] && echo "clippy-config: scoped clippy.toml files match the root"
exit "$bad"
