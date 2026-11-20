#!/usr/bin/env bash
# R7: time logic (debounce, throttle, timers) is a pure function in streams/ with a marble test.
# ESLint already forbids time operators and setTimeout/setInterval outside streams/.
# This script checks the other half: every streams/ file that uses time has a marble test.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIME_RE='\b(debounce|debounceTime|throttle|throttleTime|audit|auditTime|sample|sampleTime|delay|delayWhen|timer|interval|timeout|timeoutWith|bufferTime|windowTime)\b'
status=0

for dir in "$ROOT/back-end/src/streams" "$ROOT/front-end/src/app/streams"; do
  [[ -d "$dir" ]] || continue
  while IFS= read -r -d '' file; do
    # Only files that import a time operator from rxjs (or use JS timers).
    if grep -Pzo "import\s*\{[^}]*${TIME_RE}[^}]*\}\s*from\s*'rxjs'" "$file" >/dev/null 2>&1 \
       || grep -Eq '\b(setTimeout|setInterval)\b' "$file"; then
      spec="${file%.ts}.spec.ts"
      rel="${file#"$ROOT"/}"
      if [[ ! -f "$spec" ]]; then
        echo "R7: $rel uses time operators but has no marble test (${spec#"$ROOT"/} is missing)."
        status=1
      elif ! grep -q 'TestScheduler' "$spec"; then
        echo "R7: ${spec#"$ROOT"/} must test the time logic in $rel with marble tests (TestScheduler)."
        status=1
      fi
      if grep -Eq '\b(setTimeout|setInterval)\b' "$file"; then
        echo "R7: $rel uses setTimeout/setInterval; use an RxJS time operator so it is marble-testable."
        status=1
      fi
    fi
  done < <(find "$dir" -name '*.ts' ! -name '*.spec.ts' -print0)
done

[[ $status -eq 0 ]] && echo "R7: all time logic in streams/ has marble tests."
exit $status
