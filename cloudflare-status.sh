#!/bin/bash
# Show the live Worker, protected results dashboard and response count.
set -u
APP="$(cd "$(dirname "$0")" && pwd)"
cd "$APP"

URL="$(cat data/cloud-worker-url.txt 2>/dev/null || true)"
TOKEN="$(cat data/cloud-admin-token.txt 2>/dev/null || true)"

echo "AI Tool Use for Academic Research — always-on status"
echo "----------------------------------------------------"

if [ -z "$URL" ]; then
  echo "No deployment URL recorded yet. Run ./deploy.sh after ./cloudflare-login.sh."
  exit 1
fi

if HEALTH="$(curl -fsS -m 10 "$URL/health" 2>/dev/null)"; then
  echo "service      online"
  echo "health       $HEALTH"
else
  echo "service      NOT ANSWERING"
  echo "url          $URL"
  exit 1
fi

echo
echo "share this         $URL/"
echo "results dashboard  $URL/results?token=$TOKEN"
echo "CSV export         $URL/api/export.csv?token=$TOKEN"
echo
echo "The laptop may sleep, restart or disconnect; collection runs in Cloudflare."
