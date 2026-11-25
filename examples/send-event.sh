#!/usr/bin/env bash
# Example: Drive NekoPulse from any shell script, CI job, or custom AI agent
# Usage: ./examples/send-event.sh AI_WORKING "Compiling Rust backend..."

STATE="${1:-AI_WORKING}"
LABEL="${2:-Working on your task...}"
URL="${NEKOPULSE_URL:-http://127.0.0.1:47890/event}"

curl -sS --max-time 0.8 -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d "{\"state\":\"${STATE}\",\"label\":\"${LABEL}\",\"source\":\"cli\"}" \
  >/dev/null 2>&1 || true
