#!/usr/bin/env bash
set -euo pipefail
"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../lib/seed-repo.sh" "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/fixture"
