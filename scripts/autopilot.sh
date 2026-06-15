#!/usr/bin/env bash
# Treats autopilot — keep Claude Code improving this project autonomously.
#
#   bash scripts/autopilot.sh [hours]     # default 6
#
# Each iteration runs one headless Claude Code session that picks a task from
# docs/BACKLOG.md, implements it, verifies (node --check + npm run demo) and
# commits it (never pushes). Safe to Ctrl-C any time; progress is in git.
set -uo pipefail

HOURS="${1:-6}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG="/tmp/treats-autopilot.log"
END=$(( $(date +%s) + HOURS * 3600 ))

command -v claude >/dev/null 2>&1 || { echo "claude CLI not found on PATH."; exit 1; }

echo "🤖 Treats autopilot: working for ${HOURS}h. Log: $LOG"
echo "   Stop any time with Ctrl-C. Review work with: git -C \"$ROOT\" log --oneline"
: > "$LOG"

i=0
while [ "$(date +%s)" -lt "$END" ]; do
  i=$((i + 1))
  remain=$(( (END - $(date +%s)) / 60 ))
  printf '\n=== iteration %s · %sm left · %s ===\n' "$i" "$remain" "$(date '+%H:%M:%S')" | tee -a "$LOG"

  claude -p "$(cat "$ROOT/scripts/autopilot-prompt.md")" \
    --dangerously-skip-permissions >> "$LOG" 2>&1 \
    || echo "   (iteration $i exited non-zero — continuing)" | tee -a "$LOG"

  git -C "$ROOT" log --oneline -1 2>/dev/null | sed 's/^/   last commit: /' | tee -a "$LOG"
  sleep 10
done

echo "✅ Autopilot finished after ${HOURS}h."
echo "   Commits this run:"
git -C "$ROOT" log --oneline --since="${HOURS} hours ago" | sed 's/^/     /'
echo "   Nothing was pushed. Review, then 'git push' what you like."
