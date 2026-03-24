#!/usr/bin/env bash
set -euo pipefail

SERVER="devops-api-prod"

usage() {
  cat <<'EOF'
Usage:
  devops-call.sh check
  devops-call.sh list [--schema]
  devops-call.sh call <tool-selector> [key=value ...]

Examples:
  devops-call.sh check
  devops-call.sh list
  devops-call.sh list --schema
  devops-call.sh call devops-api-prod.some_tool id=123

Notes:
  - Requires: mcporter
  - If configuring server with API key header, prefer env var DEVOPS_API_KEY
EOF
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[ERROR] Missing command: $1" >&2
    exit 127
  }
}

need_cmd mcporter

cmd="${1:-}"
if [[ -z "$cmd" ]]; then
  usage
  exit 1
fi
shift || true

case "$cmd" in
  check)
    echo "[INFO] Checking config..."
    mcporter config get "$SERVER" --json

    echo "[INFO] Listing tools..."
    mcporter list "$SERVER"
    ;;

  list)
    if [[ "${1:-}" == "--schema" ]]; then
      mcporter list "$SERVER" --schema
    else
      mcporter list "$SERVER"
    fi
    ;;

  call)
    tool="${1:-}"
    if [[ -z "$tool" ]]; then
      echo "[ERROR] Missing <tool-selector>" >&2
      usage
      exit 1
    fi
    shift || true

    # Remaining args are passed through as key=value pairs.
    mcporter call "$tool" "$@" --output json
    ;;

  -h|--help|help)
    usage
    ;;

  *)
    echo "[ERROR] Unknown command: $cmd" >&2
    usage
    exit 1
    ;;
esac
