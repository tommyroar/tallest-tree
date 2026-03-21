#!/usr/bin/env bash
set -euo pipefail

PORT=5180
FOREGROUND=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Start the Vite dev server.

Options:
  -p, --port PORT        Vite port (default: $PORT)
  -f, --foreground       Run Vite in foreground (default: background)
  -k, --kill             Stop running server
  -h, --help             Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case $1 in
    -p|--port)       PORT="$2"; shift 2 ;;
    -f|--foreground) FOREGROUND=true; shift ;;
    -k|--kill)
      echo "Stopping Vite on port $PORT..."
      lsof -ti:"$PORT" | xargs kill 2>/dev/null && echo "Vite stopped." || echo "No Vite process found."
      exit 0
      ;;
    -h|--help)       usage; exit 0 ;;
    *)               echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="/tmp/tallest-tree-vite.log"

# Kill existing Vite on this port
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "Killing existing process on port $PORT..."
  lsof -ti:"$PORT" | xargs kill 2>/dev/null
  sleep 1
fi

if $FOREGROUND; then
  echo "Starting Vite on port $PORT (foreground)..."
  cd "$PROJECT_DIR" && npx vite --host 0.0.0.0 --port "$PORT"
else
  echo "Starting Vite on port $PORT (background)..."
  cd "$PROJECT_DIR" && nohup npx vite --host 0.0.0.0 --port "$PORT" > "$LOG" 2>&1 & disown
  sleep 2

  if ! curl -sk -o /dev/null -w '' "https://localhost:$PORT/" 2>/dev/null; then
    echo "ERROR: Vite failed to start. Check $LOG"
    exit 1
  fi
  echo "Vite running on port $PORT (log: $LOG)"
fi
