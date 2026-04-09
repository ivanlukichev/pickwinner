#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-8080}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

exec python3 -m http.server "$PORT" --directory "$ROOT_DIR/deploy"
