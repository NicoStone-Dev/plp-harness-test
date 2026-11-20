#!/usr/bin/env bash
# Guards for "never disable rules or delete tests":
#  - no eslint-disable / ts-ignore / ts-nocheck comments in source
#  - no focused or skipped tests (.only / .skip / xit / xdescribe)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
status=0
SRC=("$ROOT/back-end/src" "$ROOT/front-end/src")

if hits=$(grep -rnE 'eslint-disable|@ts-ignore|@ts-nocheck|@ts-expect-error' "${SRC[@]}" 2>/dev/null); then
  echo "Rule suppression comments are not allowed (fix the code instead):"
  echo "${hits//"$ROOT"\//}"
  status=1
fi
if hits=$(grep -rnE '\b(it|test|describe)\.(only|skip|todo)\(|\b(xit|xdescribe|fit|fdescribe)\(' --include='*.spec.ts' "${SRC[@]}" 2>/dev/null); then
  echo "Focused/skipped tests are not allowed:"
  echo "${hits//"$ROOT"\//}"
  status=1
fi
for dir in "$ROOT/back-end/src" "$ROOT/front-end/src/app"; do
  if [[ -z "$(find "$dir" -name '*.spec.ts' -print -quit)" ]]; then
    echo "No tests found under ${dir#"$ROOT"/}."
    status=1
  fi
done
[[ $status -eq 0 ]] && echo "Guards: no suppressions, no skipped tests."
exit $status
