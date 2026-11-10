#!/bin/bash
# keep-awake.sh on|off — stop the Mac from going to sleep while you collect responses.
# Without this, a sleeping Mac makes the shared link fail for respondents.
set -u
UID_=$(id -u)
JOB=local.ai-research-questionnaire-awake
if [ "${1:-}" = "on" ]; then
  launchctl submit -l "$JOB" -- /usr/bin/caffeinate -s -d -i 2>/dev/null \
    && echo "sleep prevention on (until you run ./keep-awake.sh off or reboot)" \
    || echo "could not start (already running?)"
elif [ "${1:-}" = "off" ]; then
  launchctl remove "$JOB" 2>/dev/null && echo "sleep prevention off" || echo "was not running"
else
  echo "usage: ./keep-awake.sh on|off"; launchctl list 2>/dev/null | grep -q "$JOB" && echo "currently: ON" || echo "currently: OFF"
fi
