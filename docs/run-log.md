# Run log – FR-10 to FR-19

Branch `run/A2`, starting from commit `319dc71`. All numbers below come from
command output in this run. Nothing is estimated.

## 1. Summary

| Metric | Back-end | Front-end |
| --- | --- | --- |
| Files created | 5 (`src/domain/events.test.ts`, `src/streams/chat-room.test.ts`, `src/streams/socket.test.ts`, `tsconfig.build.json`, `vitest.config.ts`) | 6 (`streams/typing.ts`, `streams/unread.ts`, `streams/typing.spec.ts`, `streams/unread.spec.ts`, `streams/chat-session.spec.ts`, `chat/chat-room/chat-room.spec.ts`) |
| Files modified | 5 (`.gitignore`, `package.json`, `package-lock.json`, `src/domain/events.ts`, `src/streams/chat-room.ts`) | 8 (`package.json`, `package-lock.json`, `domain/events.ts`, `streams/chat-session.ts`, `streams/scroll.ts`, `chat-room.ts`, `chat-room.html`, `chat-room.css`) |
| Lines added (`git diff --stat`) | 1924 (351 excluding `package-lock.json`) | 991 (830 excluding `package-lock.json`) |
| Lines removed (`git diff --stat`) | 219 (12 excluding `package-lock.json`) | 24 (24 excluding `package-lock.json`) |
| Tests added | 16 | 35 |
| Tests passing | 16 | 35 |
| Tests failing | 0 | 0 |
| Line coverage, new code | **100 %** (15/15 new or changed executable lines) | **98.85 %** (86/87 new or changed executable lines; uncovered: `streams/scroll.ts:20`) |
| Line coverage, whole suite (tool total) | 97.72 % (86/88), `npx vitest run --coverage` | 99.33 % (150/151), `ng test --watch=false --coverage` |

Notes:

- The diff counts were taken with `git add -N back-end front-end` (so new files are
  included), then `git diff --stat -- <folder>`, and then `git reset` to undo the
  `add -N`. They were measured before `docs/` was written.
- Outside the two folders: `README.md` was modified (+17 −9), and `docs/testing.md` and
  `docs/run-log.md` were created.
- "New code" coverage: from the coverage reports (back-end `coverage-final.json`,
  front-end `clover.xml`), I kept the statement lines whose numbers were added or changed
  in `git diff -U0`, plus every line of new files. The two scripts are in the
  session scratchpad and are not part of the repo.
- Back-end coverage excludes `src/server.ts`, which is process wiring with
  `process.exit`. That file was not changed.

## 2. Requirements

| Requirement | Implemented | Where (file:line) | Covered by test |
| --- | --- | --- | --- |
| FR-10 | yes | `front-end/src/app/streams/typing.ts:40` (`typingNotices$`, `throttleTime` at :42), `front-end/src/app/chat/chat-room/chat-room.html:57` (`(input)` → `keystroke()`), `back-end/src/streams/chat-room.ts:85` (server throttle) | `typingNotices$ (FR-10) › sends at most one typing notice per 500 ms…`, `chatSession › FR-10: keystrokes send typing notices…`, `ChatRoom › typing indicator › FR-10: …`, `chatRoom – typing indicator › FR-10: relays at most one typing event per 500 ms per user`, `› FR-10: throttles each user independently` |
| FR-11 | yes | `front-end/src/app/streams/typing.ts:54` (`typingNames$`), `:110` (`typingSegments`), `front-end/src/app/chat/chat-room/chat-room.html:43` (strip between list and composer), `back-end/src/domain/events.ts:64,86` (protocol) | `typingNames$ › FR-11: …` (2 tests), `typingLabel / typingSegments (FR-11) › …` (3), `ChatRoom › typing indicator › FR-11: …` (2), `chatRoom – typing indicator › FR-11: typing events carry the typist id and name…`, `server over real WebSockets › FR-11 / FR-13: …` |
| FR-12 | yes | `front-end/src/app/streams/typing.ts:72` (`race(timer(2000), messageFrom$(userId))`) | `typingNames$ › FR-12: …` (3 tests), `chatSession › FR-11 / FR-12: …`, `ChatRoom › typing indicator › FR-12: …` (2), `chatRoom – typing indicator › FR-12: a message after typing is still delivered…` |
| FR-13 | yes | `back-end/src/streams/chat-room.ts:35,71` (`isEcho` filter), `front-end/src/app/streams/typing.ts:65` (client-side guard) | `chatRoom – typing indicator › FR-13: never echoes typing events back to the typist`, `server over real WebSockets › FR-11 / FR-13: …`, `typingNames$ › FR-13: …`, `ChatRoom › typing indicator › FR-13: …` |
| FR-14 | yes | `front-end/src/app/chat/chat-room/chat-room.css:109` (`.typing { height: 32px }`), `chat-room.html:43` (always rendered) | `ChatRoom › typing indicator › FR-14: the indicator strip is always rendered, even when empty`. The pixel height is checked manually only. |
| FR-15 | yes | `front-end/src/app/streams/unread.ts:14` (`unreadCount$`, filter at :22), `front-end/src/app/chat/chat-room/chat-room.ts:83` | `unreadCount$ › FR-15: …` (2 tests), `ChatRoom › unread counter › FR-15 / FR-16: …`, `› FR-15: does not count when the user is at the bottom` |
| FR-16 | yes | `front-end/src/app/streams/unread.ts:34` (`unreadLabel`), `front-end/src/app/chat/chat-room/chat-room.html:31` (pill, `@if (unread() > 0)`), `chat-room.css:162` (`.unread`, bottom center) | `unreadLabel (FR-16) › uses singular for 1 and plural otherwise`, `ChatRoom › unread counter › FR-15 / FR-16: …` |
| FR-17 | yes | `front-end/src/app/chat/chat-room/chat-room.ts:78` (`pillClicked$` → `scrollToBottomSmoothly`), `front-end/src/app/streams/scroll.ts:16` | `unreadCount$ › FR-17 / FR-18: …`, `ChatRoom › unread counter › FR-17: clicking the pill scrolls smoothly…` |
| FR-18 | yes | `front-end/src/app/chat/chat-room/chat-room.ts:80` (`scrolled$` filtered by `isNearBottom`), `front-end/src/app/streams/unread.ts:27` (reset) | `unreadCount$ › FR-17 / FR-18: …`, `ChatRoom › unread counter › FR-18: reaching the bottom by scrolling resets the counter` |
| FR-19 | yes | `front-end/src/app/streams/unread.ts:22` (`!message.own`) | `unreadCount$ › FR-19: …`, `ChatRoom › unread counter › FR-19: …` |

## 3. Tests

| Test name | File | Requirement | Type |
| --- | --- | --- | --- |
| parseClientEvent – typing (FR-10) › accepts a typing event | back-end/src/domain/events.test.ts | FR-10 | unit |
| parseClientEvent – typing (FR-10) › drops extra fields a client tries to smuggle in (FR-08) | back-end/src/domain/events.test.ts | FR-10, FR-08 | unit |
| parseClientEvent – typing (FR-10) › still rejects non-objects and unknown types (FR-08) | back-end/src/domain/events.test.ts | FR-08 | unit |
| parseServerEvent – typing (FR-11) › accepts a typing event with userId and name | back-end/src/domain/events.test.ts | FR-11 | unit |
| parseServerEvent – typing (FR-11) › rejects a typing event without userId or name | back-end/src/domain/events.test.ts | FR-11, FR-08 | unit |
| chatRoom – typing indicator › FR-10: relays at most one typing event per 500 ms per user | back-end/src/streams/chat-room.test.ts | FR-10 | stream |
| chatRoom – typing indicator › FR-10: throttles each user independently | back-end/src/streams/chat-room.test.ts | FR-10 | stream |
| chatRoom – typing indicator › FR-11: typing events carry the typist id and name to the other users | back-end/src/streams/chat-room.test.ts | FR-11 | stream |
| chatRoom – typing indicator › FR-13: never echoes typing events back to the typist | back-end/src/streams/chat-room.test.ts | FR-13 | stream |
| chatRoom – typing indicator › ignores typing events sent before joining (FR-08) | back-end/src/streams/chat-room.test.ts | FR-08 | stream |
| chatRoom – typing indicator › FR-12: a message after typing is still delivered to everyone, in order | back-end/src/streams/chat-room.test.ts | FR-12, FR-03 | stream |
| chatRoom – typing indicator › stops relaying a user typing once their connection closes | back-end/src/streams/chat-room.test.ts | FR-10, FR-08 | stream |
| chatRoom – base app still works › FR-03: broadcasts each message to every user, including the sender | back-end/src/streams/chat-room.test.ts | FR-03 (FR-15/19 prerequisite) | stream |
| chatRoom – base app still works › FR-07: a late joiner gets no history | back-end/src/streams/chat-room.test.ts | FR-07 | stream |
| server over real WebSockets › FR-11 / FR-13: relays typing to the others, not back to the typist | back-end/src/streams/socket.test.ts | FR-11, FR-13 | other (integration, real `ws`) |
| server over real WebSockets › FR-08: invalid frames are ignored and the server keeps working | back-end/src/streams/socket.test.ts | FR-08, FR-02 | other (integration, real `ws`) |
| typingNotices$ (FR-10) › sends at most one typing notice per 500 ms, the first one immediately | front-end/src/app/streams/typing.spec.ts | FR-10 | stream |
| typingNotices$ (FR-10) › calls send once per notice | front-end/src/app/streams/typing.spec.ts | FR-10 | stream |
| typingNames$ › FR-11: lists other typists in the order they started typing | front-end/src/app/streams/typing.spec.ts | FR-11 | stream |
| typingNames$ › FR-12: removes a name 2 s after that user's last typing event | front-end/src/app/streams/typing.spec.ts | FR-12 | stream |
| typingNames$ › FR-12: removes a name immediately when that user sends a message | front-end/src/app/streams/typing.spec.ts | FR-12 | stream |
| typingNames$ › FR-12: a message from someone else does not remove a typist | front-end/src/app/streams/typing.spec.ts | FR-12 | stream |
| typingNames$ › FR-13: never includes the user's own name, even if the server echoes it | front-end/src/app/streams/typing.spec.ts | FR-13 | stream |
| typingNames$ › FR-11: three typists | front-end/src/app/streams/typing.spec.ts | FR-11 | stream |
| typingNames$ › waits for the join acknowledgement before showing anyone | front-end/src/app/streams/typing.spec.ts | FR-11, FR-13 | stream |
| typingLabel / typingSegments (FR-11) › formats one, two and three names | front-end/src/app/streams/typing.spec.ts | FR-11 | unit |
| typingLabel / typingSegments (FR-11) › is empty when nobody is typing | front-end/src/app/streams/typing.spec.ts | FR-11, FR-14 | unit |
| typingLabel / typingSegments (FR-11) › marks the names (rendered in bold) apart from the connecting words | front-end/src/app/streams/typing.spec.ts | FR-11 | unit |
| unreadCount$ › FR-15: counts others' messages while scrolled up | front-end/src/app/streams/unread.spec.ts | FR-15 | stream |
| unreadCount$ › FR-15: does not count while near the bottom | front-end/src/app/streams/unread.spec.ts | FR-15 | stream |
| unreadCount$ › FR-19: own messages never increase the counter | front-end/src/app/streams/unread.spec.ts | FR-19 | stream |
| unreadCount$ › FR-17 / FR-18: a reset (pill click or reaching the bottom) sets it back to 0 | front-end/src/app/streams/unread.spec.ts | FR-17, FR-18 | stream |
| unreadCount$ › does not re-emit 0 for a reset at 0 | front-end/src/app/streams/unread.spec.ts | FR-16 | stream |
| unreadLabel (FR-16) › uses singular for 1 and plural otherwise | front-end/src/app/streams/unread.spec.ts | FR-16 | unit |
| chatSession › FR-10: keystrokes send typing notices, at most one per 500 ms | front-end/src/app/streams/chat-session.spec.ts | FR-10 | stream (fake timers) |
| chatSession › FR-11 / FR-12: exposes the other typists and drops them when they send | front-end/src/app/streams/chat-session.spec.ts | FR-11, FR-12 | stream |
| chatSession › FR-02 / FR-03 still work: submit sends trimmed text and messages are listed | front-end/src/app/streams/chat-session.spec.ts | FR-02, FR-03, FR-04 | stream |
| ChatRoom › typing indicator › FR-10: typing in the message box sends a typing event | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-10 | component |
| ChatRoom › typing indicator › FR-11: shows other typists between the list and the input, names in bold | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-11 | component |
| ChatRoom › typing indicator › FR-11: three typists | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-11 | component |
| ChatRoom › typing indicator › FR-12: a name disappears when that user sends a message | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-12 | component |
| ChatRoom › typing indicator › FR-12: a name disappears 2 s after the last typing event | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-12 | component (fake timers) |
| ChatRoom › typing indicator › FR-13: never shows the user's own name | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-13 | component |
| ChatRoom › typing indicator › FR-14: the indicator strip is always rendered, even when empty | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-14 | component |
| ChatRoom › unread counter › FR-15 / FR-16: counts others' messages while scrolled up and shows the pill | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-15, FR-16 | component |
| ChatRoom › unread counter › FR-15: does not count when the user is at the bottom | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-15 | component |
| ChatRoom › unread counter › FR-17: clicking the pill scrolls smoothly to the bottom and resets the counter | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-17 | component |
| ChatRoom › unread counter › FR-18: reaching the bottom by scrolling resets the counter | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-18 | component |
| ChatRoom › unread counter › FR-19: own messages never increase the counter | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-19 | component |
| ChatRoom › base app still works › FR-02: Enviar sends the trimmed text and clears the input | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-02 | component |
| ChatRoom › base app still works › FR-04: own messages are marked own, others show the author | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-04 | component |

Totals: back-end 16, front-end 35.

## 4. Commands

In the order they were run. Commands that only read files or git state are left out
(`cat`, `grep`, `git status`, `git diff`, `npx vitest --version`).

| # | Folder | Command | Result | Times run |
| --- | --- | --- | --- | --- |
| 1 | back-end | `npm install` | pass | 1 |
| 2 | front-end | `npm install` | pass | 1 |
| 3 | back-end | `npm install -D vitest@5.1.0 @vitest/coverage-v8@5.1.0` | pass | 1 |
| 4 | front-end | `npm install -D @vitest/coverage-v8@5.1.0` | pass | 1 |
| 5 | back-end | `npx vitest run` | pass (16/16) | 1 |
| 6 | back-end | `npm run typecheck` | pass | 2 (here and at step 13) |
| 7 | front-end | `npx ng build` | pass | 2 (here and at step 16) |
| 8 | front-end | `npx ng test --watch=false` | fail (34/35: a wrong marble assertion in a test), then pass (35/35) after the fix at step 9 | 2 |
| 9 | front-end | `npx ng test --watch=false --no-color` | fail: `Error: Unknown argument: color`. Used `NO_COLOR=1` instead | 1 |
| 10 | back-end | `npx vitest run --coverage` | pass (16/16, 97.72 % lines) | 2 (second run only to add the `json` reporter for the new-code calculation) |
| 11 | front-end | `npx ng test --watch=false --coverage` | pass (35/35, 99.33 % lines) | 1 |
| 12 | (root) | new-code coverage script (`python3 newcov.py`, scratchpad) | pass (BE 15/15, FE 86/87) | 1 |
| 13 | back-end | `npm run typecheck` | pass | (counted at step 6) |
| 14 | back-end | `npm run build` (`tsc -p tsconfig.build.json`) | pass, 0 test files in `dist/` | 1 |
| 15 | (root) | `cmp back-end/src/domain/events.ts front-end/src/app/domain/events.ts` | pass (identical) | 1 |
| 16 | front-end | `npx tsc -p tsconfig.spec.json --noEmit` | pass | 1 |
| 17 | front-end | `npx ng build` | pass, no warnings | (counted at step 7) |
| 18 | back-end | smoke test: `PORT=3123 npx tsx src/server.ts` + a Node `ws` script with Ana and Bruno | pass. Ana sent 5 typing frames 50 ms apart and Bruno got `joined:Bruno,typing:Ana,message`. Ana got `joined,message` | 1 |
| 19 | back-end | `npm test` (final check) | pass (16/16) | 1 |
| 20 | front-end | `npx ng test --watch=false` (final check) | pass (35/35) | 1 (in addition to the 2 at step 8) |

## 5. Problems

| Problem | Fix |
| --- | --- |
| First front-end test run: `unreadCount$ › does not re-emit 0 for a reset at 0` failed with expected `"0"`, received `0`. In a marble diagram without a values map, `'0'` means the string `"0"`. | This was a bug in the test, not the code. Changed it to `toBe('0', { 0: 0 })`. |
| `ng test --no-color` was rejected with `Error: Unknown argument: color`. | Set the `NO_COLOR=1` environment variable instead. |
| Written before running, not hit: marble frames where a keystroke or reset lands exactly on a throttle boundary or on the same frame as another hot emission have an ambiguous order. | Moved those events off the boundary (for example keystrokes at 499 and 650 ms instead of 500 ms) so the tests are deterministic. |
| Written before running, not hit: `viewChild.required` is not available in `ngOnInit`, so `fromEvent(list, 'scroll')` could not be created there. | The template pushes `(scroll)` and `(click)` into `scrolled$` / `pillClicked$` Subjects, and the pipelines are built from those. |
| Back-end `tsc` build would have compiled `*.test.ts` into `dist/`. | Added `tsconfig.build.json`, which excludes tests, and pointed `npm run build` at it. `npm run typecheck` still checks the tests. |

## 6. Changes to existing code

| File | Why |
| --- | --- |
| `back-end/src/domain/events.ts` and `front-end/src/app/domain/events.ts` (kept identical) | New `typing` events in both directions, `TYPING_THROTTLE_MS` (500) and `TYPING_TIMEOUT_MS` (2000) constants, and parser cases. A client `typing` frame never carries a name or id: the server adds them. |
| `back-end/src/streams/chat-room.ts` | The room Subject now carries messages and typing notices (`RoomEvent`). It adds a per-session typing stream with `throttleTime(500)`, and an outbound filter so typists never get their own notice. The message path is unchanged apart from being wrapped as a `RoomEvent`. |
| `back-end/package.json` | Added `test` and `test:coverage` scripts and the `vitest` and `@vitest/coverage-v8` dev dependencies. `build` now uses `tsconfig.build.json`. |
| `back-end/.gitignore` | Ignore `coverage/`. |
| `front-end/src/app/streams/chat-session.ts` | `ChatSession` gains `keystroke()`, `typingSent$` and `typingNames$`. The existing members are unchanged. |
| `front-end/src/app/streams/scroll.ts` | Added `scrollToBottomSmoothly` for the pill (FR-17). |
| `front-end/src/app/chat/chat-room/chat-room.ts` | Binds the typing and unread pipelines with `toSignal`, as the existing scroll pipeline does, and adds the `scrolled$` and `pillClicked$` streams. |
| `front-end/src/app/chat/chat-room/chat-room.html` | The empty `.strip` became the `.typing` indicator. The list is wrapped in `.list-area` so the pill can be absolutely positioned at its bottom center. Added `(input)` and `(scroll)` bindings. |
| `front-end/src/app/chat/chat-room/chat-room.css` | `.strip` was replaced by `.typing` (still a fixed 32 px). Added `.list-area`, the dots animation and the `.unread` pill. The component CSS is 2980 bytes, under the 4 kB budget. |
| `front-end/package.json` | Added the `@vitest/coverage-v8` dev dependency, needed for `ng test --coverage`. |
| `README.md` | Removed the "not implemented" wording. Documented the new protocol events, files, test commands and where each requirement lives. |

## 7. Known gaps

- **Manual 3-window test not run.** I had no browser in this run. The test is written
  in `docs/testing.md` but nobody has executed it, so the visual match with
  `typing.png` and `unread.png` (dots, bold names, pill position and shadow) is
  untested. The server side of it was checked with real sockets (step 18).
- **FR-14 pixel height and FR-17 smoothness** are not checked automatically,
  because jsdom has no layout or scroll animation. The tests only check that the strip
  is always in the DOM and that `scrollTo` gets `behavior: 'smooth'`.
- **`streams/scroll.ts:20`** (the fallback for browsers without `Element.scrollTo`)
  is not covered.
- **Typing right after sending:** a keystroke less than 500 ms after the previous typing
  notice is dropped by the throttle, even if a message was sent in between. The name
  then reappears on the next keystroke after the window. This follows FR-10 as written.
- **More than 3 typists** are shown as "A, B, C e D estão digitando…". The
  requirements only define up to three, so the longer form is my extension.
- Not in scope and unchanged: the "pessoas online" count in the mockups, reconnection
  and persistence.
- Nothing has been committed. All changes are in the working tree of `run/A2`.
