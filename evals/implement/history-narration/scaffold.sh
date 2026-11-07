#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$here/../../lib/seed-repo.sh" "$here/fixture"
