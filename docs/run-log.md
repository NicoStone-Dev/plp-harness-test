# Run log – FR-10 to FR-19 (typing indicator, unread counter)

All numbers below come from command output in this run (2026-11-22), not estimates.

## 1. Summary

| Metric | Back-end | Front-end |
| --- | --- | --- |
| Files created | 2 | 6 |
| Files modified | 5 | 10 |
| Lines added (`git diff --stat`) | 185 | 862 |
| Lines removed (`git diff --stat`) | 8 | 29 |
| Tests added | 15 (33 → 48) | 47 (45 → 92) |
| Tests passing | 48 | 92 |
| Tests failing | 0 | 0 |
| Line coverage % for the new code | 100% (16/16 added coverable lines) | 100% (92/92 added coverable lines) |

How the numbers were obtained:

- Files and lines: `git diff --stat HEAD -- <folder>`, with new files included through a temporary
  index (`GIT_INDEX_FILE=<copy> git add -N`), so the real index was not touched.
  Back-end: `7 files changed, 185 insertions(+), 8 deletions(-)`.
  Front-end: `16 files changed, 862 insertions(+), 29 deletions(-)`.
- Tests: `Tests 33 passed` / `45 passed` before any change, `48 passed` / `92 passed` after.
- Coverage of the new code: lines added by the diff (whole file for new files, spec files excluded),
  matched against the statement map in `coverage-final.json`.
  Whole-folder line coverage for context: back-end 96.62% (`npx vitest run --coverage`;
  the gaps are in the base `socket.ts` lines 26-31 and `events.ts` line 90), front-end 100% lines,
  97.03% branches (`ng test --watch=false --coverage`).
  Per new/changed file (lines): back-end `typing.ts` 100, `chat-room.ts` 100, `events.ts` 97.77 (whole file);
  front-end every file 100% lines; `chat-room.html` has one uncovered branch (line 43, the `?? []` fallback).

## 2. Requirements

| Requirement | Implemented | Where (file:line) | Covered by test |
| --- | --- | --- | --- |
| FR-10 | yes | `front-end/src/app/streams/typing.ts:27` (`typingPings$`), `front-end/src/app/streams/chat-session.ts:97` (sends `{type:'typing'}`), `front-end/src/app/chat/chat-room/chat-room.html:54` + `chat-room.ts:72` (input event), `back-end/src/streams/typing.ts:11` + `back-end/src/streams/chat-room.ts:90` (server throttle per user), `back-end/src/domain/events.ts:62` (parse) | `typingPings$ (FR-10) › sends the first keystroke at once, then at most one per 500 ms`; `chatSession › keystroke() sends at most one typing ping per 500 ms (FR-10)`; `ChatRoom › typing indicator › sends one typing event for a burst of keystrokes (FR-10)`; `throttleTyping (FR-10) › lets one ping through per 500 ms`; `chatRoom › typing indicator › relays at most one typing event per 500 ms per user (FR-10)` |
| FR-11 | yes | `back-end/src/streams/chat-room.ts:38` (relay), `back-end/src/domain/events.ts:84` (parse), `front-end/src/app/streams/typing.ts:45` (`typingUsers$`), `front-end/src/app/domain/indicator-text.ts:11` (wording), `front-end/src/app/chat/chat-room/chat-room.html:44` (strip) | `chatRoom › typing indicator › relays typing to the other clients, never back to the typist (FR-11, FR-13)`; `typingLabel (FR-11) › formats one, two and three names`; `ChatRoom › typing indicator › shows who is typing, in the design wording (FR-11)` |
| FR-12 | yes | `front-end/src/app/streams/typing.ts:45` (2 s timer per user), `front-end/src/app/streams/chat-session.ts:60` (message ⇒ stop) | `typingUsers$ › starts empty, shows a name, and removes it 2 s after the last keystroke`; `typingUsers$ › restarts the 2 s timer …`; `typingUsers$ › removes a name immediately when that user sends a message (FR-12)`; `ChatRoom › typing indicator › removes a name as soon as that user sends a message (FR-12)` |
| FR-13 | yes | `back-end/src/streams/chat-room.ts:41` (not echoed to the typist), `front-end/src/app/streams/chat-session.ts:57` (own id filtered) | `chatRoom › typing indicator › relays typing to the other clients, never back to the typist (FR-11, FR-13)`; `typingSignals$ (FR-12, FR-13) › waits for the join ack, drops own typing, and turns messages into stops`; `ChatRoom › typing indicator › never shows the own name (FR-13)` |
| FR-14 | yes | `front-end/src/app/chat/chat-room/chat-room.html:44` (strip always rendered), `front-end/src/app/chat/chat-room/chat-room.css:103` (`height: 32px`) | `ChatRoom › typing indicator › keeps the strip in the layout while empty (FR-14)`; `ChatRoom › keeps the reserved indicator strip` (constant height itself: manual) |
| FR-15 | yes | `front-end/src/app/streams/unread.ts:22`, wired in `front-end/src/app/chat/chat-room/chat-room.ts:60` | `unreadCount$ › counts others' messages while scrolled up (FR-15)`; `unreadCount$ › does not count when the user is at the bottom (FR-15)`; `ChatRoom › unread counter › does not count when the user is at the bottom (FR-15)` |
| FR-16 | yes | `front-end/src/app/domain/indicator-text.ts:30` (text), `front-end/src/app/chat/chat-room/chat-room.html:30` (pill, hidden at 0) | `unreadLabel (FR-16) › uses singular for 1 and plural otherwise`; `ChatRoom › unread counter › is hidden at 0 (FR-16)`; `ChatRoom › unread counter › counts others' messages while scrolled up, with singular/plural text (FR-15, FR-16)` |
| FR-17 | yes | `front-end/src/app/chat/chat-room/chat-room.ts:81` (`jumpToBottom`), `front-end/src/app/streams/scroll.ts:16` (smooth scroll) | `unreadCount$ › resets to 0 when the pill is clicked (FR-17)`; `scrollToBottomSmoothly (FR-17) › asks for a smooth scroll to the end`; `ChatRoom › unread counter › clicking the pill scrolls smoothly to the bottom and resets the counter (FR-17)` |
| FR-18 | yes | `front-end/src/app/streams/unread.ts:25`, `front-end/src/app/chat/chat-room/chat-room.html:12` (`(scroll)`) | `unreadCount$ › resets to 0 when scrolling reaches the bottom, not on other scrolls (FR-18)`; `ChatRoom › unread counter › scrolling to the bottom resets the counter; scrolling elsewhere does not (FR-18)` |
| FR-19 | yes | `front-end/src/app/streams/unread.ts:22` (`!message.own`) | `unreadCount$ › never counts own messages (FR-19)`; `ChatRoom › unread counter › never counts own messages (FR-19)` |

FR-01 to FR-08: all original tests still pass (see section 6 for the two assertions that were narrowed).

## 3. Tests

New tests only (62). Paths: back-end tests are under `back-end/src/`, front-end tests under `front-end/src/app/`.

| Test name | File | Requirement | Type |
| --- | --- | --- | --- |
| typing events › parses a client typing ping, ignoring extra fields | back-end `domain/events.spec.ts` | FR-10 | unit |
| typing events › parses a server typing event | back-end `domain/events.spec.ts` | FR-11 | unit |
| typing events › returns null for server typing without userId (R8) | back-end `domain/events.spec.ts` | FR-11, R8 | unit |
| typing events › returns null for server typing without name (R8) | back-end `domain/events.spec.ts` | FR-11, R8 | unit |
| typing events › returns null for server typing with non-string name (R8) | back-end `domain/events.spec.ts` | FR-11, R8 | unit |
| typing events › returns null for client typing as array (R8) | back-end `domain/events.spec.ts` | FR-10, R8 | unit |
| typing events › returns null for client TYPING in caps (R8) | back-end `domain/events.spec.ts` | FR-10, R8 | unit |
| clientEvent$ typing frames (R8, FR-10) › passes typing pings and drops malformed ones | back-end `streams/socket.spec.ts` | FR-10, R8 | other (socket adapter) |
| throttleTyping (FR-10) › uses a 500 ms window | back-end `streams/typing.spec.ts` | FR-10 | unit |
| throttleTyping (FR-10) › lets one ping through per 500 ms | back-end `streams/typing.spec.ts` | FR-10 | stream |
| throttleTyping (FR-10) › passes isolated pings unchanged | back-end `streams/typing.spec.ts` | FR-10 | stream |
| chatRoom › typing indicator › relays typing to the other clients, never back to the typist (FR-11, FR-13) | back-end `streams/chat-room.spec.ts` | FR-11, FR-13 | stream |
| chatRoom › typing indicator › relays at most one typing event per 500 ms per user (FR-10) | back-end `streams/chat-room.spec.ts` | FR-10 | stream |
| chatRoom › typing indicator › ignores typing before join | back-end `streams/chat-room.spec.ts` | FR-11 | stream |
| chatRoom › typing indicator › keeps typing and messages in server order | back-end `streams/chat-room.spec.ts` | FR-12 | stream |
| typing events › (same 7 tests as the back-end copy) | front-end `domain/events.spec.ts` | FR-10, FR-11, R8 | unit |
| typingLabel (FR-11) › is empty when nobody is typing | front-end `domain/indicator-text.spec.ts` | FR-11, FR-14 | unit |
| typingLabel (FR-11) › formats one, two and three names | front-end `domain/indicator-text.spec.ts` | FR-11 | unit |
| typingLabel (FR-11) › keeps going for more names | front-end `domain/indicator-text.spec.ts` | FR-11 | unit |
| typingLabel (FR-11) › marks only the names as strong | front-end `domain/indicator-text.spec.ts` | FR-11 | unit |
| unreadLabel (FR-16) › is empty at 0 (pill hidden) | front-end `domain/indicator-text.spec.ts` | FR-16 | unit |
| unreadLabel (FR-16) › uses singular for 1 and plural otherwise | front-end `domain/indicator-text.spec.ts` | FR-16 | unit |
| typingPings$ (FR-10) › uses a 500 ms window | front-end `streams/typing.spec.ts` | FR-10 | unit |
| typingPings$ (FR-10) › sends the first keystroke at once, then at most one per 500 ms | front-end `streams/typing.spec.ts` | FR-10 | stream |
| typingPings$ (FR-10) › a steady stream of keystrokes (every 100 ms) sends one ping per 500 ms | front-end `streams/typing.spec.ts` | FR-10 | stream |
| typingUsers$ (FR-11, FR-12) › uses a 2 s expiry | front-end `streams/typing.spec.ts` | FR-12 | unit |
| typingUsers$ (FR-11, FR-12) › starts empty, shows a name, and removes it 2 s after the last keystroke | front-end `streams/typing.spec.ts` | FR-11, FR-12 | stream |
| typingUsers$ (FR-11, FR-12) › restarts the 2 s timer on every new typing event from that user | front-end `streams/typing.spec.ts` | FR-12 | stream |
| typingUsers$ (FR-11, FR-12) › removes a name immediately when that user sends a message (FR-12) | front-end `streams/typing.spec.ts` | FR-12 | stream |
| typingUsers$ (FR-11, FR-12) › keeps several users in the order they started, each with its own timer | front-end `streams/typing.spec.ts` | FR-11, FR-12 | stream |
| typingUsers$ (FR-11, FR-12) › one user's message does not clear another user's name | front-end `streams/typing.spec.ts` | FR-12 | stream |
| typingUsers$ (FR-11, FR-12) › ignores a stop for someone who was not typing | front-end `streams/typing.spec.ts` | FR-12 | stream |
| typingUsers$ (FR-11, FR-12) › can be shown again after expiring | front-end `streams/typing.spec.ts` | FR-12 | stream |
| unreadCount$ › counts others' messages while scrolled up (FR-15) | front-end `streams/unread.spec.ts` | FR-15 | stream |
| unreadCount$ › does not count when the user is at the bottom (FR-15) | front-end `streams/unread.spec.ts` | FR-15 | stream |
| unreadCount$ › never counts own messages (FR-19) | front-end `streams/unread.spec.ts` | FR-19 | stream |
| unreadCount$ › resets to 0 when the pill is clicked (FR-17) | front-end `streams/unread.spec.ts` | FR-17 | stream |
| unreadCount$ › resets to 0 when scrolling reaches the bottom, not on other scrolls (FR-18) | front-end `streams/unread.spec.ts` | FR-18 | stream |
| unreadCount$ › does not emit on resets while already at 0 (pill stays hidden, FR-16) | front-end `streams/unread.spec.ts` | FR-16 | stream |
| scrollToBottomSmoothly (FR-17) › asks for a smooth scroll to the end | front-end `streams/scroll.spec.ts` | FR-17 | unit |
| scrollToBottomSmoothly (FR-17) › falls back to a jump when scrollTo is not available | front-end `streams/scroll.spec.ts` | FR-17 | unit |
| typingSignals$ (FR-12, FR-13) › waits for the join ack, drops own typing, and turns messages into stops | front-end `streams/chat-session.spec.ts` | FR-12, FR-13 | stream |
| chatSession › typing$ shows other users typing and clears them on their message or after 2 s (FR-11 to FR-13) | front-end `streams/chat-session.spec.ts` | FR-11, FR-12, FR-13 | stream |
| chatSession › keystroke() sends at most one typing ping per 500 ms (FR-10) | front-end `streams/chat-session.spec.ts` | FR-10 | stream |
| ChatRoom › typing indicator › sends one typing event for a burst of keystrokes (FR-10) | front-end `chat/chat-room/chat-room.spec.ts` | FR-10 | component |
| ChatRoom › typing indicator › does not send typing when the input is cleared after sending (FR-10) | front-end `chat/chat-room/chat-room.spec.ts` | FR-10 | component |
| ChatRoom › typing indicator › shows who is typing, in the design wording (FR-11) | front-end `chat/chat-room/chat-room.spec.ts` | FR-11 | component |
| ChatRoom › typing indicator › removes a name as soon as that user sends a message (FR-12) | front-end `chat/chat-room/chat-room.spec.ts` | FR-12 | component |
| ChatRoom › typing indicator › never shows the own name (FR-13) | front-end `chat/chat-room/chat-room.spec.ts` | FR-13 | component |
| ChatRoom › typing indicator › keeps the strip in the layout while empty (FR-14) | front-end `chat/chat-room/chat-room.spec.ts` | FR-14 | component |
| ChatRoom › unread counter › is hidden at 0 (FR-16) | front-end `chat/chat-room/chat-room.spec.ts` | FR-16 | component |
| ChatRoom › unread counter › counts others' messages while scrolled up, with singular/plural text (FR-15, FR-16) | front-end `chat/chat-room/chat-room.spec.ts` | FR-15, FR-16 | component |
| ChatRoom › unread counter › does not count when the user is at the bottom (FR-15) | front-end `chat/chat-room/chat-room.spec.ts` | FR-15 | component |
| ChatRoom › unread counter › never counts own messages (FR-19) | front-end `chat/chat-room/chat-room.spec.ts` | FR-19 | component |
| ChatRoom › unread counter › clicking the pill scrolls smoothly to the bottom and resets the counter (FR-17) | front-end `chat/chat-room/chat-room.spec.ts` | FR-17 | component |
| ChatRoom › unread counter › scrolling to the bottom resets the counter; scrolling elsewhere does not (FR-18) | front-end `chat/chat-room/chat-room.spec.ts` | FR-18 | component |

Count check: back-end 15 rows; front-end 7 (events, one row above) + 6 + 11 + 6 + 2 + 3 + 12 = 47.

## 4. Commands

In order. "Times" counts identical commands run back to back at that point.

| # | Command | Result | Times |
| --- | --- | --- | --- |
| 1 | `bash scripts/validate.sh` (baseline) | fail — `Missing back-end/node_modules` | 1 |
| 2 | `cd back-end && npm ci` | pass | 1 |
| 3 | `cd front-end && npm ci` | pass | 1 |
| 4 | `bash scripts/validate.sh` (baseline) | pass — 12 checks, ALL CHECKS PASSED | 1 |
| 5 | `cd back-end && npx vitest run` (baseline count) | pass — 33 tests | 1 |
| 6 | `cd front-end && npx ng test --watch=false` (baseline count) | pass — 45 tests | 1 |
| 7 | `cd back-end && npx vitest run` | fail — 4 failed / 43 passed | 1 |
| 8 | `cd back-end && npx vitest run` (after fixing the marbles) | pass — 47 tests | 1 |
| 9 | `cd back-end && npx vitest run` (after the socket test) | pass — 48 tests | 1 |
| 10 | `cd back-end && npm run typecheck` | pass | 1 |
| 11 | `cd back-end && npm run lint` | pass | 1 |
| 12 | `cd back-end && npm run lint:deps` | pass — no dependency violations | 1 |
| 13 | `cd front-end && npx ng test --watch=false` (streams + domain) | pass — 80 tests | 1 |
| 14 | `cd front-end && npx ng test --watch=false` (with component tests) | pass — 92 tests | 1 |
| 15 | `bash scripts/validate.sh` | pass — ALL CHECKS PASSED | 1 |
| 16 | `cd back-end && PORT=3123 npx tsx src/server.ts` + `node smoke.mjs` (3 real `ws` clients) | pass — see note below | 1 |
| 17 | `cd back-end && npm i --no-save @vitest/coverage-v8@5.1.1` | pass | 1 |
| 18 | `cd front-end && npm i --no-save @vitest/coverage-v8@5.1.0` | pass | 1 |
| 19 | `cd back-end && npx vitest run --coverage` (text, then json-summary/json reporters) | pass — 48 tests, 96.62% lines | 2 |
| 20 | `cd front-end && npx ng test --watch=false --coverage` | pass — 92 tests, 100% lines | 1 |
| 21 | `cd back-end && npx vitest run --reporter=verbose` (test list) | pass | 1 |
| 22 | `cd front-end && npx ng test --watch=false --reporters=verbose` (test list) | pass | 1 |
| 23 | `bash scripts/validate.sh` (final) | pass — 12 checks, ALL CHECKS PASSED | 1 |

Totals: `validate.sh` 4 runs (1 fail, 3 pass); back-end `vitest run` 7 runs including coverage and verbose (1 fail);
front-end `ng test` 5 runs including coverage and verbose (0 fail). Both test suites also ran inside each of the
3 `validate.sh` runs that got past the `node_modules` check. Front-end typecheck, lint, dependency-cruiser
and `ng build --configuration development` were run only as part of `validate.sh` (pass each time after step 1).

Smoke test (step 16) output, real server: Ana, Bruno and Carla joined; Ana sent 5 typing pings in 250 ms,
`garbage`, a forged typing frame, another ping 650 ms later, then a message:

```
Ana joined msg:Ana
Bruno joined typing:Ana typing:Ana msg:Ana
Carla joined typing:Ana typing:Ana msg:Ana
```

## 5. Problems

| Problem | Fix |
| --- | --- |
| `validate.sh` failed at the start: `Missing back-end/node_modules`. | `npm ci` in both folders. |
| Back-end test: `throttleTyping` marble expected a ping at exactly 500 ms to pass; RxJS `throttleTime` keeps the window open at the 500 ms boundary, so it was dropped (the actual result had the 700 ms ping instead). | Changed the marble so the boundary ping (500 ms) is expected to be dropped and the next one is at 501 ms. Behaviour is still "at most once per 500 ms". |
| 3 back-end `chatRoom` typing tests got no output at all: `hot()` values at frame 0 were emitted before `chatRoom` subscribed at frame 0, so the joins were missed. | Shifted the hot marbles one frame (`-a…`), as the existing tests already do. |
| Two front-end marble frame counts (`typing.spec.ts`) were wrong when written (boundary at 499 ms instead of 500, expiry at 2000 instead of 2002). | Caught while re-checking the arithmetic before the first run; corrected, then the tests passed on the first run. |
| Template text `@else {{{ part.text }}}}` mixes block braces with interpolation braces and is ambiguous for the Angular parser. | Rewrote it as `@else {<span>{{ part.text }}</span>}` before building. |
| The existing FR-02 component tests compare the whole `sent` list; with FR-10, typing in the box also sends `{type:'typing'}`, so they would no longer match. | Narrowed those two assertions to `message` events (see section 6). |
| `@vitest/coverage-v8` was not installed, so `--coverage` cannot run. | Installed it with `--no-save`, pinned to each folder's vitest version (5.1.1 / 5.1.0), so `package.json` and the lock files are unchanged. |
| The vitest `text` coverage reporter hides files at 100%, so the new files were not listed. | Re-ran with `json-summary`/`json` reporters and computed per-file and added-line coverage. |
| Smoke test: `pkill -f "tsx src/server.ts"` also matched the shell running it (exit 144), so the server log was not printed. | Checked with `pgrep` that the port-3123 server was gone. Two other `tsx` servers belonging to a different checkout were left untouched. |

## 6. Changes to existing code

| File | Change | Why |
| --- | --- | --- |
| `back-end/src/domain/events.ts` = `front-end/src/app/domain/events.ts` | Added `{type:'typing'}` (client→server) and `{type:'typing', userId, name}` (server→client) with parsing. Both copies identical (R2). | New protocol events for FR-10/FR-11. |
| `back-end/src/streams/chat-room.ts` | The room Subject carries `RoomEvent` (message or typing) instead of `ChatMessage`; typing pings are throttled per client and never sent back to the typist. | FR-10, FR-11, FR-13. Message flow unchanged (FR-03, FR-07 tests pass). |
| `front-end/src/app/streams/chat-session.ts` | `ChatSession` gained `typing$`, `keystroke()`, `typingSent$`; new `typingSignals$`. | FR-10 to FR-13. Existing members unchanged. |
| `front-end/src/app/streams/scroll.ts` | Added `scrollToBottomSmoothly`. | FR-17. |
| `front-end/src/app/chat/chat-room/chat-room.ts` | Wires typing pings, the unread counter, scroll events and the pill click. | FR-10, FR-15 to FR-18. |
| `front-end/src/app/chat/chat-room/chat-room.html` | The list is wrapped in `.list-wrap` (to position the pill); the reserved `.strip` now holds the typing indicator (it was `aria-hidden` and always empty; now `aria-live="polite"`); `(input)` on the message box. | FR-11, FR-14, FR-16. |
| `front-end/src/app/chat/chat-room/chat-room.css` | Styles for `.list-wrap`, the pill, the indicator and dots; `.strip` keeps `height: 32px`. | Match `docs/design/typing.png` and `unread.png`; FR-14. |
| `front-end/src/app/chat/chat-room/chat-room.spec.ts` | In `sends trimmed text and clears the input (FR-02)` and `does not send blank text and keeps the input (FR-02)`, `expect(sent)` became `expect(messagesSent())` (only `message` events). No test was removed or skipped. | Typing in the box now also sends a typing ping (FR-10); FR-02 is about messages. |
| `back-end/src/domain/events.spec.ts`, `front-end/src/app/domain/events.spec.ts`, `back-end/src/streams/chat-room.spec.ts`, `back-end/src/streams/socket.spec.ts`, `front-end/src/app/streams/chat-session.spec.ts`, `front-end/src/app/streams/scroll.spec.ts` | Only new tests appended. | Tests for the new behaviour. |

No lint config, dependency-cruiser config, script or `package.json` was changed.

## 7. Known gaps

- **Not run in real browsers.** The 3-window manual test in `testing.md` was written but not run here.
  The back-end was checked live with 3 `ws` clients (section 4, step 16). The front-end was checked with jsdom component tests.
- **FR-14 height and FR-16 position are not checked by any test.** jsdom has no layout. The tests check that the strip
  is always rendered and that the pill is in the DOM only when the count is above 0. The 32 px height and the bottom-center
  position come from CSS only.
- **The 2 s expiry is not tested at component level.** It is covered by marble tests (`typingUsers$`, `chatSession › typing$ …`),
  but not in `ChatRoom`, which would need real or faked timers.
- **The "3 pessoas online" header line in both designs is not implemented.** It is not part of FR-10 to FR-19.
- `typingUsers$` keeps one small `groupBy` group per user who has typed, for the length of the session.
  Groups are not closed when a user leaves.
- If a user disconnects while typing, the others still see the name for up to 2 s, since there is no "left" event.
- If a message from someone else arrives during the pill's smooth-scroll animation, while still more than 40 px from the bottom,
  it adds 1 for a moment. The counter goes back to 0 when the scroll reaches the bottom (FR-18).
- Typing only spaces still sends typing pings. The rule is "typing in the message box".
- `@vitest/coverage-v8` was installed with `--no-save`, so the coverage commands need that install step until it is
  added to `devDependencies`.
- One template branch (`chat-room.html:43`, the `?? []` fallback before the first `typing$` value) is not covered.
