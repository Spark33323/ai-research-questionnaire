#!/bin/bash
# restart.sh — restart the web server (and the public tunnel with --all).
set -u
UID_=$(id -u)
launchctl kickstart -k "gui/${UID_}/local.ai-research-questionnaire" && echo "web server restart requested"
if [ "${1:-}" = "--all" ]; then
  launchctl kickstart -k "gui/${UID_}/local.ai-research-questionnaire-tunnel" && echo "tunnel restart requested"
fi
for i in $(seq 1 40); do
  if curl -sS -m 2 -o /dev/null http://127.0.0.1:8788/health 2>/dev/null; then
    echo "server is up after ${i}s"; curl -sS -m 3 http://127.0.0.1:8788/health; echo; exit 0
  fi
  sleep 1
done
echo "server did not come up within 40s — check data/server.err.log"; exit 1
