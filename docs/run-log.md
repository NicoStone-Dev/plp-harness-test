# Run log – FR-10 to FR-19

Branch `run/A1`, base commit `319dc71`. Node v24.15.0. Nothing was committed.

## 1. Summary

Line counts come from `git diff --stat` / `git diff --numstat`, run after
`git add -N back-end front-end` so that new files are counted too. They were
taken before `docs/testing.md` and `docs/run-log.md` were written, so these
two files are not included. The numbers are shown with and without the
regenerated `package-lock.json`.

| Metric | Back-end | Front-end |
| ------ | -------- | --------- |
| Files created | 6 (`vitest.config.ts`, `test/chat-room.test.ts`, `test/events.test.ts`, `test/server.integration.test.ts`, `test/fake-client.ts`, `test/tsconfig.json`) | 8 (`domain/indicator-text.ts`, `streams/typing.ts`, `streams/unread.ts`, and 5 `*.spec.ts`) |
| Files modified | 5 (`.gitignore`, `package.json`, `package-lock.json`, `src/domain/events.ts`, `src/streams/chat-room.ts`) | 8 (`package.json`, `package-lock.json`, `domain/events.ts`, `streams/chat-session.ts`, `streams/scroll.ts`, `chat-room.ts`, `chat-room.html`, `chat-room.css`) |
| Lines added | 1896 total; 323 without `package-lock.json` | 1110 total; 949 without `package-lock.json` |
| Lines removed | 217 total; 10 without `package-lock.json` | 23 total; 23 without `package-lock.json` |
| Tests added | 14 | 45 |
| Tests passing | 14 | 45 |
| Tests failing | 0 | 0 |
| Line coverage, new code | 100% of new/changed lines. File totals: `chat-room.ts` 95.45%, `events.ts` 97.77%. The only uncovered lines are base code: `chat-room.ts:98` (socket-error `console.warn`) and `events.ts:90`. All files: 89.24% lines (`server.ts` 0%, not loaded by the tests). | 100% lines in every new or changed file (`typing.ts`, `unread.ts`, `indicator-text.ts`, `chat-session.ts`, `scroll.ts`, `chat-room.ts`, `chat-room.html`). All loaded files: 100% lines, 91.83% branches (`chat-room.html` 90% branches at line 44). |

Coverage commands: `npx vitest run --coverage` (back-end) and
`npx ng test --watch=false --coverage` (front-end).

## 2. Requirements

| Requirement | Implemented | Where (file:line) | Covered by test |
| ----------- | ----------- | ----------------- | --------------- |
| FR-10 | yes | Client: `front-end/src/app/chat/chat-room/chat-room.html:58` (`(input)` → `typed()`), `front-end/src/app/streams/typing.ts:43` (`typingSignal$`, throttle at :58), `front-end/src/app/streams/chat-session.ts:72`, `front-end/src/app/chat/chat-room/chat-room.ts:60`. Server: `back-end/src/streams/chat-room.ts:87-88` (per-user `throttleTime(500)`), `back-end/src/domain/events.ts:62` | `FR-10: continuous typing sends at most one event per 500 ms`, `FR-10: typing in the message box sends a throttled typing event`, `FR-10: relays at most one typing notice per user every 500 ms` (+ 8 more, see §3) |
| FR-11 | yes | `front-end/src/app/streams/typing.ts:73` (`typists$`), `front-end/src/app/domain/indicator-text.ts:5`, `front-end/src/app/chat/chat-room/chat-room.html:43-52`, `back-end/src/streams/chat-room.ts:86-91`, `back-end/src/domain/events.ts:84` | `FR-11: shows one, two and three names in the strip`, `FR-11: three names`, `FR-11: relays a typing notice with the typist name to the other users` |
| FR-12 | yes | `front-end/src/app/streams/typing.ts:95` (`race(timer(2000), messageFrom(userId))`), `front-end/src/app/streams/typing.ts:58-62` (drop a pending typing event after sending) | `FR-12: a name disappears 2 s after the last typing event`, `FR-12: a name disappears immediately when that user sends a message`, `FR-12: a pending typing event is dropped when the message is sent first` |
| FR-13 | yes | `back-end/src/streams/chat-room.ts:39,75` (never echoed to the typist), `front-end/src/app/streams/typing.ts:86` (also filtered by own id) | `FR-13: never sends a typing notice back to the user who typed`, `FR-13: the user never sees their own name` |
| FR-14 | yes | `front-end/src/app/chat/chat-room/chat-room.css:134-136` (`.strip` fixed 32 px), `front-end/src/app/chat/chat-room/chat-room.html:43` (strip always rendered) | `FR-14: the strip keeps its 32 px height, empty or not` |
| FR-15 | yes | `front-end/src/app/streams/unread.ts:11-18`, `front-end/src/app/chat/chat-room/chat-room.ts:63-66` | `FR-15: counts messages from others while scrolled up`, `FR-15: does not count when within 40 px of the bottom` |
| FR-16 | yes | `front-end/src/app/domain/indicator-text.ts:21`, `front-end/src/app/chat/chat-room/chat-room.html:29-39`, `front-end/src/app/chat/chat-room/chat-room.css:109` | `FR-16: singular`, `FR-16: plural`, `FR-16: the pill is hidden at 0`, `FR-15 / FR-16: counts messages from others while scrolled up and shows the pill` |
| FR-17 | yes | `front-end/src/app/chat/chat-room/chat-room.ts:71-73`, `front-end/src/app/streams/scroll.ts:47` | `FR-17: clicking the pill scrolls smoothly to the bottom and resets the counter` |
| FR-18 | yes | `front-end/src/app/streams/unread.ts:31`, `front-end/src/app/chat/chat-room/chat-room.html:11` (`(scroll)`), `front-end/src/app/chat/chat-room/chat-room.ts:66` | `FR-18: scrolling to the bottom resets the counter`, `FR-18: passes only the scroll events that end at the bottom` |
| FR-19 | yes | `front-end/src/app/streams/unread.ts:17` | `FR-19: own messages never increase the counter` (stream and component) |

FR-01 to FR-08 still work. Both builds pass, and the real-socket smoke run
showed messages reaching both users and garbage frames being ignored.
Covered by tests: FR-02 (`FR-02 regression: blank text sends nothing, not even a message`),
FR-03 (`broadcasts messages to every user, including the sender, in arrival order`),
FR-08 (`FR-08: still rejects invalid frames and unknown types`, `FR-08: rejects malformed server typing events`, and the integration test).
FR-01 and FR-04 to FR-07 have no automated test; I did not change their code.

## 3. Tests

Back-end (Vitest, `back-end/test/`):

| Test name | File | Requirement | Type |
| --------- | ---- | ----------- | ---- |
| FR-11: relays a typing notice with the typist name to the other users | back-end/test/chat-room.test.ts | FR-11 | stream |
| FR-13: never sends a typing notice back to the user who typed | back-end/test/chat-room.test.ts | FR-13 | stream |
| FR-10: relays at most one typing notice per user every 500 ms | back-end/test/chat-room.test.ts | FR-10 | stream |
| FR-10: the 500 ms limit is per user, not shared by the room | back-end/test/chat-room.test.ts | FR-10 | stream |
| ignores typing events sent before joining | back-end/test/chat-room.test.ts | FR-11, FR-08 | stream |
| stops relaying typing notices once the typist disconnects | back-end/test/chat-room.test.ts | FR-11 | stream |
| broadcasts messages to every user, including the sender, in arrival order | back-end/test/chat-room.test.ts | FR-03, FR-12, FR-19 | stream |
| FR-10: parses a client typing event | back-end/test/events.test.ts | FR-10 | unit |
| FR-10: drops extra fields a client puts on a typing event (the server sets the name) | back-end/test/events.test.ts | FR-10, FR-08 | unit |
| FR-11: parses a server typing event | back-end/test/events.test.ts | FR-11 | unit |
| FR-08: rejects malformed server typing events | back-end/test/events.test.ts | FR-08 | unit |
| FR-08: still rejects invalid frames and unknown types | back-end/test/events.test.ts | FR-08 | unit |
| FR-11 / FR-13: relays typing to the others only, and survives invalid typing frames (FR-08) | back-end/test/server.integration.test.ts | FR-11, FR-13, FR-08 | other (integration, real WebSockets) |
| FR-10: a client flooding typing events is relayed at most once per 500 ms | back-end/test/server.integration.test.ts | FR-10 | other (integration, real WebSockets) |

Front-end (Angular `ng test` / Vitest + jsdom):

| Test name | File | Requirement | Type |
| --------- | ---- | ----------- | ---- |
| is empty when nobody is typing | front-end/src/app/domain/indicator-text.spec.ts | FR-11 | unit |
| FR-11: one name | front-end/src/app/domain/indicator-text.spec.ts | FR-11 | unit |
| FR-11: two names | front-end/src/app/domain/indicator-text.spec.ts | FR-11 | unit |
| FR-11: three names | front-end/src/app/domain/indicator-text.spec.ts | FR-11 | unit |
| FR-11: more than three names keeps the same pattern | front-end/src/app/domain/indicator-text.spec.ts | FR-11 | unit |
| nameSeparator puts " e " before the last name and ", " elsewhere | front-end/src/app/domain/indicator-text.spec.ts | FR-11 | unit |
| FR-16: singular | front-end/src/app/domain/indicator-text.spec.ts | FR-16 | unit |
| FR-16: plural | front-end/src/app/domain/indicator-text.spec.ts | FR-16 | unit |
| FR-10: the first keystroke is sent immediately | front-end/src/app/streams/typing.spec.ts | FR-10 | stream |
| FR-10: continuous typing sends at most one event per 500 ms | front-end/src/app/streams/typing.spec.ts | FR-10 | stream |
| FR-10 / FR-12: the last keystroke of a burst is reported at the end of the window | front-end/src/app/streams/typing.spec.ts | FR-10, FR-12 | stream |
| FR-12: a pending typing event is dropped when the message is sent first | front-end/src/app/streams/typing.spec.ts | FR-12 | stream |
| FR-10: typing again after sending still reports typing | front-end/src/app/streams/typing.spec.ts | FR-10 | stream |
| FR-11: lists other users typing, in the order they started | front-end/src/app/streams/typing.spec.ts | FR-11 | stream |
| FR-12: a name disappears 2 s after that user’s last typing event | front-end/src/app/streams/typing.spec.ts | FR-12 | stream |
| FR-12: a name disappears immediately when that user sends a message | front-end/src/app/streams/typing.spec.ts | FR-12 | stream |
| FR-12: a message from someone else does not clear the typist | front-end/src/app/streams/typing.spec.ts | FR-12 | stream |
| FR-13: the user never sees their own name | front-end/src/app/streams/typing.spec.ts | FR-13 | stream |
| FR-11: three typists, then each times out independently | front-end/src/app/streams/typing.spec.ts | FR-11, FR-12 | stream |
| keeps two users with the same name apart (by user id) | front-end/src/app/streams/typing.spec.ts | FR-11, FR-12 | stream |
| FR-15: counts messages from others while scrolled up | front-end/src/app/streams/unread.spec.ts | FR-15 | stream |
| FR-15: does not count while at the bottom | front-end/src/app/streams/unread.spec.ts | FR-15 | stream |
| FR-15: uses the scroll position measured when each message arrives | front-end/src/app/streams/unread.spec.ts | FR-15 | stream |
| FR-19: own messages never increase the counter | front-end/src/app/streams/unread.spec.ts | FR-19 | stream |
| FR-17 / FR-18: a reset sets it back to 0, and counting starts again | front-end/src/app/streams/unread.spec.ts | FR-17, FR-18 | stream |
| a reset at 0 emits nothing new | front-end/src/app/streams/unread.spec.ts | FR-17, FR-18 | stream |
| FR-18: passes only the scroll events that end at the bottom | front-end/src/app/streams/unread.spec.ts | FR-18 | stream |
| FR-10: keystrokes send typing events, at most one per 500 ms | front-end/src/app/streams/chat-session.spec.ts | FR-10 | stream |
| FR-12: sending a message cancels the pending typing event | front-end/src/app/streams/chat-session.spec.ts | FR-12 | stream |
| FR-02 regression: blank text sends nothing, not even a message | front-end/src/app/streams/chat-session.spec.ts | FR-02 | stream |
| FR-11 / FR-13: typists$ shows others after the join, never the user | front-end/src/app/streams/chat-session.spec.ts | FR-11, FR-13 | stream |
| FR-10: typing in the message box sends a throttled typing event | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-10 | component |
| FR-10: clearing the input after sending is not reported as typing | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-10, FR-02 | component |
| FR-11: shows one, two and three names in the strip | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-11 | component |
| FR-11: the indicator sits between the message list and the input | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-11 | component |
| FR-12: a name disappears 2 s after the last typing event | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-12 | component |
| FR-12: a name disappears immediately when that user sends a message | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-12 | component |
| FR-13: the user never sees their own name | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-13 | component |
| FR-14: the strip keeps its 32 px height, empty or not | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-14 | component |
| FR-15 / FR-16: counts messages from others while scrolled up and shows the pill | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-15, FR-16 | component |
| FR-15: does not count when within 40 px of the bottom | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-15 | component |
| FR-16: the pill is hidden at 0 | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-16 | component |
| FR-17: clicking the pill scrolls smoothly to the bottom and resets the counter | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-17 | component |
| FR-18: scrolling to the bottom resets the counter | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-18 | component |
| FR-19: own messages never increase the counter | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-19 | component |

## 4. Commands

In the order each command was first run. "Times" counts every run.

| # | Folder | Command | Result | Times |
| - | ------ | ------- | ------ | ----- |
| 1 | back-end | `npm install` | pass | 1 |
| 2 | front-end | `npm install` | pass | 1 |
| 3 | back-end | `npm install -D vitest@5.1.0 @vitest/coverage-v8@5.1.0` | pass | 1 |
| 4 | front-end | `npm install -D @vitest/coverage-v8@5.1.0` | pass | 1 |
| 5 | root | `cmp back-end/src/domain/events.ts front-end/src/app/domain/events.ts` | pass (identical) | 2 |
| 6 | back-end | `npx tsc --noEmit` | pass | 1 |
| 7 | back-end | `npx vitest run` | pass (14/14) | 2 |
| 8 | back-end | `npx tsc -p test/tsconfig.json` | pass | 2 |
| 9 | front-end | `npx ng build` | pass | 2 |
| 10 | front-end | `npx ng test --watch=false` | run 1: fail (5 failed / 40 passed); run 2: fail (same 5, rerun to list names); run 3: pass (45/45); run 4: fail (1 failed / 44 passed); runs 5–7: pass (45/45) | 7 (4 pass, 3 fail) |
| 11 | back-end | `npx vitest run --coverage` | pass (14/14, 89.24% lines overall) | 1 |
| 12 | front-end | `npx ng test --watch=false --coverage` | pass (45/45, 100% lines) | 1 |
| 13 | front-end | `npx prettier --check "src/app/**/*.ts"` | fail (9 files flagged, including untouched base file `app.config.ts`) | 1 |
| 14 | front-end | `git show HEAD:<file> \| npx prettier --stdin-filepath <file> --check` (base `chat-room.ts`, `chat-session.ts`) | fail (base versions were not prettier-formatted either) | 2 |
| 15 | front-end | `npx prettier --write` on the 7 new front-end files | pass | 1 |
| 16 | back-end | `npm run typecheck` | pass | 1 |
| 17 | back-end | `npm run build` | pass | 1 |
| 18 | back-end | `PORT=3917 npx tsx src/server.ts` + a Node `ws` script (Ana, Bruno: garbage frame, typing, message) | pass: Bruno got `joined`, `typing` (Ana), `message`; Ana got `joined`, `message` only | 1 |
| 19 | root | `git add -N back-end front-end && git diff --stat` | pass | 1 |

## 5. Problems

| Problem | Fix |
| ------- | --- |
| `node_modules` was missing in both folders, and the back-end had no test runner. | Ran `npm install` in both folders. Added `vitest`/`@vitest/coverage-v8` 5.1.0 to the back-end, the same version the front-end already used. Added `@vitest/coverage-v8` to the front-end for `--coverage`. |
| First `ng test`: 5 `typists$` marble tests failed (e.g. `keeps two users with the same name apart (by user id)`: received an extra `[]` at frame 0). The input events started at frame 0, the same frame as the stream's initial `startWith([])`. This was a mistake in the test expectations, not in the code. | Moved the input events one frame later (`-a…`) and added the initial `[]` to the expected marbles. |
| After I tightened the FR-19 component test, it failed: `expected '' to be '1 nova mensagem'`. The user's own message had auto-scrolled the list to the bottom (FR-06), so Ana's next message was correctly not counted. | The test now scrolls up again before Ana's message. |
| `prettier --check` flagged 9 files, including untouched base files. | I checked that the base versions of the modified files were not formatted either. I only ran prettier on the new files, so the diffs to base files stay small. |
| One read-only `grep` command got no verdict from the auto-mode classifier. | Re-issued the same command; it ran. |

## 6. Changes to existing code

| File | Why |
| ---- | --- |
| `back-end/src/domain/events.ts` and `front-end/src/app/domain/events.ts` | New `typing` event both ways, plus parsing (FR-10, FR-11). The copies are still identical (`cmp` passes). |
| `back-end/src/streams/chat-room.ts` | The room stream now carries `message` and `typing` events (`RoomEvent`). Typing is throttled per user (FR-10), relayed to the room (FR-11), and never echoed to the typist (FR-13). The message path is unchanged apart from being wrapped as a `ServerEvent` before it enters the room instead of after. |
| `back-end/package.json`, `package-lock.json` | Added `vitest` and `@vitest/coverage-v8`, plus `test`/`coverage` scripts. |
| `back-end/.gitignore` | Ignore `coverage/`. |
| `front-end/src/app/streams/chat-session.ts` | Added `typed()`, `typingSent$` and `typists$` to `ChatSession`. Existing members are unchanged. |
| `front-end/src/app/streams/scroll.ts` | Added `smoothScrollToBottom` (FR-17). Existing functions are unchanged. |
| `front-end/src/app/chat/chat-room/chat-room.ts` | Subscribes `typingSent$`, builds `unread$`, adds `jumpToBottom()`. The existing scroll and clear-input pipelines are unchanged. |
| `front-end/src/app/chat/chat-room/chat-room.html` | Wrapped the list in `.list-wrap` (for the pill), added the `(scroll)` binding, the pill, the typing indicator inside the existing 32 px strip, and `(input)` on the message box. |
| `front-end/src/app/chat/chat-room/chat-room.css` | Styles for `.list-wrap`, `.pill`, `.typing` and the dots animation. `.strip` keeps `height: 32px` and is now a flex row. |
| `front-end/package.json`, `package-lock.json` | Added `@vitest/coverage-v8`. |

## 7. Known gaps

- **FR-12 timing.** The 2 s count starts when the typing *event* arrives, not
  at the keystroke itself. Typing events are throttled with a trailing edge,
  so in practice a name disappears 2.0–2.5 s after the last keystroke, plus
  network latency. The server throttle keeps only the first event in each
  window. If network jitter makes two client events arrive less than 500 ms
  apart, the second is dropped, and the name can then disappear up to about
  0.5 s early.
- **Not tested in a real browser.** I did not run the 3-window manual test or
  any visual check against `docs/design/*.png`. jsdom has no layout, so the
  pill position, the dots animation, the real smooth scroll and "the layout
  doesn't jump" (FR-14) were only checked through the computed `height: 32px`
  and the DOM structure.
- **FR-17/FR-18 while scrolling.** A message that arrives during the smooth
  scroll started by the pill is counted. It is reset when the scroll reaches
  the bottom (FR-18). In a real browser, the FR-06 auto-scroll after an own
  message also fires a scroll event that resets the counter. jsdom fires no
  such event, so this path is not tested automatically.
- **Coverage scope.** The front-end report only includes files the tests
  load: `app.ts`, `join.ts` and `chat-socket.service.ts` are not measured.
  The back-end `server.ts` has 0% coverage.
- **No new tests for FR-01, FR-04 to FR-07.** The base app had no tests and I
  did not add regression tests for code I did not change.
- **Not in scope:** the "3 pessoas online" header from the mockups (listed
  as out of scope in the README).
- **README not updated.** `README.md` still says FR-10 to FR-19 and tests are
  out of scope.
- **Memory.** `typists$` keeps one `groupBy` group per user id seen during a
  session. This is negligible for a chat room, but it is never freed until
  the session ends.
