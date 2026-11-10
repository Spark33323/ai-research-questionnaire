#!/bin/bash
# stop.sh — stop collecting responses (services stay installed, data is untouched).
set -u
UID_=$(id -u)
for job in local.ai-research-questionnaire local.ai-research-questionnaire-tunnel local.ai-research-questionnaire-backup; do
  launchctl bootout "gui/${UID_}/${job}" 2>/dev/null && echo "stopped ${job}" || echo "${job} was not running"
done
