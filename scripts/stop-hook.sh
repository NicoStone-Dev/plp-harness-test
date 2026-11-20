#!/usr/bin/env bash
# Claude Code Stop hook: block finishing while scripts/validate.sh fails.
# Respects stop_hook_active so a session that was already blocked once can stop
# (prevents an infinite loop when a failure cannot be fixed).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
input="$(cat)"

if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

if output="$(bash "$ROOT/scripts/validate.sh" 2>&1)"; then
  exit 0
fi

# Exit code 2 blocks the stop; stderr is shown to Claude as the reason.
{
  echo "scripts/validate.sh did not pass. Fix every failure below (never disable rules or delete tests), then finish."
  echo
  printf '%s\n' "$output" | tail -n 150
} >&2
exit 2
