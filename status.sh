#!/bin/bash
# status.sh — one-glance status of the questionnaire service.
set -u
APP="$(cd "$(dirname "$0")" && pwd)"
cd "$APP" || exit 1

TOKEN="$(cat data/admin-token.txt 2>/dev/null)"
PORT=8788

echo "AI Tool Use for Academic Research — service status"
echo "-------------------------------------------------"

if curl -sS -m 3 "http://127.0.0.1:${PORT}/health" > /tmp/.q_health 2>/dev/null; then
  echo "server      running on port ${PORT}"
  cat /tmp/.q_health; echo
else
  echo "server      DOWN — try: ./restart.sh"
fi

URL="$(grep -Eoh 'https://[a-z0-9-]+\.trycloudflare\.com' data/tunnel.err.log data/tunnel.log 2>/dev/null | tail -1)"
if [ -n "$URL" ]; then
  if curl -sS -m 10 -o /dev/null "$URL/health" 2>/dev/null; then
    echo "public link $URL/   (working)"
  else
    echo "public link $URL/   (tunnel not answering — try: launchctl kickstart -k gui/$(id -u)/local.ai-research-questionnaire-tunnel)"
  fi
else
  echo "public link (none yet — check data/tunnel.err.log)"
fi

echo
echo "share this         ${URL:-http://localhost:${PORT}}/"
echo "results dashboard  http://localhost:${PORT}/results?token=${TOKEN}"
echo "CSV export         http://localhost:${PORT}/api/export.csv?token=${TOKEN}"
echo
echo "responses          ${APP}/data/responses.db"
echo "CSV snapshots      ${APP}/data/backups/  (hourly)"
ls -1t data/backups 2>/dev/null | head -3 | sed 's/^/                   /'
echo
echo "launchd jobs:"
launchctl list 2>/dev/null | grep -i "ai-research-questionnaire" | sed 's/^/  /'
