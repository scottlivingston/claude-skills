#!/usr/bin/env bash
# mise-tasks/lint.d/layout.sh — `mise run lint:layout`.
#
# Module layout and integration-test headers, as four checks:
#   A. a mod.rs that is the only .rs file in its directory (at any depth) is
#      that module's file: make it <dir>.rs.
#   B. a module root — every lib.rs and mod.rs, and every foo.rs with a .rs
#      file directly in the foo/ beside it — holds only `mod` declarations,
#      `pub use` re-exports and its `//!` header (rule: module-root.yml, run by
#      ast-grep).
#   C. each tests/*.rs directly under a directory holding a Cargo.toml opens
#      with a `//!` header. What the header says stays a review call.
#   D. no catch-all types.rs anywhere.
# A crate's tests/common/mod.rs is exempt from A and B (it is a helper module
# of the test crate, not a module root). The directories walk.sh prunes are
# not walked.
#
# Usage: layout.sh [ROOT_DIR]   (default: the repo root)
set -u

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="${1:-$(cd "$here/../.." && pwd)}"
root="${root%/}"

if ! command -v ast-grep >/dev/null 2>&1; then
  echo "layout: ast-grep is not on PATH; check B (module roots) needs it" >&2
  exit 1
fi

bad=0
finding() {
  echo "layout: $1" >&2
  echo "  $2" >&2
  bad=$((bad + 1))
}

# shellcheck source=walk.sh
. "$here/walk.sh"

rel() { printf '%s' "${1#"$root"/}"; }

# A crate's tests/common/mod.rs: tests/ whose parent holds a Cargo.toml.
exempt() {
  case "$1" in
    */tests/common/mod.rs) [ -f "$(dirname "$(dirname "$(dirname "$1")")")/Cargo.toml" ] ;;
    *) return 1 ;;
  esac
}

roots=()

# A, and the mod.rs half of B.
while IFS= read -r f; do
  exempt "$f" && continue
  d="$(dirname "$f")"
  if [ -z "$(find "$d" -name '*.rs' ! -path "$f" -print -quit)" ]; then
    finding "$(rel "$f") is the only .rs file in its directory" "make it $(rel "$d").rs"
    continue
  fi
  roots+=("$f")
done < <(walk -name mod.rs -type f -print | sort)

# The foo.rs half of B: a sibling foo/ that directly holds a .rs file.
while IFS= read -r f; do
  d="${f%.rs}"
  [ -d "$d" ] || continue
  [ -n "$(find "$d" -maxdepth 1 -name '*.rs' -print -quit)" ] || continue
  roots+=("$f")
done < <(walk -name '*.rs' ! -name mod.rs ! -name lib.rs ! -name main.rs -type f -print | sort)

# The lib.rs half of B: every crate root of a library.
while IFS= read -r f; do
  roots+=("$f")
done < <(walk -name lib.rs -type f -print | sort)

if [ "${#roots[@]}" -gt 0 ]; then
  if ! out="$(ast-grep scan --rule "$here/module-root.yml" --color never --report-style short "${roots[@]}" 2>&1)"; then
    # short style: <path>:<line>:<col>: error[<id>]: <message>
    hits="$(printf '%s\n' "$out" | grep -E ':[0-9]+:[0-9]+: ' || true)"
    if [ -n "$hits" ]; then
      printf '%s\n' "$hits" | sed "s|^$root/|layout: |" >&2
      bad=$((bad + $(printf '%s\n' "$hits" | wc -l)))
    else
      printf 'layout: ast-grep failed:\n%s\n' "$out" >&2
      bad=$((bad + 1))
    fi
  fi
fi

# C.
while IFS= read -r f; do
  [ -f "$(dirname "$(dirname "$f")")/Cargo.toml" ] || continue
  case "$(head -n 1 "$f")" in
    '//!'*) ;;
    *) finding "$(rel "$f") has no //! header" "open the integration test with //! naming what it covers and what is stubbed" ;;
  esac
done < <(walk -path '*/tests/*.rs' -type f -print | sort)

# D.
while IFS= read -r f; do
  finding "$(rel "$f") is a catchall types.rs" "name the module for what it holds"
done < <(walk -name types.rs -type f -print | sort)

if [ "$bad" -ne 0 ]; then
  echo "layout: $bad finding(s)" >&2
  exit 1
fi
echo "layout: module roots, single-file mod.rs, test headers and types.rs are clean"
