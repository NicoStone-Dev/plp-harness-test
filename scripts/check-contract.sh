#!/usr/bin/env bash
# R2: the wire protocol exists twice and both copies must be byte-for-byte identical.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACK="back-end/src/domain/events.ts"
FRONT="front-end/src/app/domain/events.ts"

for f in "$BACK" "$FRONT"; do
  if [[ ! -f "$ROOT/$f" ]]; then
    echo "R2: missing $f"
    exit 1
  fi
done

if ! cmp -s "$ROOT/$BACK" "$ROOT/$FRONT"; then
  echo "R2: $BACK and $FRONT differ. They must be identical (edit both, or copy one over the other):"
  diff -u "$ROOT/$BACK" "$ROOT/$FRONT" || true
  exit 1
fi
echo "R2: events.ts copies are identical."
