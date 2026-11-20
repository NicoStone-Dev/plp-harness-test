#!/usr/bin/env bash
# Runs every check in both folders, reports ALL failures, and ends with
#   ALL CHECKS PASSED   (exit 0)   or   VALIDATION FAILED   (exit 1)
# Done = this script prints ALL CHECKS PASSED.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$(mktemp -d)"
trap 'rm -rf "$LOG_DIR"' EXIT
export CI=1 NG_CLI_ANALYTICS=false FORCE_COLOR=0 NO_COLOR=1

passed=()
failed=()

run() {
  local name="$1" dir="$2"
  shift 2
  local log="$LOG_DIR/${name//[^A-Za-z0-9]/_}.log"
  printf '%-34s' "$name"
  if (cd "$ROOT/$dir" && "$@") >"$log" 2>&1; then
    echo "ok"
    passed+=("$name")
  else
    echo "FAIL"
    failed+=("$name")
    {
      echo
      echo "────── $name  (cd $dir && $*) ──────"
      # Drop npm's banner lines and ANSI codes; keep the tail, which holds the errors.
      sed -e 's/\x1b\[[0-9;]*m//g' "$log" | grep -vE '^> |^$' | tail -n 60
    } >>"$LOG_DIR/failures.txt"
  fi
}

for dir in back-end front-end; do
  if [[ ! -d "$ROOT/$dir/node_modules" ]]; then
    echo "Missing $dir/node_modules. Run: (cd $dir && npm install)"
    echo
    echo "VALIDATION FAILED"
    exit 1
  fi
done

echo "== shared"
run "R2 contract (events.ts identical)" . bash scripts/check-contract.sh
run "R7 time logic has marble tests"    . bash scripts/check-time-logic.sh
run "guards (no disables/skips)"        . bash scripts/check-guards.sh

echo "== back-end"
run "back-end typecheck"                back-end npm run --silent typecheck
run "back-end eslint"                   back-end npm run --silent lint
run "back-end dependency-cruiser"       back-end npm run --silent lint:deps
run "back-end tests (vitest)"           back-end npm run --silent test

echo "== front-end"
run "front-end typecheck"               front-end npm run --silent typecheck
run "front-end eslint"                  front-end npm run --silent lint
run "front-end dependency-cruiser"      front-end npm run --silent lint:deps
run "front-end tests (ng test/vitest)"  front-end npm run --silent test
# Development config: still AOT-compiles templates, but skips font inlining (works offline).
run "front-end build (AOT templates)"   front-end npx ng build --configuration development

echo
if ((${#failed[@]} > 0)); then
  cat "$LOG_DIR/failures.txt"
  echo
  echo "${#failed[@]} check(s) failed: ${failed[*]}"
  echo "VALIDATION FAILED"
  exit 1
fi
echo "${#passed[@]} checks passed."
echo "ALL CHECKS PASSED"
