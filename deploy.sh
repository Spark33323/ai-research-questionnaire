#!/bin/bash
# Create/update the always-on Cloudflare Worker and its D1 database.
set -euo pipefail
APP="$(cd "$(dirname "$0")" && pwd)"
cd "$APP"

export XDG_CONFIG_HOME="$APP/.wrangler/xdg"
export WRANGLER_WRITE_LOGS=false

if [ ! -x node_modules/.bin/wrangler ]; then
  npm install
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && ! node_modules/.bin/wrangler whoami 2>/dev/null | grep -q "Account Name"; then
  echo "Cloudflare is not authorized yet. Run ./cloudflare-login.sh first."
  exit 1
fi

DB_JSON="$(node_modules/.bin/wrangler d1 list --json)"
DB_ID="$(
  DB_JSON="$DB_JSON" node -e '
    const list = JSON.parse(process.env.DB_JSON || "[]");
    const found = list.find((item) => item.name === "ai-research-questionnaire");
    if (found) process.stdout.write(found.uuid || found.id || "");
  '
)"

if [ -z "$DB_ID" ]; then
  echo "Creating the Asia-Pacific D1 database…"
  CREATE_OUTPUT="$(node_modules/.bin/wrangler d1 create ai-research-questionnaire --location apac)"
  printf "%s\n" "$CREATE_OUTPUT"
  DB_ID="$(printf "%s\n" "$CREATE_OUTPUT" | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)"
fi

if [ -z "$DB_ID" ]; then
  echo "Could not determine the D1 database id. Check the Cloudflare dashboard."
  exit 1
fi

node bin/set-d1-id.js "$DB_ID"

TOKEN_FILE="data/cloud-admin-token.txt"
if [ ! -s "$TOKEN_FILE" ]; then
  umask 077
  openssl rand -hex 32 > "$TOKEN_FILE"
fi
printf "%s" "$(cat "$TOKEN_FILE")" | node_modules/.bin/wrangler secret put ADMIN_TOKEN

echo "Applying database migrations…"
node_modules/.bin/wrangler d1 migrations apply ai-research-questionnaire --remote

if [ -f data/responses.db ]; then
  PILOT_SQL="$(mktemp "${TMPDIR:-/tmp}/questionnaire-pilot.XXXXXX.sql")"
  trap 'rm -f "$PILOT_SQL"' EXIT
  node bin/export-local-pilot.js "$PILOT_SQL"
  if [ -s "$PILOT_SQL" ]; then
    echo "Importing existing local pilot responses privately…"
    node_modules/.bin/wrangler d1 execute ai-research-questionnaire --remote --file "$PILOT_SQL"
  fi
  rm -f "$PILOT_SQL"
  trap - EXIT
fi

echo "Deploying the questionnaire…"
DEPLOY_OUTPUT="$(node_modules/.bin/wrangler deploy 2>&1)"
printf "%s\n" "$DEPLOY_OUTPUT"

WORKER_URL="$(printf "%s\n" "$DEPLOY_OUTPUT" | grep -Eo 'https://[a-zA-Z0-9.-]+\.workers\.dev' | head -1)"
if [ -n "$WORKER_URL" ]; then
  printf "%s\n" "$WORKER_URL" > data/cloud-worker-url.txt
fi

echo
echo "Always-on deployment configured."
echo "Run ./cloudflare-status.sh for the live link and researcher dashboard."
