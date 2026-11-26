# Run log – FR-10 to FR-19 (typing indicator, unread counter)

Branch `run/B3`, base commit `142065b`. All numbers below come from real command output
in this run.

## 1. Summary

| Metric | Back-end | Front-end |
| --- | --- | --- |
| Files created | 2 (`src/streams/typing.ts`, `src/streams/typing.spec.ts`) | 8 (`domain/typing.ts`, `domain/typing.spec.ts`, `domain/unread.ts`, `domain/unread.spec.ts`, `streams/typing.ts`, `streams/typing.spec.ts`, `streams/unread.ts`, `streams/unread.spec.ts`) |
| Files modified | 5 | 10 |
| Lines added (`git diff --stat`, new files included via `git add -N`) | 158 | 886 |
| Lines removed (`git diff --stat`) | 10 | 25 |
| Tests added | 15 (33 → 48) | 47 (45 → 92) |
| Tests passing | 48 / 48 | 92 / 92 |
| Tests failing | 0 | 0 |
| Line coverage, new code | 100 % of new lines. Per file: `streams/typing.ts` 100 % (2/2), `streams/chat-room.ts` 100 % (23/23), `domain/events.ts` 97.77 % (44/45). The one uncovered line (90, `default: return null` in `parseServerEvent`) is base code, not new. Whole back-end: 96.59 % lines (85/88). | 100 %. Every new/changed file 100 % lines: `domain/typing.ts` 12/12, `domain/unread.ts` 2/2, `domain/events.ts` 45/45, `streams/typing.ts` 23/23, `streams/unread.ts` 8/8, `streams/chat-session.ts` 20/20, `streams/scroll.ts` 13/13, `chat-room.ts` 28/28, `chat-room.html` 44/44. Whole front-end: 100 % lines (236/236). |

Docs (`docs/testing.md`, `docs/run-log.md`) are not counted in the table.

## 2. Requirements

| Requirement | Implemented | Where (file:line) | Covered by test |
| --- | --- | --- | --- |
| FR-10 typing event, max 1 per 500 ms per user | yes | Client: `front-end/src/app/chat/chat-room/chat-room.html:61` (keydown), `front-end/src/app/chat/chat-room/chat-room.ts:80`, `front-end/src/app/domain/typing.ts:34` (`isTypingKey`), `front-end/src/app/streams/typing.ts:35` (`typingPings$`), `front-end/src/app/streams/chat-session.ts:73`. Server guard: `back-end/src/streams/typing.ts:10` (`throttleTyping`), `back-end/src/streams/chat-room.ts:79`. Protocol: `back-end/src/domain/events.ts:62` (and identical front-end copy) | `typingPings$ (FR-10) › sends at most one ping per 500 ms while the user keeps typing`; `chatSession › typed() sends at most one typing event per 500 ms …`; `ChatRoom › typing indicator › sends one typing event for a burst of keystrokes …`; `throttleTyping (FR-10) › relays the first keystroke …`; `chatRoom › typing indicator › relays at most one typing event per user every 500 ms (FR-10)` |
| FR-11 indicator text between list and input | yes | `front-end/src/app/domain/typing.ts:11` (`typingParts`), `front-end/src/app/chat/chat-room/chat-room.html:43`, `front-end/src/app/chat/chat-room/chat-room.ts:62`; relay: `back-end/src/streams/chat-room.ts:79` | `typingText (FR-11) › formats one, two and three names`; `ChatRoom › typing indicator › shows who is typing between the list and the input, with names in bold (FR-11)`; `chatRoom › typing indicator › relays typing to every other joined client …` |
| FR-12 disappears 2 s after last keystroke / on send | yes | `front-end/src/app/streams/typing.ts:71` (per-user `switchMap` + `timer(idleMs)`; a message from the user ends it) | `activeTypers$ › shows a user while typing and drops them 2 s after the last keystroke …`; `activeTypers$ › drops a user immediately when their message arrives (FR-12)`; `ChatRoom › typing indicator › removes a name immediately when that user sends a message (FR-12)` |
| FR-13 never see own name | yes | Server: `back-end/src/streams/chat-room.ts:33` + `:68` (no echo to the typist). Client (defence in depth): `front-end/src/app/streams/typing.ts:65` | `chatRoom › typing indicator › relays typing … never back to the typist (FR-11, FR-13)`; `activeTypers$ › never shows the current user (FR-13)`; `typingNames$ › waits for the join ack …`; `ChatRoom › typing indicator › never shows the current user (FR-13)` |
| FR-14 indicator keeps its height | yes | `front-end/src/app/chat/chat-room/chat-room.css:109-111` (`.strip { flex: none; height: 32px }`), `front-end/src/app/chat/chat-room/chat-room.html:43` | `ChatRoom › typing indicator › keeps the same strip element, empty, when nobody is typing (FR-14)`; pixel height checked in a real browser (see §4), not in a unit test |
| FR-15 count others' messages while scrolled up | yes | `front-end/src/app/streams/unread.ts:19`, wired in `front-end/src/app/chat/chat-room/chat-room.ts:69` | `unreadCount$ › counts others' messages while scrolled up (FR-15)`; `… does not count others' messages while at the bottom (FR-15)`; `ChatRoom › unread counter › counts others' messages while scrolled up …` |
| FR-16 pill text, hidden at 0 | yes | `front-end/src/app/domain/unread.ts:2`, `front-end/src/app/chat/chat-room/chat-room.html:29`, `front-end/src/app/chat/chat-room/chat-room.css:177` | `unreadLabel (FR-16) › …` (3 tests); `ChatRoom › unread counter › is hidden at 0 (FR-16)`; `… shows singular/plural (FR-15, FR-16)` |
| FR-17 click pill → smooth scroll + reset | yes | `front-end/src/app/chat/chat-room/chat-room.ts:90`, `front-end/src/app/streams/scroll.ts:16`, `front-end/src/app/streams/unread.ts:24` | `ChatRoom › unread counter › clicking the pill scrolls smoothly to the bottom and resets to 0 (FR-17)`; `smoothScrollToBottom (FR-17) › …` |
| FR-18 reaching bottom resets | yes | `front-end/src/app/chat/chat-room/chat-room.html:12` (scroll), `front-end/src/app/streams/unread.ts:31` (`reachedBottom$`), `front-end/src/app/chat/chat-room/chat-room.ts:68` | `reachedBottom$ (FR-18) › emits only for scroll events that end at the bottom`; `ChatRoom › unread counter › reaching the bottom by scrolling resets to 0 (FR-18)` |
| FR-19 own messages never count | yes | `front-end/src/app/streams/unread.ts:19` (`!message.own`) | `unreadCount$ › never counts own messages (FR-19)`; `ChatRoom › unread counter › never counts own messages (FR-19)` |

## 3. Tests

Back-end (15 new):

| Test name | File | Requirement | Type |
| --- | --- | --- | --- |
| parseClientEvent › returns null for typing as a string (R8) | `back-end/src/domain/events.spec.ts` | FR-10, R8 | unit |
| parseClientEvent › returns null for typing in an array (R8) | `back-end/src/domain/events.spec.ts` | FR-10, R8 | unit |
| parseClientEvent typing (FR-10) › parses a typing event and drops any extra fields | `back-end/src/domain/events.spec.ts` | FR-10 | unit |
| parseServerEvent › parses a valid typing event (FR-11) | `back-end/src/domain/events.spec.ts` | FR-11 | unit |
| parseServerEvent › returns null for typing without userId (R8) | `back-end/src/domain/events.spec.ts` | FR-11, R8 | unit |
| parseServerEvent › returns null for typing without name (R8) | `back-end/src/domain/events.spec.ts` | FR-11, R8 | unit |
| parseServerEvent › returns null for typing with non-string name (R8) | `back-end/src/domain/events.spec.ts` | FR-11, R8 | unit |
| clientEvent$ (R8, FR-08) › accepts typing frames and drops malformed ones (FR-10, R8) | `back-end/src/streams/socket.spec.ts` | FR-10, R8 | other (adapter, fake socket) |
| throttleTyping (FR-10) › uses a 500 ms window | `back-end/src/streams/typing.spec.ts` | FR-10 | unit |
| throttleTyping (FR-10) › relays the first keystroke and drops the rest of the 500 ms window | `back-end/src/streams/typing.spec.ts` | FR-10 | stream (marble) |
| throttleTyping (FR-10) › honours a custom window | `back-end/src/streams/typing.spec.ts` | FR-10 | stream (marble) |
| chatRoom › typing indicator › relays typing to every other joined client, never back to the typist (FR-11, FR-13) | `back-end/src/streams/chat-room.spec.ts` | FR-11, FR-13 | stream (marble) |
| chatRoom › typing indicator › relays at most one typing event per user every 500 ms (FR-10) | `back-end/src/streams/chat-room.spec.ts` | FR-10 | stream (marble) |
| chatRoom › typing indicator › ignores typing before join and does not relay it to late joiners (FR-07) | `back-end/src/streams/chat-room.spec.ts` | FR-07, FR-10 | stream (marble) |
| chatRoom › typing indicator › still delivers messages in order after typing (FR-03, FR-12 relies on the message event) | `back-end/src/streams/chat-room.spec.ts` | FR-03, FR-12 | stream (marble) |

Front-end (47 new):

| Test name | File | Requirement | Type |
| --- | --- | --- | --- |
| parseClientEvent › returns null for typing as a string (R8) | `front-end/src/app/domain/events.spec.ts` | FR-10, R8 | unit |
| parseClientEvent › returns null for typing in an array (R8) | `front-end/src/app/domain/events.spec.ts` | FR-10, R8 | unit |
| parseClientEvent typing (FR-10) › parses a typing event and drops any extra fields | `front-end/src/app/domain/events.spec.ts` | FR-10 | unit |
| parseServerEvent › parses a valid typing event (FR-11) | `front-end/src/app/domain/events.spec.ts` | FR-11 | unit |
| parseServerEvent › returns null for typing without userId (R8) | `front-end/src/app/domain/events.spec.ts` | FR-11, R8 | unit |
| parseServerEvent › returns null for typing without name (R8) | `front-end/src/app/domain/events.spec.ts` | FR-11, R8 | unit |
| parseServerEvent › returns null for typing with non-string name (R8) | `front-end/src/app/domain/events.spec.ts` | FR-11, R8 | unit |
| typingText (FR-11) › is empty when nobody is typing | `front-end/src/app/domain/typing.spec.ts` | FR-11, FR-14 | unit |
| typingText (FR-11) › formats one, two and three names | `front-end/src/app/domain/typing.spec.ts` | FR-11 | unit |
| typingText (FR-11) › keeps the same pattern for more names | `front-end/src/app/domain/typing.spec.ts` | FR-11 | unit |
| typingParts (FR-11) › marks names so they can be rendered bold | `front-end/src/app/domain/typing.spec.ts` | FR-11 | unit |
| isTypingKey (FR-10) › counts printable characters and editing keys | `front-end/src/app/domain/typing.spec.ts` | FR-10 | unit |
| isTypingKey (FR-10) › ignores Enter, navigation, modifiers and shortcuts | `front-end/src/app/domain/typing.spec.ts` | FR-10 | unit |
| unreadLabel (FR-16) › is hidden (null) at 0 | `front-end/src/app/domain/unread.spec.ts` | FR-16 | unit |
| unreadLabel (FR-16) › uses the singular for 1 and the plural for more | `front-end/src/app/domain/unread.spec.ts` | FR-16 | unit |
| unreadLabel (FR-16) › treats nonsense counts as nothing unread | `front-end/src/app/domain/unread.spec.ts` | FR-16 | unit |
| typingPings$ (FR-10) › uses a 500 ms window | `front-end/src/app/streams/typing.spec.ts` | FR-10 | unit |
| typingPings$ (FR-10) › sends at most one ping per 500 ms while the user keeps typing | `front-end/src/app/streams/typing.spec.ts` | FR-10 | stream (marble) |
| typingPings$ (FR-10) › sends nothing without keystrokes | `front-end/src/app/streams/typing.spec.ts` | FR-10 | stream (marble) |
| activeTypers$ › uses a 2 s idle timeout | `front-end/src/app/streams/typing.spec.ts` | FR-12 | unit |
| activeTypers$ › shows a user while typing and drops them 2 s after the last keystroke (FR-11, FR-12) | `front-end/src/app/streams/typing.spec.ts` | FR-11, FR-12 | stream (marble) |
| activeTypers$ › drops a user immediately when their message arrives (FR-12) | `front-end/src/app/streams/typing.spec.ts` | FR-12 | stream (marble) |
| activeTypers$ › a message from someone not typing changes nothing | `front-end/src/app/streams/typing.spec.ts` | FR-12 | stream (marble) |
| activeTypers$ › lists several typists in the order they started, each with their own timer (FR-11, FR-12) | `front-end/src/app/streams/typing.spec.ts` | FR-11, FR-12 | stream (marble) |
| activeTypers$ › ignores events that are neither typing nor messages | `front-end/src/app/streams/typing.spec.ts` | R8 | stream (marble) |
| activeTypers$ › never shows the current user (FR-13) | `front-end/src/app/streams/typing.spec.ts` | FR-13 | stream (marble) |
| typingNames$ › waits for the join ack to learn who "me" is (FR-13) | `front-end/src/app/streams/typing.spec.ts` | FR-13 | stream (marble) |
| unreadCount$ › counts others' messages while scrolled up (FR-15) | `front-end/src/app/streams/unread.spec.ts` | FR-15 | stream (marble) |
| unreadCount$ › does not count others' messages while at the bottom (FR-15) | `front-end/src/app/streams/unread.spec.ts` | FR-15 | stream (marble) |
| unreadCount$ › never counts own messages (FR-19) | `front-end/src/app/streams/unread.spec.ts` | FR-19 | stream (marble) |
| unreadCount$ › resets to 0 on reset$ and counts again afterwards (FR-17, FR-18) | `front-end/src/app/streams/unread.spec.ts` | FR-17, FR-18 | stream (marble) |
| reachedBottom$ (FR-18) › emits only for scroll events that end at the bottom | `front-end/src/app/streams/unread.spec.ts` | FR-18 | stream (marble) |
| chatSession › typed() sends at most one typing event per 500 ms and reports it on typingSent$ (FR-10) | `front-end/src/app/streams/chat-session.spec.ts` | FR-10 | stream (marble) |
| chatSession › typingNames$ lists other users typing, never the current user (FR-11, FR-13) | `front-end/src/app/streams/chat-session.spec.ts` | FR-11, FR-12, FR-13 | stream (marble) |
| smoothScrollToBottom (FR-17) › asks the browser for a smooth scroll to the end | `front-end/src/app/streams/scroll.spec.ts` | FR-17 | unit |
| smoothScrollToBottom (FR-17) › falls back to a jump where scrollTo is missing | `front-end/src/app/streams/scroll.spec.ts` | FR-17 | unit |
| ChatRoom › typing indicator › sends one typing event for a burst of keystrokes, ignoring Enter/Tab/shortcuts (FR-10) | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-10 | component |
| ChatRoom › typing indicator › shows who is typing between the list and the input, with names in bold (FR-11) | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-11 | component |
| ChatRoom › typing indicator › removes a name immediately when that user sends a message (FR-12) | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-12 | component |
| ChatRoom › typing indicator › never shows the current user (FR-13) | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-13 | component |
| ChatRoom › typing indicator › keeps the same strip element, empty, when nobody is typing (FR-14) | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-14 | component |
| ChatRoom › unread counter › is hidden at 0 (FR-16) | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-16 | component |
| ChatRoom › unread counter › counts others' messages while scrolled up and shows singular/plural (FR-15, FR-16) | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-15, FR-16 | component |
| ChatRoom › unread counter › does not count while at the bottom (FR-15) | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-15 | component |
| ChatRoom › unread counter › never counts own messages (FR-19) | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-19 | component |
| ChatRoom › unread counter › clicking the pill scrolls smoothly to the bottom and resets to 0 (FR-17) | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-17 | component |
| ChatRoom › unread counter › reaching the bottom by scrolling resets to 0 (FR-18) | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | FR-18 | component |

Other, not part of the suites (scripts in the session scratchpad, not committed):

| Test name | File | Requirement | Type |
| --- | --- | --- | --- |
| WebSocket smoke test: 2 `ws` clients against the real server | scratchpad `smoke.mjs` | FR-10, FR-13, FR-08 | other (manual-style, live server) |
| 3-tab headless Chromium run (Ana, Bruno, Carla) over DevTools protocol, with screenshots | scratchpad `e2e.mjs` | FR-10 to FR-19 | other (end-to-end, live server + `ng serve`) |

## 4. Commands

In order. "Runs" counts how many times that exact command was run at that point.

| # | Command | Result | Runs |
| --- | --- | --- | --- |
| 1 | `bash scripts/validate.sh` (baseline) | fail – `Missing back-end/node_modules` | 1 |
| 2 | `cd back-end && npx vitest run` | fail – `ERR_MODULE_NOT_FOUND` | 1 |
| 3 | `cd front-end && npx ng test --watch=false` | fail – builder package not found | 1 |
| 4 | `cd back-end && npm install` | pass | 1 |
| 5 | `cd front-end && npm install` | pass | 1 |
| 6 | `bash scripts/validate.sh` (baseline) | pass – 12 checks, ALL CHECKS PASSED | 1 |
| 7 | `cd back-end && npx vitest run` (baseline) | pass – 33 tests | 1 |
| 8 | `cd front-end && npx ng test --watch=false` (baseline) | pass – 45 tests | 1 |
| 9 | `cd back-end && npx tsc --noEmit` | pass | 1 |
| 10 | `cd back-end && npx vitest run` | fail – 4 failed / 44 passed | 1 |
| 11 | `cd back-end && npx vitest run` + `npx vitest run src/streams/chat-room.spec.ts` (to read the diffs) | fail – same failures | 1 + 1 |
| 12 | `cd back-end && npx vitest run` | fail – 1 failed / 47 passed | 1 |
| 13 | `cd back-end && npx vitest run` | pass – 48 tests | 1 |
| 14 | `cd back-end && npm run typecheck && npm run lint && npm run lint:deps` | pass | 1 |
| 15 | `cd front-end && npx ng test --watch=false` | fail – TS2345 in `streams/typing.spec.ts` (build error, ran twice: once with output filtered away, once to read it) | 2 |
| 16 | `cd front-end && npx ng test --watch=false` | fail – 4 failed / 63 passed | 1 |
| 17 | `cd front-end && npx ng test --watch=false` | pass – 67 tests | 1 |
| 18 | `cd front-end && npm run typecheck && npm run lint && npm run lint:deps` | pass | 1 |
| 19 | `cd front-end && npx ng test --watch=false` | pass – 82 tests | 1 |
| 20 | `bash scripts/validate.sh` | pass – ALL CHECKS PASSED | 1 |
| 21 | `PORT=3123 npx tsx src/server.ts` + `node smoke.mjs` | pass – Bruno got `typing:Ana` twice for 6 pings (5 in a burst + 1 after 600 ms), garbage ignored, Ana got no own typing | 1 |
| 22 | `npm install --no-save @vitest/coverage-v8@5.1.1` (back-end) / `@5.1.0` (front-end) | pass | 1 each |
| 23 | `cd back-end && npx vitest run --coverage --coverage.reporter=text` | pass – 48 tests, 96.59 % lines | 1 |
| 24 | `cd front-end && npx ng test --watch=false --coverage` | pass – 82 tests, 97.45 % lines | 1 |
| 25 | `cd back-end && npx vitest run --coverage --coverage.reporter=json-summary` | pass – per-file numbers in §1 | 1 |
| 26 | `cd front-end && npx ng test --watch=false --coverage --coverage-reporters=json-summary` | pass – 82 tests | 1 |
| 27 | `cd front-end && npx ng test --watch=false --coverage --coverage-reporters=json-summary` (after adding tests for uncovered lines) | pass – 92 tests, 100 % lines | 1 |
| 28 | `npx tsx src/server.ts` (port 3000) + `npx ng serve --port 4300` + `chromium --headless=new --remote-debugging-port=9333` | pass (started) | 1 |
| 29 | `node e2e.mjs` (3-tab browser run) | fail – join never happened (button still disabled at click time) | 1 |
| 30 | `node e2e.mjs` | fail – hung (`requestAnimationFrame` in a background tab); stopped | 1 |
| 31 | `node e2e.mjs` | pass – every FR-10…FR-19 check printed the expected value; strip height 32 px empty and full | 1 |
| 32 | `bash scripts/validate.sh` (final) | pass – 12 checks, ALL CHECKS PASSED | 1 |

Totals: `bash scripts/validate.sh` 4 runs (1 fail, 3 pass). Back-end `npx vitest run` 6 runs plus 1 single-file run and 2 coverage runs. Front-end `npx ng test --watch=false` 8 runs plus 4 coverage runs.

## 5. Problems

| Problem | Fix |
| --- | --- |
| `node_modules` missing in both folders; validate/tests could not start. | `npm install` in each folder. |
| Back-end marble tests failed: fake clients joined at frame 0 of a hot observable, before the room subscribed, so they never joined. | Moved the joins to frame 1 (`-a`). |
| Back-end throttle test expected an event exactly at 500 ms; that boundary is ambiguous with `throttleTime`. | Moved the event to 501 ms. |
| Off-by-one frame in the `chatRoom` throttle marble (`595ms` vs `596ms`). | Recounted the frames; fixed the expected marble and the comment. |
| Front-end build error TS2345: `hot('…', { j: { type: 'joined', … } })` inferred `type: string`. | Typed it: `hot<ServerEvent>(…)`. |
| 4 front-end marble tests failed: `TestScheduler` flushes all pending timers, so the final 2 s removal also showed up. | Added the final `[]` emission at the right frame to each expected marble. |
| The existing FR-02 component test types with an `input` event and expects only the message to be sent; triggering typing on `(input)` would have broken it. | Triggered typing on `(keydown)` instead, filtered by a pure `isTypingKey` (also stops Enter/Tab/arrows/shortcuts counting as typing). The existing test is unchanged. |
| `@else {{{ part.text }}}}` in the template is ambiguous for Angular's block parser (caught when reviewing, before it failed). | Rewrote the loop with a `<span>` per non-name part. |
| No coverage provider installed (`@vitest/coverage-v8` missing). | `npm install --no-save` matching each vitest version, so `package.json`/lock files are unchanged. |
| The text coverage reporter hides files with 100 % coverage. | Used the `json-summary` reporter for per-file numbers. |
| Coverage showed uncovered new lines: front-end `events.ts` typing cases (front spec did not test them), `streams/typing.ts` default branch, `scroll.ts` fallback. | Mirrored the back-end typing parse tests into the front-end `events.spec.ts`; added `activeTypers$ › ignores events …` and two `smoothScrollToBottom` tests. |
| `back-end/coverage/` was left as an untracked folder (not in `.gitignore`). | Deleted it. |
| E2E run 1: "Entrar" was still disabled when clicked synchronously after setting the name. | Waited 100 ms before clicking. |
| E2E run 2 hung: `requestAnimationFrame` never fires in a background headless tab, and background tabs are throttled. | Removed rAF; call `Page.bringToFront` before each action. |
| `pkill -f …` exited with 144 because the pattern also matched the shell running it. | Killed the servers by PID. An `ng serve` (PID 24489) that was already running before this run was left alone. |

## 6. Changes to existing code

| File | Why |
| --- | --- |
| `back-end/src/domain/events.ts` + `front-end/src/app/domain/events.ts` (identical, R2) | New `typing` client event and `typing` server event, plus their parsers. |
| `back-end/src/streams/chat-room.ts` | `room$` now carries `ServerEvent` (messages and typing) instead of `ChatMessage`; typing is throttled per client and not echoed to the typist. Message flow unchanged. |
| `front-end/src/app/streams/chat-session.ts` | `ChatSession` gets `typed()`, `typingSent$`, `typingNames$`. Existing members unchanged. |
| `front-end/src/app/streams/scroll.ts` | Added `smoothScrollToBottom` (FR-17). Existing functions unchanged. |
| `front-end/src/app/chat/chat-room/chat-room.ts` | Wires typing pings, indicator, unread counter, scroll and pill click. |
| `front-end/src/app/chat/chat-room/chat-room.html` | The list is wrapped in `.viewport` (positioning context for the pill); the empty reserved `.strip` now holds the indicator (still `class="strip"`, 32 px); `(keydown)` on the input; pill button. |
| `front-end/src/app/chat/chat-room/chat-room.css` | `.viewport`, indicator (`.typing`, `.dots` animation) and `.unread-pill` styles. |
| Spec files `events.spec.ts` (both), `socket.spec.ts`, `chat-room.spec.ts` (both), `chat-session.spec.ts`, `scroll.spec.ts` | Only new tests added; no existing test was changed or removed. |

No change to `eslint.config.*`, `.dependency-cruiser.cjs`, `scripts/`, `package.json` or lock files.

## 7. Known gaps

- FR-14's pixel height (32 px) is not unit-tested: jsdom has no layout. It was checked in the headless Chromium run (`h=32` both empty and with text) and is in the manual test.
- Pill position and the smooth-scroll animation are visual. Only the `scrollTo({ behavior: 'smooth' })` call is unit-tested; the look was checked against `docs/design/unread.png` from a screenshot.
- Typing is detected on `keydown`. Text pasted with the mouse, or with Ctrl/Cmd+V, does not send a typing event.
- The server throttles at 500 ms too. If network jitter brings two client pings less than 500 ms apart, the server drops one. This is harmless because the 2 s timeout is longer.
- The mockups show "3 pessoas online" under the room title. That is not part of FR-10 to FR-19 and was not implemented.
- Per-user typing groups (`groupBy`) are kept for the whole session: one tiny entry per user who ever typed.
- The smoke and E2E scripts were throwaway scripts in the session scratchpad. They are not part of `validate.sh`.
