#!/usr/bin/env bash
# mise-tasks/lint.d/lints-config.sh — `mise run lint:lints-config`.
#
# A crate can inherit `[workspace.lints]` only from its own workspace, so every
# other workspace root outside vendor/ carries a copy of the root
# Cargo.toml's `[workspace.lints.*]` tables. This fails when a copy differs.
# Workspace roots are discovered, not listed, so a new one is checked too.
#
# Usage: lints-config.sh [ROOT_DIR]   (default: the repo root)
set -u

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="${1:-$(cd "$here/../.." && pwd)}"
root="${root%/}"

# The [workspace.lints.*] tables of a manifest, in order.
lint_tables() {
  awk '/^\[/ { on = ($0 ~ /^\[workspace\.lints(\.[a-z]+)?\]/) } on && NF' "$1"
}

if [ ! -f "$root/Cargo.toml" ] || [ -z "$(lint_tables "$root/Cargo.toml")" ]; then
  echo "lints-config: $root/Cargo.toml has no [workspace.lints] tables" >&2
  exit 1
fi

# shellcheck source=walk.sh
. "$here/walk.sh"

want="$(lint_tables "$root/Cargo.toml")"
bad=0
while IFS= read -r f; do
  [ "$f" = "$root/Cargo.toml" ] && continue
  grep -q '^\[workspace\]' "$f" || continue
  if [ "$(lint_tables "$f")" != "$want" ]; then
    echo "lints-config: ${f#"$root"/} [workspace.lints] differs from the root Cargo.toml" >&2
    echo "  copy the root's [workspace.lints.*] tables verbatim" >&2
    bad=1
  fi
done < <(walk -name Cargo.toml -type f -print | sort)

[ "$bad" -eq 0 ] && echo "lints-config: every workspace's [workspace.lints] matches the root"
exit "$bad"
