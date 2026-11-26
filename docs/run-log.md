# Run log – FR-10 to FR-19 (typing indicator and unread counter)

Branch `run/B2`, base commit `142065b`. All numbers below come from actual command output
in this run.

## 1. Summary

| Metric | Back-end | Front-end |
| --- | --- | --- |
| Files created | 2 (`src/streams/typing.ts`, `src/streams/typing.spec.ts`) | 8 (`domain/typing.ts`, `domain/typing.spec.ts`, `domain/unread.ts`, `domain/unread.spec.ts`, `streams/typing.ts`, `streams/typing.spec.ts`, `streams/unread.ts`, `streams/unread.spec.ts`) |
| Files modified | 4 | 10 |
| Lines added (`git diff --stat`, new files included via `git add -N`) | 167 | 829 |
| Lines removed | 8 | 15 |
| Tests added | 15 (33 → 48) | 47 (45 → 92) |
| Tests passing | 48 | 92 |
| Tests failing | 0 | 0 |
| Line coverage % for the new code | 100 % (`typing.ts` 100 %, `chat-room.ts` 100 %, `events.ts` 100 % lines) | 100 % (`streams/typing.ts`, `streams/unread.ts`, `domain/typing.ts`, `domain/unread.ts`, `chat-room.ts`, `chat-session.ts`, `scroll.ts`, `events.ts`: all 100 % lines) |

Overall coverage reported by the last coverage runs: back-end 97.77 % lines (only uncovered
lines: `socket.ts:26-31`, pre-existing and unchanged); front-end 100 % lines (308/309
statements, 96.96 % branches; the uncovered branch in new code is the `?? []` fallback in
`chat-room.ts:97`, never hit because `typingNames$` emits synchronously).

Totals: 24 files changed, 996 insertions(+), 23 deletions(-) (source only, excluding these
docs). `bash scripts/validate.sh` → `12 checks passed. ALL CHECKS PASSED`.

## 2. Requirements

| Requirement | Implemented | Where (file:line) | Covered by test |
| --- | --- | --- | --- |
| FR-10 | yes | `front-end/src/app/streams/typing.ts:20` (`typingPings$`), `front-end/src/app/streams/chat-session.ts:73`, `front-end/src/app/chat/chat-room/chat-room.html:54` (`(input)="typed()"`), `front-end/src/app/chat/chat-room/chat-room.ts:68`; server-side enforcement `back-end/src/streams/typing.ts:9`, `back-end/src/streams/chat-room.ts:95`; protocol `back-end/src/domain/events.ts:9,66` | `typingPings$ (FR-10) › sends on the first keystroke, then at most once per 500 ms`; `chatSession › typing() sends at most one typing event per 500 ms (FR-10)`; `ChatRoom › typing indicator › sends one typing event for a burst of keystrokes (FR-10)`; `throttleTyping (FR-10) › lets the first keystroke through and drops the rest of the 500 ms window`; `chatRoom › typing indicator › relays at most one typing event per 500 ms per user (FR-10)` |
| FR-11 | yes | `back-end/src/streams/chat-room.ts:38` (fan-out), `front-end/src/app/streams/typing.ts:53` (`typingNames$`), `front-end/src/app/domain/typing.ts:11` (text), `front-end/src/app/chat/chat-room/chat-room.html:43-44` | `typingText (FR-11) › …`; `typingNames$ › lists several users in the order they started, each with its own timer (FR-11)`; `ChatRoom › typing indicator › shows who is typing, with bold names, between the list and the input (FR-11)`; `… lists three typists as "Ana, Bruno e Carla" (FR-11)`; `chatRoom › typing indicator › relays typing to the other clients but never back to the typist (FR-11, FR-13)` |
| FR-12 | yes | `front-end/src/app/streams/typing.ts:71` (2 s timer per user), `front-end/src/app/streams/typing.ts:42` (message clears); constant `events.ts:11` | `typingNames$ › shows a name 2 s after the last ping, then removes it (FR-11, FR-12)`; `… every new ping restarts that user's 2 s timer (FR-12)`; `… removes a name immediately when that user sends a message (FR-12)`; `ChatRoom › typing indicator › removes a name as soon as that user sends a message (FR-12)` |
| FR-13 | yes | `back-end/src/streams/chat-room.ts:43` (not echoed to sender), `front-end/src/app/streams/typing.ts:63` (self filtered by id) | `chatRoom › typing indicator › relays typing to the other clients but never back to the typist (FR-11, FR-13)`; `typingNames$ › never lists the current user, even if the server echoed it (FR-13)`; `ChatRoom › typing indicator › never shows the current user (FR-13)` |
| FR-14 | yes | `front-end/src/app/chat/chat-room/chat-room.css:142-144` (`.strip`, `height: 32px`), `front-end/src/app/chat/chat-room/chat-room.html:44` (strip always rendered) | `ChatRoom › typing indicator › keeps the strip in the layout while empty (FR-14)`; `ChatRoom › keeps the reserved indicator strip` (height itself: none, jsdom has no layout) |
| FR-15 | yes | `front-end/src/app/streams/unread.ts:21`, `front-end/src/app/chat/chat-room/chat-room.ts:71` | `unreadCount$ › counts messages from others while scrolled up (FR-15)`; `… does not count messages that arrive while at the bottom (FR-15)`; `ChatRoom › unread counter › counts messages from others while scrolled up (FR-15, FR-16)`; `… does not count while the user is at the bottom (FR-15)` |
| FR-16 | yes | `front-end/src/app/domain/unread.ts:2`, `front-end/src/app/chat/chat-room/chat-room.html:31`, `front-end/src/app/chat/chat-room/chat-room.css:109` | `unreadLabel (FR-16) › is empty at 0`; `… uses the singular for 1 and the plural for more`; `unreadCount$ › starts at 0 so the pill is hidden (FR-16)`; `ChatRoom › unread counter › is hidden at 0 (FR-16)` |
| FR-17 | yes | `front-end/src/app/chat/chat-room/chat-room.ts:91`, `front-end/src/app/streams/scroll.ts:16`, `front-end/src/app/streams/unread.ts:28` | `unreadCount$ › resets when the pill is clicked, and counts again afterwards (FR-17)`; `scrollToBottomSmoothly (FR-17) › asks the element for a smooth scroll to the end`; `ChatRoom › unread counter › clicking the pill scrolls smoothly to the bottom and resets the counter (FR-17)` |
| FR-18 | yes | `front-end/src/app/streams/unread.ts:25`, `front-end/src/app/chat/chat-room/chat-room.html:12` (`(scroll)`) | `unreadCount$ › resets when a scroll reaches the bottom, not on other scrolls (FR-18)`; `ChatRoom › unread counter › scrolling to the bottom resets the counter; scrolling elsewhere does not (FR-18)` |
| FR-19 | yes | `front-end/src/app/streams/unread.ts:21` (`!message.own`) | `unreadCount$ › never counts the user's own messages (FR-19)`; `ChatRoom › unread counter › never counts the user's own messages (FR-19)` |

## 3. Tests

Tests added in this run (62). `it.each` rows are listed individually.

| Test name | File | Requirement | Type |
| --- | --- | --- | --- |
| `throttleTyping (FR-10) › uses a 500 ms window by default` | `back-end/src/streams/typing.spec.ts` | FR-10 | unit |
| `throttleTyping (FR-10) › lets the first keystroke through and drops the rest of the 500 ms window` | `back-end/src/streams/typing.spec.ts` | FR-10 | stream |
| `throttleTyping (FR-10) › passes every keystroke that is more than 500 ms apart` | `back-end/src/streams/typing.spec.ts` | FR-10 | stream |
| `chatRoom › typing indicator › relays typing to the other clients but never back to the typist (FR-11, FR-13)` | `back-end/src/streams/chat-room.spec.ts` | FR-11, FR-13 | stream |
| `chatRoom › typing indicator › relays at most one typing event per 500 ms per user (FR-10)` | `back-end/src/streams/chat-room.spec.ts` | FR-10 | stream |
| `chatRoom › typing indicator › ignores typing before join, and typing carries the joined name (FR-11)` | `back-end/src/streams/chat-room.spec.ts` | FR-11 | stream |
| `chatRoom › typing indicator › a message is still delivered right after a typing ping (FR-12 relies on it)` | `back-end/src/streams/chat-room.spec.ts` | FR-12 | stream |
| `parseClientEvent › parses a typing event and ignores extra fields (FR-10)` | `back-end/src/domain/events.spec.ts` | FR-10 | unit |
| `parseClientEvent › returns null for typing with wrong case (R8)` | `back-end/src/domain/events.spec.ts` | FR-10, FR-08 | unit |
| `parseClientEvent › returns null for typing as a bare string (R8)` | `back-end/src/domain/events.spec.ts` | FR-10, FR-08 | unit |
| `parseServerEvent › parses a valid typing event (FR-11)` | `back-end/src/domain/events.spec.ts` | FR-11 | unit |
| `parseServerEvent › returns null for unknown type (R8)` | `back-end/src/domain/events.spec.ts` | FR-08 | unit |
| `parseServerEvent › returns null for typing without userId (R8)` | `back-end/src/domain/events.spec.ts` | FR-11, FR-08 | unit |
| `parseServerEvent › returns null for typing without name (R8)` | `back-end/src/domain/events.spec.ts` | FR-11, FR-08 | unit |
| `parseServerEvent › returns null for typing with non-string name (R8)` | `back-end/src/domain/events.spec.ts` | FR-11, FR-08 | unit |
| Same 8 tests as the 8 rows above (`parseClientEvent …`, `parseServerEvent …`) | `front-end/src/app/domain/events.spec.ts` | FR-10, FR-11, FR-08 | unit |
| `typingText (FR-11) › is empty when nobody is typing` | `front-end/src/app/domain/typing.spec.ts` | FR-11 | unit |
| `typingText (FR-11) › uses the singular for one name` | `front-end/src/app/domain/typing.spec.ts` | FR-11 | unit |
| `typingText (FR-11) › joins two names with "e"` | `front-end/src/app/domain/typing.spec.ts` | FR-11 | unit |
| `typingText (FR-11) › joins three or more names with commas and a final "e"` | `front-end/src/app/domain/typing.spec.ts` | FR-11 | unit |
| `typingParts (FR-11) › marks only the names, so they can be rendered in bold` | `front-end/src/app/domain/typing.spec.ts` | FR-11 | unit |
| `unreadLabel (FR-16) › is empty at 0` | `front-end/src/app/domain/unread.spec.ts` | FR-16 | unit |
| `unreadLabel (FR-16) › uses the singular for 1 and the plural for more` | `front-end/src/app/domain/unread.spec.ts` | FR-16 | unit |
| `typingPings$ (FR-10) › sends on the first keystroke, then at most once per 500 ms` | `front-end/src/app/streams/typing.spec.ts` | FR-10 | stream |
| `typingPings$ (FR-10) › sends nothing while the user does not type` | `front-end/src/app/streams/typing.spec.ts` | FR-10 | stream |
| `typingNames$ › shows a name 2 s after the last ping, then removes it (FR-11, FR-12)` | `front-end/src/app/streams/typing.spec.ts` | FR-11, FR-12 | stream |
| `typingNames$ › every new ping restarts that user's 2 s timer (FR-12)` | `front-end/src/app/streams/typing.spec.ts` | FR-12 | stream |
| `typingNames$ › removes a name immediately when that user sends a message (FR-12)` | `front-end/src/app/streams/typing.spec.ts` | FR-12 | stream |
| `typingNames$ › a message from someone else does not remove a typist` | `front-end/src/app/streams/typing.spec.ts` | FR-12 | stream |
| `typingNames$ › lists several users in the order they started, each with its own timer (FR-11)` | `front-end/src/app/streams/typing.spec.ts` | FR-11 | stream |
| `typingNames$ › never lists the current user, even if the server echoed it (FR-13)` | `front-end/src/app/streams/typing.spec.ts` | FR-13 | stream |
| `typingNames$ › ignores events that are neither typing nor messages (R8)` | `front-end/src/app/streams/typing.spec.ts` | FR-11 | stream |
| `typingNames$ › ignores typing before the join is acknowledged` | `front-end/src/app/streams/typing.spec.ts` | FR-11 | stream |
| `unreadCount$ › counts messages from others while scrolled up (FR-15)` | `front-end/src/app/streams/unread.spec.ts` | FR-15 | stream |
| `unreadCount$ › does not count messages that arrive while at the bottom (FR-15)` | `front-end/src/app/streams/unread.spec.ts` | FR-15 | stream |
| `unreadCount$ › never counts the user's own messages (FR-19)` | `front-end/src/app/streams/unread.spec.ts` | FR-19 | stream |
| `unreadCount$ › resets when a scroll reaches the bottom, not on other scrolls (FR-18)` | `front-end/src/app/streams/unread.spec.ts` | FR-18 | stream |
| `unreadCount$ › resets when the pill is clicked, and counts again afterwards (FR-17)` | `front-end/src/app/streams/unread.spec.ts` | FR-17 | stream |
| `unreadCount$ › starts at 0 so the pill is hidden (FR-16)` | `front-end/src/app/streams/unread.spec.ts` | FR-16 | stream |
| `chatSession › typing() sends at most one typing event per 500 ms (FR-10)` | `front-end/src/app/streams/chat-session.spec.ts` | FR-10 | stream |
| `chatSession › typingNames$ lists others typing from the server events (FR-11, FR-13)` | `front-end/src/app/streams/chat-session.spec.ts` | FR-11, FR-13 | stream |
| `scrollToBottomSmoothly (FR-17) › asks the element for a smooth scroll to the end` | `front-end/src/app/streams/scroll.spec.ts` | FR-17 | unit |
| `ChatRoom › typing indicator › sends one typing event for a burst of keystrokes (FR-10)` | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-10 | component |
| `ChatRoom › typing indicator › clearing the input after sending is not a keystroke (FR-10)` | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-10 | component |
| `ChatRoom › typing indicator › shows who is typing, with bold names, between the list and the input (FR-11)` | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-11 | component |
| `ChatRoom › typing indicator › lists three typists as "Ana, Bruno e Carla" (FR-11)` | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-11 | component |
| `ChatRoom › typing indicator › removes a name as soon as that user sends a message (FR-12)` | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-12 | component |
| `ChatRoom › typing indicator › never shows the current user (FR-13)` | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-13 | component |
| `ChatRoom › typing indicator › keeps the strip in the layout while empty (FR-14)` | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-14 | component |
| `ChatRoom › unread counter › is hidden at 0 (FR-16)` | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-16 | component |
| `ChatRoom › unread counter › counts messages from others while scrolled up (FR-15, FR-16)` | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-15, FR-16 | component |
| `ChatRoom › unread counter › does not count while the user is at the bottom (FR-15)` | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-15 | component |
| `ChatRoom › unread counter › never counts the user's own messages (FR-19)` | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-19 | component |
| `ChatRoom › unread counter › clicking the pill scrolls smoothly to the bottom and resets the counter (FR-17)` | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-17 | component |
| `ChatRoom › unread counter › scrolling to the bottom resets the counter; scrolling elsewhere does not (FR-18)` | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-18 | component |

Also run once, not as an automated test: an end-to-end smoke script (`e2e.mjs`, kept only
in the session scratchpad) against the real server — type **other**.

## 4. Commands

In the order first run. "Times" counts every run of that exact command.

| # | Command | Result | Times |
| --- | --- | --- | --- |
| 1 | `bash scripts/validate.sh` | fail ×1 (missing `node_modules`), then pass ×3 (baseline, after implementation, final) | 4 |
| 2 | `cd back-end && npx vitest run` | fail ×1 (`ERR_MODULE_NOT_FOUND`, no deps), pass ×1 (baseline 33), fail ×2 (4 new tests failing; second run only to list them), pass ×1 (47) | 5 |
| 3 | `cd front-end && npx ng test --watch=false` | fail ×1 (builder not installed), pass ×1 (baseline 45), fail ×1 (1 test), fail ×2 (TS2345 compile error; first run's output was hidden by my grep), pass ×1 (76), fail ×1 (2 FR-02 tests), pass ×1 (90) | 8 |
| 4 | `cd back-end && npm ci` | pass | 1 |
| 5 | `cd front-end && npm ci` | pass | 1 |
| 6 | `cd back-end && npx vitest run src/streams/chat-room.spec.ts` | fail (inspecting failures) | 1 |
| 7 | `cd back-end && npx vitest run src/streams/typing.spec.ts` | fail (inspecting failures) | 1 |
| 8 | `cd back-end && npm run typecheck` | pass | 1 |
| 9 | `cd back-end && npm run lint` | pass | 1 |
| 10 | `cd back-end && npm run lint:deps` | pass | 1 |
| 11 | `cd back-end && PORT=3999 npx tsx src/server.ts` + `node e2e.mjs` (3 `ws` clients) | pass (burst of 5 typing → 1 relayed; next after 600 ms relayed; garbage ignored; sender never gets its own typing) | 1 |
| 12 | `cd back-end && npx vitest run --coverage` | fail ×1 (missing `@vitest/coverage-v8`), pass ×2 (47, then 48 tests) | 3 |
| 13 | `cd back-end && npm install --no-save @vitest/coverage-v8@5.1.1` | pass | 1 |
| 14 | `cd front-end && npm install --no-save @vitest/coverage-v8@5.1.0` | pass | 1 |
| 15 | `cd front-end && npx ng test --watch=false --coverage` | pass (90, then 92 tests) | 2 |

`validate.sh` itself runs, each time: `check-contract.sh`, `check-time-logic.sh`,
`check-guards.sh`, and in each folder `typecheck`, `lint`, `lint:deps`, `test`, plus
`npx ng build --configuration development`.

## 5. Problems

| Problem | Fix |
| --- | --- |
| `validate.sh` / tests failed at the start: `node_modules` missing in both folders. | `npm ci` in `back-end/` and `front-end/`. |
| Back-end `throttleTyping` marble tests failed: I assumed a keystroke exactly 500 ms after the first opens a new window; `throttleTime(500)` still drops it (frame 500 is inside the window). | Kept the implementation (it satisfies "at most once per 500 ms") and moved the boundary keystrokes in the tests to 501 ms; renamed the test to "more than 500 ms apart". |
| Two new `chatRoom` tests failed: `hot('a-----')` emits at frame 0, before the room subscribes, so Bruno's join was lost. | Started those hot marbles with `-` (as the existing tests do). |
| Front-end marble test `ignores typing before the join is acknowledged` failed: `.toBe('e----')` without a values map compares against the string `'e'`. | Added `{ e: [] }`. |
| Front-end build error TS2345 in `chat-session.spec.ts`: `hot(...)` inferred `type: string`, not assignable to `ServerEvent`. | `hot<ServerEvent>(...)`. |
| Existing tests `ChatRoom › sends trimmed text and clears the input (FR-02)` and `… does not send blank text and keeps the input (FR-02)` failed: typing in the input now also sends `{ type: 'typing' }` (FR-10), so `sent` was no longer exactly `[message]`. | Those two assertions now check only `message` events (`sentMessages()`); FR-02 behaviour is unchanged. Typing events are checked by the new FR-10 tests. |
| `npx vitest run --coverage` failed: `MISSING DEPENDENCY Cannot find dependency '@vitest/coverage-v8'`. | `npm install --no-save` of the version matching each folder's Vitest, so `package.json` and lockfiles are unchanged. |
| The back-end coverage run wrote `back-end/coverage/` (not gitignored), which inflated `git diff --stat` to +4344 lines. | Deleted the generated folder and recomputed the stats. |
| Coverage showed two uncovered lines: `parseServerEvent` default branch (back-end) and `toTypingSignal` default branch (front-end). | Added `returns null for unknown type (R8)` (both `events.spec.ts`) and `typingNames$ › ignores events that are neither typing nor messages (R8)`. |
| Smoke test command ended with exit code 144. | Caused by `pkill -f "src/server.ts"` also matching the shell running it; the test output was complete and the server was stopped. No change needed. |

## 6. Changes to existing code

| File | Why |
| --- | --- |
| `back-end/src/domain/events.ts`, `front-end/src/app/domain/events.ts` (identical, R2) | New `typing` client and server events, their parsing, and the constants `TYPING_THROTTLE_MS = 500`, `TYPING_TIMEOUT_MS = 2000`. |
| `back-end/src/streams/chat-room.ts` | The room subject now carries messages *and* typing events (`RoomEvent`); each session throttles its typing (FR-10) and doesn't receive its own typing (FR-13). Message flow unchanged. |
| `back-end/src/domain/events.spec.ts`, `front-end/src/app/domain/events.spec.ts` | New cases for the typing events (valid and garbage). |
| `back-end/src/streams/chat-room.spec.ts` | New `typing indicator` describe block; existing tests unchanged. |
| `front-end/src/app/streams/chat-session.ts` | `ChatSession` gains `typing()`, `typingSent$`, `typingNames$`. Existing members unchanged. |
| `front-end/src/app/streams/chat-session.spec.ts` | Two new tests. |
| `front-end/src/app/streams/scroll.ts` / `.spec.ts` | Added `scrollToBottomSmoothly` (FR-17) and its test. |
| `front-end/src/app/chat/chat-room/chat-room.ts` | Wires keystrokes → typing pings, the unread counter (`unreadCount$` via `toSignal`), the scroll and pill-click handlers. |
| `front-end/src/app/chat/chat-room/chat-room.html` | Message list wrapped in `.list-area` (positioning context for the pill); `(scroll)` on the list; unread pill; the previously empty `.strip` now holds the typing indicator; `(input)="typed()"` on the message box. |
| `front-end/src/app/chat/chat-room/chat-room.css` | Styles for `.list-area`, `.unread-pill`, the typing strip and the animated dots (with `prefers-reduced-motion`). `.strip` keeps `flex: none; height: 32px`. |
| `front-end/src/app/chat/chat-room/chat-room.spec.ts` | Two existing FR-02 assertions narrowed to `message` events (see Problems); new `typing indicator` and `unread counter` blocks. No test removed or skipped. |

No lint config, dependency-cruiser config, `scripts/` or `package.json` was changed.

## 7. Known gaps

- **Manual browser test not executed in this run.** The 3-window test in `docs/testing.md`
  was written but not performed; the UI was not checked visually against
  `docs/design/typing.png` / `unread.png`. The server was exercised end to end only with the
  `ws` smoke script.
- **FR-14 height** is enforced by CSS only (`.strip { height: 32px }`); the automated test
  checks that the strip stays in the DOM, not its rendered height (jsdom has no layout).
- **FR-12 expiry** is tested in virtual time on `typingNames$`; there is no component-level
  test that waits a real 2 s.
- **FR-16 position / FR-17 smoothness**: the test checks that `scrollTo` is called with
  `behavior: 'smooth'`; the pill's bottom-center placement and the animation are manual.
- **"3 pessoas online"** under "Sala geral" in both design screens is not part of FR-10 to
  FR-19 and was not implemented.
- **Throttle boundary**: client and server both use a 500 ms window. Network jitter can make
  the server drop a ping that the client sent just over 500 ms after the previous one; the
  next ping arrives ~500 ms later, well within the 2 s timeout, so the indicator does not
  flicker, but that case isn't covered by an automated test.
- Coverage requires installing `@vitest/coverage-v8` with `--no-save`; it is not part of the
  project's dependencies.
