#!/bin/bash
# start.sh — (re)load the launchd services after ./stop.sh or a reboot.
set -u
LA="$HOME/Library/LaunchAgents"
UID_=$(id -u)
for job in local.ai-research-questionnaire local.ai-research-questionnaire-tunnel local.ai-research-questionnaire-backup; do
  launchctl bootstrap "gui/${UID_}" "$LA/${job}.plist" 2>/dev/null && echo "started ${job}" || echo "${job} already loaded"
done
sleep 3
"$(dirname "$0")/status.sh"
