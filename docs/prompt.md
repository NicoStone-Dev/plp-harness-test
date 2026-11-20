Implement FR-10 to FR-19 from docs/requirements.md, matching the
screens in docs/design/ (typing.png and unread.png).

Requirements:
- Change both back-end/ and front-end/ as needed.
- FR-01 to FR-08 must keep working.
- Add automated tests for the new behaviour in both back-end/ and front-end/.

When done, write docs/testing.md explaining how the new behaviour is tested:
1. A section per requirement group: Typing indicator (FR-10 to FR-14)
   and Unread counter (FR-15 to FR-19).
2. In each section, one table per side (Back-end, Front-end) with the
   columns: Requirement | Step | Expected. Use one row per step, and name
   the automated test that covers it (or "manual" if none does).
3. A final table with the manual test using 3 browser windows (Ana, Bruno,
   Carla), with the columns: Step | Expected.
4. How to run the tests: the exact commands for each folder.

Finally, write docs/run-log.md with these sections, filled from what you
actually did and actual command output (never estimate):

1. Summary: one table with the columns Metric | Back-end | Front-end:
   files created, files modified, lines added, lines removed (from
   `git diff --stat`), tests added, tests passing, tests failing,
   line coverage % for the new code (`npx vitest run --coverage`;
   front-end: `ng test --watch=false --coverage`).
2. Requirements: Requirement | Implemented (yes/partial/no) |
   Where (file:line) | Covered by test (test name or "none").
3. Tests: Test name | File | Requirement | Type (unit/stream/component/other).
4. Commands: every build, test or lint command you ran, in order, with
   its result (pass/fail) and how many times you ran it.
5. Problems: each error or failed attempt you hit and how you fixed it.
6. Changes to existing code: any file from the base app you modified
   and why.
7. Known gaps: anything not done or not tested.
