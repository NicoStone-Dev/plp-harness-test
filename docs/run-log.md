# Run log – FR-10 to FR-19

Run on branch `run/A3` (base commit `319dc71`), 2026-11-22, Node v24.15.0,
npm 11.12.1, Angular 22.2.6, RxJS 7.8.2, vitest 5.1.0. Nothing was committed.

## 1. Summary

The numbers come from `git diff --stat` / `git diff --numstat` against `HEAD`,
after `git add -N back-end front-end` so that new files are counted. They were
taken before `docs/testing.md` and this file were written, so `docs/` is not
included. Lines are shown as **total (without `package-lock.json`)**.

| Metric | Back-end | Front-end |
| ------ | -------- | --------- |
| Files created | 5 (`src/streams/typing.ts`, `test/events.spec.ts`, `test/typing.spec.ts`, `test/chat-room.spec.ts`, `vitest.config.ts`) | 7 (`domain/indicators.ts`, `streams/typing.ts`, `streams/unread.ts`, and 4 `*.spec.ts`) |
| Files modified | 5 (`.gitignore`, `package.json`, `package-lock.json`, `src/domain/events.ts`, `src/streams/chat-room.ts`) | 9 (`package.json`, `package-lock.json`, `chat-room.ts/.html/.css`, `domain/events.ts`, `streams/chat-session.ts`, `streams/scroll.ts`) |
| Lines added | 1862 (289) | 1079 (918) |
| Lines removed | 217 (10) | 24 (24) |
| Tests added | 16 | 42 |
| Tests passing | 16 | 42 |
| Tests failing | 0 | 0 |
| Line coverage, new code | 100% (14/14 instrumented added lines) | 100% (87/87 instrumented added lines) |
| Line coverage, whole folder (for reference) | 56.84% (54/95). `server.ts` and `socket.ts` are 0% | 100% (151/151) |

How the new-code coverage was computed: back-end `npx vitest run --coverage`
(with the `json` reporter added) and front-end `ng test --watch=false --coverage`
both write `coverage-final.json`. A scratch script took every statement whose
start line is a line added in `git diff -U0 HEAD`, or any line of a new file,
and counted it as covered when its hit count was > 0. Spec files were excluded.
One caveat: the front-end `domain/events.ts` reported 0/0 instrumented new
lines. Its new `typing` parser branches are not run by any front-end test (see
Known gaps). The identical back-end copy is tested.

## 2. Requirements

| Requirement | Implemented | Where (file:line) | Covered by test |
| ----------- | ----------- | ----------------- | --------------- |
| FR-10 | yes | Client: `front-end/src/app/streams/typing.ts:39` (`typingSignal$`, 500 ms leading+trailing throttle), `front-end/src/app/streams/chat-session.ts:80`, `front-end/src/app/chat/chat-room/chat-room.html:61` (`(input)`). Server: `back-end/src/streams/typing.ts:11` (`throttleTyping`), `back-end/src/streams/chat-room.ts:82`, `back-end/src/domain/events.ts:62` | `typingSignal$ (FR-10) › …` (2 tests), `chatSession: typing › FR-10: …`, `ChatRoom › typing indicator › FR-10: …` (2 tests), `throttleTyping (FR-10) › …` (3 tests), `chatRoom › FR-10: …` (2 tests), `parseClientEvent › FR-10: …` (2 tests) |
| FR-11 | yes | `front-end/src/app/domain/indicators.ts:11` (`typingParts`), `front-end/src/app/chat/chat-room/chat-room.html:42`, `front-end/src/app/streams/typing.ts:58` (`typingNames$`), `back-end/src/streams/chat-room.ts:82`, `back-end/src/domain/events.ts:84` | `typingText (FR-11) › …` (5 tests), `typingNames$ › FR-11: …` (2 tests), `ChatRoom › typing indicator › FR-11: shows one, two and three names between the list and the input`, `chatRoom › FR-11 / FR-13: …`, `parseServerEvent › FR-11: …` |
| FR-12 | yes | `front-end/src/app/streams/typing.ts:72` (2 s `timer` or a message from that author, restarted by `switchMap`), `front-end/src/app/streams/typing.ts:42` (a sent message drops the pending trailing typing event), `back-end/src/streams/typing.ts:14` (a message resets the server throttle) | `typingNames$ › FR-12: …` (2 tests) and `… FR-11: shows a typist, and FR-12: hides them 2 s after …`, `chatSession: typing › FR-12: …`, `ChatRoom › typing indicator › FR-12: …` (2 tests), `throttleTyping (FR-10) › a sent message restarts the window, …`, `chatRoom › FR-12: …` |
| FR-13 | yes | Server: `back-end/src/streams/chat-room.ts:36` and `:71` (`isForUser`, the typist is not sent their own notice). Client: `front-end/src/app/streams/typing.ts:64` | `chatRoom › FR-11 / FR-13: …`, `typingNames$ › FR-13: never lists the own user`, `chatSession: typing › FR-11 / FR-13: …`, `ChatRoom › typing indicator › FR-13: never shows the own name` |
| FR-14 | yes | `front-end/src/app/chat/chat-room/chat-room.css:140` (`.strip`, `flex: none; height: 32px`), `front-end/src/app/chat/chat-room/chat-room.html:42` (the strip is always rendered, and only its content is conditional) | `ChatRoom › typing indicator › FR-14: the strip is always in the layout, with a fixed 32 px height` |
| FR-15 | yes | `front-end/src/app/streams/unread.ts:17`, `front-end/src/app/chat/chat-room/chat-room.ts:77` (`isNearBottom` measured before render, 40 px) | `unreadCount$ › FR-15: …` (2 tests), `ChatRoom › unread counter › FR-15: …` (3 tests) |
| FR-16 | yes | `front-end/src/app/domain/indicators.ts:29` (`unreadLabel`), `front-end/src/app/chat/chat-room/chat-room.html:29` (`@if (unread() > 0)`), `front-end/src/app/chat/chat-room/chat-room.css:109` (`.pill`, bottom center) | `unreadLabel (FR-16) › …` (2 tests), `unreadCount$ › starts at 0 (FR-16: pill hidden)`, `ChatRoom › unread counter › FR-16: the pill is hidden at 0`, `… FR-15 / FR-16: …` |
| FR-17 | yes | `front-end/src/app/chat/chat-room/chat-room.ts:72` (smooth scroll on click), `:77` (the click resets the counter), `front-end/src/app/streams/scroll.ts:16` (`scrollToBottomSmoothly`) | `ChatRoom › unread counter › FR-17: clicking the pill scrolls smoothly to the bottom and resets the counter`, `unreadCount$ › FR-17 / FR-18: …` |
| FR-18 | yes | `front-end/src/app/chat/chat-room/chat-room.ts:75` (`reachedBottom$`, scroll events that end near the bottom), `front-end/src/app/chat/chat-room/chat-room.html:12` (`(scroll)`) | `ChatRoom › unread counter › FR-18: …`, `… FR-06: an own message still scrolls to the bottom, which then clears the counter (FR-18)`, `unreadCount$ › FR-17 / FR-18: …`, `unreadCount$ › a reset at 0 emits nothing new` |
| FR-19 | yes | `front-end/src/app/streams/unread.ts:17` (`!message.own`) | `unreadCount$ › FR-19: own messages never add to the counter`, `ChatRoom › unread counter › FR-19: own messages never increase the counter` |
| FR-01 to FR-08 (regression) | unchanged | – | `parseClientEvent › FR-01 / FR-02: still parses join and message`, `parseClientEvent › FR-08: still rejects invalid frames`, `chatRoom › FR-03 / FR-07: …`, `chatRoom › FR-08: ignores typing before join`, `chatSession: typing › FR-02: …`, `chatSession: typing › FR-08: …`, `ChatRoom › unread counter › FR-05: …` and `… FR-06: …`. FR-01 (join screen) and FR-04 (bubble side and colour) have no automated tests (baseline code not touched) |

## 3. Tests

Back-end paths are relative to `back-end/`. Front-end paths are relative to `front-end/src/app/`.

| Test name | File | Requirement | Type |
| --------- | ---- | ----------- | ---- |
| parseClientEvent › FR-10: accepts a typing event | `test/events.spec.ts` | FR-10 | unit |
| parseClientEvent › FR-10: drops extra fields from a typing event | `test/events.spec.ts` | FR-10 | unit |
| parseClientEvent › FR-08: still rejects invalid frames | `test/events.spec.ts` | FR-08 | unit |
| parseClientEvent › FR-01 / FR-02: still parses join and message | `test/events.spec.ts` | FR-01, FR-02 | unit |
| parseServerEvent › FR-11: accepts a typing event with userId and name | `test/events.spec.ts` | FR-11 | unit |
| parseServerEvent › FR-08: rejects a typing event without userId or name | `test/events.spec.ts` | FR-08 | unit |
| throttleTyping (FR-10) › relays the first keystroke at once and at most one per 500 ms | `test/typing.spec.ts` | FR-10 | stream |
| throttleTyping (FR-10) › relays a keystroke again after a 500 ms window has passed | `test/typing.spec.ts` | FR-10 | stream |
| throttleTyping (FR-10) › a sent message restarts the window, so the next keystroke is relayed at once | `test/typing.spec.ts` | FR-10, FR-12 | stream |
| chatRoom › FR-11 / FR-13: relays a typing notice to the other users, never to the typist | `test/chat-room.spec.ts` | FR-11, FR-13 | stream |
| chatRoom › FR-10: relays at most one typing notice per 500 ms per user | `test/chat-room.spec.ts` | FR-10 | stream |
| chatRoom › FR-10: throttles each user separately | `test/chat-room.spec.ts` | FR-10 | stream |
| chatRoom › FR-12: after a message, the next keystroke is relayed at once | `test/chat-room.spec.ts` | FR-12 | stream |
| chatRoom › FR-08: ignores typing before join | `test/chat-room.spec.ts` | FR-08 | stream |
| chatRoom › stops relaying typing from a client that disconnected | `test/chat-room.spec.ts` | FR-12 | stream |
| chatRoom › FR-03 / FR-07: messages still reach every joined user in order, without history | `test/chat-room.spec.ts` | FR-03, FR-07 | stream |
| typingText (FR-11) › is empty when nobody is typing | `domain/indicators.spec.ts` | FR-11 | unit |
| typingText (FR-11) › one name | `domain/indicators.spec.ts` | FR-11 | unit |
| typingText (FR-11) › two names | `domain/indicators.spec.ts` | FR-11 | unit |
| typingText (FR-11) › three names | `domain/indicators.spec.ts` | FR-11 | unit |
| typingText (FR-11) › marks only the names as bold parts | `domain/indicators.spec.ts` | FR-11 | unit |
| unreadLabel (FR-16) › singular for 1 | `domain/indicators.spec.ts` | FR-16 | unit |
| unreadLabel (FR-16) › plural for N | `domain/indicators.spec.ts` | FR-16 | unit |
| typingNames$ › FR-11: shows a typist, and FR-12: hides them 2 s after their last typing event | `streams/typing.spec.ts` | FR-11, FR-12 | stream |
| typingNames$ › FR-11: lists several typists in the order they started | `streams/typing.spec.ts` | FR-11 | stream |
| typingNames$ › FR-12: each typing event restarts that user’s 2 s countdown | `streams/typing.spec.ts` | FR-12 | stream |
| typingNames$ › FR-12: a message from the typist hides them at once, others stay | `streams/typing.spec.ts` | FR-12 | stream |
| typingNames$ › FR-13: never lists the own user | `streams/typing.spec.ts` | FR-13 | stream |
| typingSignal$ (FR-10) › sends the first keystroke at once and the last one at the end of the 500 ms window | `streams/typing.spec.ts` | FR-10 | stream |
| typingSignal$ (FR-10) › never sends more than one event per 500 ms while the user keeps typing | `streams/typing.spec.ts` | FR-10 | stream |
| typingSignal$ (FR-10) › a sent message drops the pending event and restarts the window | `streams/typing.spec.ts` | FR-10, FR-12 | stream |
| unreadCount$ › starts at 0 (FR-16: pill hidden) | `streams/unread.spec.ts` | FR-16 | stream |
| unreadCount$ › FR-15: adds 1 per message from others while scrolled up | `streams/unread.spec.ts` | FR-15 | stream |
| unreadCount$ › FR-15: does not count messages that arrive while at the bottom | `streams/unread.spec.ts` | FR-15 | stream |
| unreadCount$ › FR-19: own messages never add to the counter | `streams/unread.spec.ts` | FR-19 | stream |
| unreadCount$ › FR-17 / FR-18: a reset sets it back to 0, and counting starts again | `streams/unread.spec.ts` | FR-17, FR-18 | stream |
| unreadCount$ › a reset at 0 emits nothing new | `streams/unread.spec.ts` | FR-18 | stream |
| chatSession: typing › FR-10: sends one typing event at once, then at most one per 500 ms | `streams/chat-session.spec.ts` | FR-10 | stream (fake timers) |
| chatSession: typing › FR-12: sending a message cancels the pending typing event | `streams/chat-session.spec.ts` | FR-12 | stream (fake timers) |
| chatSession: typing › FR-02: blank text is still not sent and does not cancel the pending typing event | `streams/chat-session.spec.ts` | FR-02, FR-10 | stream (fake timers) |
| chatSession: typing › FR-11 / FR-13: typing$ lists the others who are typing, not the own user | `streams/chat-session.spec.ts` | FR-11, FR-13 | stream (fake timers) |
| chatSession: typing › FR-08: ignores typing events that arrive before the join is acknowledged | `streams/chat-session.spec.ts` | FR-08 | stream |
| ChatRoom › typing indicator › FR-10: typing in the message box sends one typing event per 500 ms | `chat/chat-room/chat-room.spec.ts` | FR-10 | component |
| ChatRoom › typing indicator › FR-10: clearing the input after sending is not reported as typing | `chat/chat-room/chat-room.spec.ts` | FR-10, FR-02 | component |
| ChatRoom › typing indicator › FR-11: shows one, two and three names between the list and the input | `chat/chat-room/chat-room.spec.ts` | FR-11 | component |
| ChatRoom › typing indicator › FR-12: a name disappears 2 s after the last typing event | `chat/chat-room/chat-room.spec.ts` | FR-12 | component |
| ChatRoom › typing indicator › FR-12: a name disappears at once when that user sends a message | `chat/chat-room/chat-room.spec.ts` | FR-12 | component |
| ChatRoom › typing indicator › FR-13: never shows the own name | `chat/chat-room/chat-room.spec.ts` | FR-13 | component |
| ChatRoom › typing indicator › FR-14: the strip is always in the layout, with a fixed 32 px height | `chat/chat-room/chat-room.spec.ts` | FR-14 | component |
| ChatRoom › unread counter › FR-16: the pill is hidden at 0 | `chat/chat-room/chat-room.spec.ts` | FR-16 | component |
| ChatRoom › unread counter › FR-15 / FR-16: counts messages from others while scrolled up | `chat/chat-room/chat-room.spec.ts` | FR-15, FR-16 | component |
| ChatRoom › unread counter › FR-15: does not count when the user is within 40 px of the bottom | `chat/chat-room/chat-room.spec.ts` | FR-15 | component |
| ChatRoom › unread counter › FR-15: counts when the user is more than 40 px from the bottom | `chat/chat-room/chat-room.spec.ts` | FR-15 | component |
| ChatRoom › unread counter › FR-17: clicking the pill scrolls smoothly to the bottom and resets the counter | `chat/chat-room/chat-room.spec.ts` | FR-17 | component |
| ChatRoom › unread counter › FR-18: reaching the bottom by scrolling resets the counter | `chat/chat-room/chat-room.spec.ts` | FR-18 | component |
| ChatRoom › unread counter › FR-19: own messages never increase the counter | `chat/chat-room/chat-room.spec.ts` | FR-19 | component |
| ChatRoom › unread counter › FR-06: an own message still scrolls to the bottom, which then clears the counter (FR-18) | `chat/chat-room/chat-room.spec.ts` | FR-06, FR-18 | component |
| ChatRoom › unread counter › FR-05: a message from others while scrolled up does not move the list | `chat/chat-room/chat-room.spec.ts` | FR-05 | component |

Total: 16 back-end (6 unit, 10 stream) and 42 front-end (7 unit, 19 stream, 16 component).

## 4. Commands

In the order I ran them. "×N" is how many times that step ran at that point. Commands
that only read files (`cat`, `grep`, `git status`, `git diff`) are not listed.

| # | Folder | Command | Result | Times |
| - | ------ | ------- | ------ | ----- |
| 1 | back-end | `npm install` | pass | 1 |
| 2 | front-end | `npm install` | pass | 1 |
| 3 | back-end | `npm run typecheck` (baseline) | pass | 1 |
| 4 | front-end | `npm run build` (baseline) | pass | 1 |
| 5 | back-end | `cmp src/domain/events.ts ../front-end/src/app/domain/events.ts` (after adding `typing`) | pass (identical) | 1 |
| 6 | back-end | `npm run typecheck` (after the room changes) | pass | 1 |
| 7 | back-end | `npm install -D vitest@5.1.0 @vitest/coverage-v8@5.1.0` | pass | 1 |
| 8 | back-end | `npx vitest run` | **fail**: 2 of 16 failed (see Problems 1) | 3 (1 run + 2 runs to read the failure output) |
| 9 | back-end | `npx vitest run` (after fixing the tests) | pass, 16/16 | 1 |
| 10 | front-end | `npm run build` (after the component changes) | pass | 1 |
| 11 | front-end | `npm install -D @vitest/coverage-v8@5.1.0` | pass | 1 |
| 12 | front-end | `npx ng test --watch=false` | **fail**: 3 of 42 failed (see Problems 2–4) | 2 (1 run + 1 run to read the failure output) |
| 13 | front-end | `npx ng test --watch=false` (after the fixes) | pass, 42/42 | 1 |
| 14 | front-end | `npx ng test --watch=false --coverage` | pass, 42/42 | 1 |
| 15 | back-end | `npx vitest run --coverage` | pass, 16/16 | 1 |
| 16 | back-end | `npx vitest run --coverage` (after adding the `json` reporter) | pass, 16/16 | 1 |
| 17 | back-end | `PORT=3123 npx tsx src/server.ts` + `node smoke.mjs` (3 real WebSocket clients, scratch script, not committed) | pass. The script's exit code was 144 (see Problems 6) | 1 |
| 18 | front-end (wrong folder) | `npm run typecheck` | **fail**: "Missing script" (see Problems 5) | 1 |
| 19 | front-end (wrong folder) | `npm run build` | pass | 1 |
| 20 | front-end | `npx tsc -p tsconfig.spec.json --noEmit` (type-checks the spec files) | pass | 1 |
| 21 | front-end | `npm run build` | pass | 1 |
| 22 | — | `cmp back-end/src/domain/events.ts front-end/src/app/domain/events.ts` | pass (identical) | 1 |
| 23 | back-end | `npm run typecheck` | pass | 1 |
| 24 | back-end | `npm run build` (output deleted afterwards) | pass | 1 |
| 25 | back-end | `npx vitest run` | pass, 16/16 | 1 |
| 26 | front-end | `npx ng test --watch=false` | pass, 42/42 | 1 |
| 27 | back-end | `npm test` | pass, 16/16 | 1 |
| 28 | back-end | `npm run test:coverage` | pass, 16/16 | 1 |
| 29 | front-end | `npm test -- --watch=false` | pass, 42/42 | 1 |

Totals per command: back-end `npx vitest run` ran 5 times (3 fail, 2 pass).
Front-end `npx ng test --watch=false` ran 4 times (2 fail, 2 pass). Front-end
`npm run build` ran 4 times (all pass). Back-end `npm run typecheck` ran 3 times
(all pass). No lint step exists in either project (there is no lint script or
config), so no lint was run.

## 5. Problems

1. **Back-end: 2 tests failed at the 500 ms boundary.** The tests
   `throttleTyping › relays the first keystroke at once and at most one per 500 ms`
   and `chatRoom › FR-10: relays at most one typing notice per 500 ms per user`
   expected a keystroke at exactly 500 ms (or 501 ms after the first one at 1 ms)
   to be relayed. In `TestScheduler`, the hot event at frame 500 is scheduled
   before the throttle's own 500 ms timer, so it still falls inside the first
   window and is dropped. That is valid "at most once per 500 ms" behaviour, so
   the tests were wrong, not the code. Fix: keystrokes every 100 ms up to 600 ms,
   expecting relays at 0 and 600 ms, with a comment about the boundary.
2. **Front-end: wrong marble arithmetic.** In
   `typingNames$ › FR-12: each typing event restarts …`, `'10ms a 999ms a'` puts
   the second event at 1010 ms, not 1011 ms. The test expected removal at
   3011 ms and the actual was 3010 ms. Fix: corrected the expected marble to
   `'e 9ms a 2999ms e'`.
3. **Front-end: real bug, `typing$` emitted `[]` twice.** `chatSession` used
   `startWith([])` and `typingNames$` also starts with `[]`, so subscribers got
   `[], [], ['Ana']`. This caused a failure in
   `chatSession: typing › FR-11 / FR-13: …`. Fix: export `sameNames` from
   `streams/typing.ts` and add `distinctUntilChanged(sameNames)` to the session's
   `typing$`.
4. **Front-end: wrong expectation in an FR-02 test.** The first version did a
   keystroke, a blank submit, waited 500 ms, then did another keystroke, and
   expected one typing event. The second keystroke starts a new window, so two
   events is correct. Fix: rewrote the test to check what it was meant to check:
   two keystrokes then a blank submit send no message, and the pending trailing
   typing event still goes out.
5. **Commands run in the wrong folder.** One shell call ran
   `npm run typecheck` / `npm run build` / `rm -rf dist` in `front-end/` instead
   of `back-end/`. The typecheck failed with "Missing script", the build built
   the front-end, and `rm` deleted only the gitignored `front-end/dist`. Fix:
   re-ran the back-end typecheck and build with an absolute `cd`.
6. **Smoke test exit code 144.** `pkill -f 'tsx src/server.ts'` also matched
   the shell running the command, because its command line contained that
   text. The smoke output was already complete and correct: Ana received no
   own typing notice, relays at 116 ms and 619 ms for 1 s of typing every
   100 ms, the typing right after her message was relayed at once, and the
   garbage frame was ignored without breaking the server. No fix needed. Next
   time I would kill by PID.
7. **Dependencies were not installed** (`node_modules` was missing in both
   folders). Fix: `npm install` in both before anything else.
8. **No tool reports "coverage of new code" directly.** Fix: added the `json`
   reporter to the back-end vitest config and intersected `coverage-final.json`
   with the lines added in `git diff -U0` (method described in the Summary).

## 6. Changes to existing code

| File | Why |
| ---- | --- |
| `back-end/src/domain/events.ts`, `front-end/src/app/domain/events.ts` | Added the `typing` client event (no fields; extra fields dropped) and the `typing` server event (`userId`, `name`), with their parser cases. The two copies are still identical (`cmp` passes). |
| `back-end/src/streams/chat-room.ts` | The room `Subject` now carries `message` and `typing` events instead of only `ChatMessage`. Messages are wrapped as `{ type: 'message', message }` before going into the room rather than after. Added the per-user throttled typing pipeline and the `isForUser` filter, so a typist never gets their own notice (FR-13). Messages keep the same single-`Subject` path and order (FR-03, FR-07). |
| `back-end/package.json`, `back-end/package-lock.json` | Added `vitest` and `@vitest/coverage-v8` (5.1.0) and the `test` / `test:coverage` scripts. |
| `back-end/.gitignore` | Ignore `coverage/`. |
| `front-end/src/app/streams/chat-session.ts` | `ChatSession` gained `typing$`, `keystroke()` and `typingSent$`. The existing members are unchanged. |
| `front-end/src/app/streams/scroll.ts` | Added `scrollToBottomSmoothly` (FR-17). The existing functions are unchanged. |
| `front-end/src/app/chat/chat-room/chat-room.ts` | Wires the typing pipelines, the pill click, the scroll events and the unread counter. The existing FR-05/FR-06 scroll pipeline and the FR-02 clearing are unchanged. |
| `front-end/src/app/chat/chat-room/chat-room.html` | The `<ol>` is wrapped in `.list-area` so the pill can sit at the bottom center of the list, and it gets `(scroll)`. The reserved strip now holds the typing indicator. The input gets `(input)="typed()"`. Using the DOM `input` event rather than `valueChanges` means clearing the box after sending is not reported as typing. |
| `front-end/src/app/chat/chat-room/chat-room.css` | Added `.list-area`, `.pill`, the typing dots and their animation (off under `prefers-reduced-motion`). `.strip` keeps `flex: none; height: 32px` and gains padding and text styles. |
| `front-end/package.json`, `front-end/package-lock.json` | Added `@vitest/coverage-v8` 5.1.0, needed for `ng test --coverage`. |

`README.md` was **not** changed (see Known gaps).

## 7. Known gaps

- **The 3-window manual test (docs/testing.md) was not run by me.** I did not
  open the app in a browser, so the visual match to `docs/design/typing.png` and
  `unread.png`, the smoothness of the scroll and the "no layout jump" on a real
  layout were not checked by eye. The real-socket server behaviour was checked
  with the scratch smoke script (Commands, step 17).
- **FR-12 timing tolerance.** Typing is throttled to 500 ms, so receivers learn
  the last keystroke up to 500 ms late. The client sends a trailing event, so
  the name normally disappears 2.0–2.5 s after the real last keystroke. The
  server throttle is leading-only and strict. If network jitter brings two
  client events less than 500 ms apart, the server drops the later one, and the
  name can then disappear up to ~0.5 s early (1.5–2.0 s).
- **FR-14** is tested with jsdom's computed style (`height: 32px`,
  `flex-shrink: 0`). A real layout engine was not used.
- **FR-17** smoothness is checked only as `scrollTo({ behavior: 'smooth' })`
  being called. A message that arrives during the smooth scroll, before the
  bottom is reached, can briefly count as unread. It is cleared when the
  scroll reaches the bottom (FR-18).
- **No tests for `socket.ts`, `server.ts` and `chat-socket.service.ts`**
  (transport code, unchanged). The front-end copy of the new `typing` parser
  branches is not run by any front-end test. The identical back-end copy is.
- **Back-end test files are not type-checked by `npm run typecheck`**, because
  `tsconfig.json` only includes `src/`. vitest strips types without checking
  them. Front-end specs were type-checked once (`tsc -p tsconfig.spec.json`).
- **FR-01 and FR-04** have no automated tests (baseline code, not touched).
- Two users with the same name show as "Ana e Ana estão digitando…". Users are
  told apart by `userId`, not by name.
- "3 pessoas online" in the design screens is out of scope (README) and was not
  implemented.
- `README.md` still says FR-10 to FR-19 are not implemented, and its protocol
  table does not list the `typing` events.
- Nothing was committed. The changes are in the working tree of `run/A3`. New
  files are only marked intent-to-add (`git add -N`).
