#!/bin/bash
# Keep Wrangler's config, auth and logs inside the project's ignored .wrangler folder.
set -euo pipefail
APP="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP"
export XDG_CONFIG_HOME="$APP/.wrangler/xdg"
export WRANGLER_WRITE_LOGS=false
exec node_modules/.bin/wrangler "$@"
