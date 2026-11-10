#!/bin/bash
# One-time Cloudflare authorization for deploy.sh and cloudflare-status.sh.
set -euo pipefail
APP="$(cd "$(dirname "$0")" && pwd)"
cd "$APP"

if [ ! -x node_modules/.bin/wrangler ]; then
  npm install
fi

export XDG_CONFIG_HOME="$APP/.wrangler/xdg"
export WRANGLER_WRITE_LOGS=false

echo "Opening Cloudflare authorization in your browser."
echo "Sign in (or create a free account), then approve Wrangler access."
node_modules/.bin/wrangler login
node_modules/.bin/wrangler whoami
