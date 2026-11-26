# Run log – FR-10 to FR-19 (branch `run/B1`)

Everything here comes from commands actually run in this session. Nothing is estimated.

## 1. Summary

Line counts come from `git diff --numstat` (tracked files) plus `wc -l` for new, untracked files.
`git diff --stat` alone does not list untracked files: it reported
`14 files changed, 612 insertions(+), 37 deletions(-)`, which is the "modified files" part below.
Documentation (`docs/testing.md`, `docs/run-log.md`) is not counted in either column.

| Metric | Back-end | Front-end |
| --- | --- | --- |
| Files created | 2 (`streams/typing.ts`, `streams/typing.spec.ts`) | 8 (`domain/typing-label.ts` + spec, `domain/unread-label.ts` + spec, `streams/typing.ts` + spec, `streams/unread.ts` + spec) |
| Files modified | 4 | 10 |
| Lines added | 185 (131 in modified files + 54 in new files) | 869 (481 in modified files + 388 in new files) |
| Lines removed | 10 | 27 |
| Tests added | 16 (33 → 49) | 47 (45 → 92) |
| Tests passing | 49 / 49 | 92 / 92 |
| Tests failing | 0 | 0 |
| Line coverage, new code | 100 %: `streams/typing.ts` 1/1, `streams/chat-room.ts` 22/22; the new typing lines in `domain/events.ts` are covered (its only uncovered line is the old `default: return null` at line 93) | 100 %: `streams/typing.ts` 23/23, `streams/unread.ts` 5/5, `domain/typing-label.ts` 9/9, `domain/unread-label.ts` 2/2, `streams/chat-session.ts` 21/21, `streams/scroll.ts` 12/12, `chat-room.ts` 28/28, `chat-room.html` 45/45 |
| Line coverage, whole project | 96.59 % (85/88) | 100 % (233/233) |

Coverage commands: `npx vitest run --coverage` (back-end) and
`ng test --watch=false --coverage` (front-end), with `@vitest/coverage-v8` installed with
`--no-save` (see Problems).

## 2. Requirements

| Requirement | Implemented | Where (file:line) | Covered by test |
| --- | --- | --- | --- |
| FR-10 typing event, ≤ 1 per 500 ms per user | yes | client: `front-end/src/app/streams/typing.ts:35` (`typingPings$`), `front-end/src/app/streams/chat-session.ts:73`, `front-end/src/app/chat/chat-room/chat-room.html:62` (`(input)="typed()"`), `front-end/src/app/chat/chat-room/chat-room.ts:74`; server: `back-end/src/streams/typing.ts:9` (`throttleTyping$`), `back-end/src/streams/chat-room.ts:80`; protocol: `back-end/src/domain/events.ts:9,26,65` | `typingPings$ (FR-10) › sends the first keystroke at once and at most one ping per 500 ms`; `chatSession › typed() sends at most one typing event per 500 ms…`; `ChatRoom › typing indicator › sends one typing event for a burst of keystrokes (FR-10)`; `throttleTyping$ (FR-10) › relays the first keystroke at once…`; `chatRoom › relays at most one typing event per user per 500 ms (FR-10)`; `chatRoom › throttles each user separately (FR-10)` |
| FR-11 indicator text between list and input | yes | `front-end/src/app/domain/typing-label.ts:11`, `front-end/src/app/streams/typing.ts:47`, `front-end/src/app/chat/chat-room/chat-room.html:43`; server relay `back-end/src/streams/chat-room.ts:69,80`; protocol `back-end/src/domain/events.ts:33,87` | `typingLabel (FR-11)` (4 tests); `ChatRoom › typing indicator › shows who is typing, with names in bold, between the list and the input (FR-11)`; `chatRoom › relays typing to the other joined users, never back to the typer (FR-11, FR-13)` |
| FR-12 name leaves 2 s after last keystroke, or on send | yes | `front-end/src/app/streams/typing.ts:67` (timer / own message), `back-end/src/domain/events.ts:11` (`TYPING_TIMEOUT_MS`) | `whoIsTyping$ › shows a name and removes it 2 s after the last typing event`; `› restarts the 2 s countdown…`; `› removes a name immediately when that user sends a message (FR-12)`; `ChatRoom › typing indicator › removes a name as soon as that user sends a message (FR-12)` |
| FR-13 never see own name | yes | server: `back-end/src/streams/chat-room.ts:33,69`; client: `front-end/src/app/streams/typing.ts:59,91` | `chatRoom › relays typing to the other joined users, never back to the typer (FR-11, FR-13)`; `whoIsTyping$ › never shows the current user (FR-13)`; `othersTyping$ (FR-13) › waits for the join ack…`; `ChatRoom › typing indicator › never shows the user's own name (FR-13)` |
| FR-14 indicator keeps its height | yes | `front-end/src/app/chat/chat-room/chat-room.css:109-112` (`.strip`, `flex: none`, `height: 32px`) | `ChatRoom › typing indicator › keeps the strip in the layout with a fixed height when empty (FR-14)` |
| FR-15 +1 per other's message while > 40 px from bottom | yes | `front-end/src/app/streams/unread.ts:12`, `front-end/src/app/chat/chat-room/chat-room.ts:82` | `unreadCount$ › adds 1 per message from someone else while scrolled up (FR-15)`; `› does not count messages that arrive while the user is at the bottom`; `ChatRoom › unread counter › counts others' messages while scrolled up…`; `› does not count while the user is within 40 px of the bottom (FR-15)` |
| FR-16 pill "1 nova mensagem" / "N novas mensagens", hidden at 0 | yes | `front-end/src/app/domain/unread-label.ts:2`, `front-end/src/app/chat/chat-room/chat-room.html:29-37`, `front-end/src/app/chat/chat-room/chat-room.css:174` | `unreadLabel (FR-16)` (3 tests); `ChatRoom › unread counter › is hidden at 0 (FR-16)`; `› counts others' messages while scrolled up and shows the pill (FR-15, FR-16)` |
| FR-17 click pill → smooth scroll + reset | yes | `front-end/src/app/streams/scroll.ts:16`, `front-end/src/app/chat/chat-room/chat-room.ts:80,100` | `ChatRoom › unread counter › clicking the pill scrolls smoothly to the bottom and resets the counter (FR-17)`; `scrollToBottomSmoothly (FR-17)`; `unreadCount$ › resets to 0 on reset$…` |
| FR-18 reaching the bottom resets | yes | `front-end/src/app/chat/chat-room/chat-room.ts:79,96`, `front-end/src/app/chat/chat-room/chat-room.html:12` (`(scroll)`) | `ChatRoom › unread counter › scrolling down to the bottom resets the counter (FR-18)`; `unreadCount$ › resets to 0 on reset$…` |
| FR-19 own messages never count | yes | `front-end/src/app/streams/unread.ts:19` (`!message.own`) | `unreadCount$ › never counts own messages (FR-19)`; `ChatRoom › unread counter › never counts the user's own messages (FR-19)` |
| FR-01 to FR-08 still work | yes (unchanged behaviour) | – | All 33 original back-end and 45 original front-end tests still pass (two FR-02 assertions were narrowed to message frames, see section 6) |

## 3. Tests

All tests added in this run (63). `it.each` rows are counted as separate tests, as Vitest does.

| Test name | File | Requirement | Type |
| --- | --- | --- | --- |
| typing events › parses a client typing event, ignoring extra fields | back-end/src/domain/events.spec.ts | FR-10 | unit |
| typing events › parses a server typing event with the typer id and name | back-end/src/domain/events.spec.ts | FR-11 | unit |
| typing events › returns null for server typing without userId (R8) | back-end/src/domain/events.spec.ts | FR-11, FR-08 | unit |
| typing events › returns null for server typing without name (R8) | back-end/src/domain/events.spec.ts | FR-11, FR-08 | unit |
| typing events › returns null for server typing with non-string name (R8) | back-end/src/domain/events.spec.ts | FR-11, FR-08 | unit |
| typing events › returns null for server typing as an array (R8) | back-end/src/domain/events.spec.ts | FR-11, FR-08 | unit |
| typing events › returns null for a client typing event that is not an object (R8) | back-end/src/domain/events.spec.ts | FR-10, FR-08 | unit |
| throttleTyping$ (FR-10) › uses a 500 ms window by default | back-end/src/streams/typing.spec.ts | FR-10 | unit |
| throttleTyping$ (FR-10) › relays the first keystroke at once and drops the rest of the 500 ms window | back-end/src/streams/typing.spec.ts | FR-10 | stream |
| throttleTyping$ (FR-10) › relays one event per window during continuous typing | back-end/src/streams/typing.spec.ts | FR-10 | stream |
| throttleTyping$ (FR-10) › honours a custom window | back-end/src/streams/typing.spec.ts | FR-10 | stream |
| chatRoom › relays typing to the other joined users, never back to the typer (FR-11, FR-13) | back-end/src/streams/chat-room.spec.ts | FR-11, FR-13 | stream |
| chatRoom › relays at most one typing event per user per 500 ms (FR-10) | back-end/src/streams/chat-room.spec.ts | FR-10 | stream |
| chatRoom › throttles each user separately (FR-10) | back-end/src/streams/chat-room.spec.ts | FR-10 | stream |
| chatRoom › ignores typing before join (FR-11) | back-end/src/streams/chat-room.spec.ts | FR-11 | stream |
| chatRoom › still delivers own messages to the sender after typing (FR-03, FR-12) | back-end/src/streams/chat-room.spec.ts | FR-12, FR-03 | stream |
| typing events › (same 7 tests as the back-end copy) | front-end/src/app/domain/events.spec.ts | FR-10, FR-11, FR-08 | unit |
| typingLabel (FR-11) › is empty when nobody is typing | front-end/src/app/domain/typing-label.spec.ts | FR-11 | unit |
| typingLabel (FR-11) › uses the singular for one name | front-end/src/app/domain/typing-label.spec.ts | FR-11 | unit |
| typingLabel (FR-11) › joins two names with "e" | front-end/src/app/domain/typing-label.spec.ts | FR-11 | unit |
| typingLabel (FR-11) › joins three or more names with commas and a final "e" | front-end/src/app/domain/typing-label.spec.ts | FR-11 | unit |
| typingSegments (FR-11) › marks exactly the names so they can be rendered bold | front-end/src/app/domain/typing-label.spec.ts | FR-11 | unit |
| unreadLabel (FR-16) › is empty at 0 so the pill can be hidden | front-end/src/app/domain/unread-label.spec.ts | FR-16 | unit |
| unreadLabel (FR-16) › uses the singular for one message | front-end/src/app/domain/unread-label.spec.ts | FR-16 | unit |
| unreadLabel (FR-16) › uses the plural for more than one | front-end/src/app/domain/unread-label.spec.ts | FR-16 | unit |
| typingPings$ (FR-10) › uses a 500 ms window by default | front-end/src/app/streams/typing.spec.ts | FR-10 | unit |
| typingPings$ (FR-10) › sends the first keystroke at once and at most one ping per 500 ms | front-end/src/app/streams/typing.spec.ts | FR-10 | stream |
| typingPings$ (FR-10) › keeps pinging every 500 ms while the user keeps typing | front-end/src/app/streams/typing.spec.ts | FR-10 | stream |
| whoIsTyping$ › uses a 2 s timeout by default | front-end/src/app/streams/typing.spec.ts | FR-12 | unit |
| whoIsTyping$ › shows a name and removes it 2 s after the last typing event (FR-11, FR-12) | front-end/src/app/streams/typing.spec.ts | FR-11, FR-12 | stream |
| whoIsTyping$ › restarts the 2 s countdown on every new typing event (FR-12) | front-end/src/app/streams/typing.spec.ts | FR-12 | stream |
| whoIsTyping$ › lists several typers in the order they started, each with its own countdown (FR-11, FR-12) | front-end/src/app/streams/typing.spec.ts | FR-11, FR-12 | stream |
| whoIsTyping$ › removes a name immediately when that user sends a message (FR-12) | front-end/src/app/streams/typing.spec.ts | FR-12 | stream |
| whoIsTyping$ › keeps a name when someone else's message arrives (FR-12) | front-end/src/app/streams/typing.spec.ts | FR-12 | stream |
| whoIsTyping$ › never shows the current user (FR-13) | front-end/src/app/streams/typing.spec.ts | FR-13 | stream |
| whoIsTyping$ › does not emit again while the list is unchanged | front-end/src/app/streams/typing.spec.ts | FR-11 | stream |
| othersTyping$ (FR-13) › waits for the join ack and filters out the id it carries | front-end/src/app/streams/typing.spec.ts | FR-13 | stream |
| othersTyping$ (FR-13) › honours a custom timeout | front-end/src/app/streams/typing.spec.ts | FR-12 | stream |
| unreadCount$ › adds 1 per message from someone else while scrolled up (FR-15) | front-end/src/app/streams/unread.spec.ts | FR-15 | stream |
| unreadCount$ › never counts own messages (FR-19) | front-end/src/app/streams/unread.spec.ts | FR-19 | stream |
| unreadCount$ › does not count messages that arrive while the user is at the bottom (FR-15) | front-end/src/app/streams/unread.spec.ts | FR-15 | stream |
| unreadCount$ › resets to 0 on reset$ (reaching the bottom, FR-18; clicking the pill, FR-17) | front-end/src/app/streams/unread.spec.ts | FR-17, FR-18 | stream |
| unreadCount$ › does not emit again when reset while already at 0 (FR-16: pill stays hidden) | front-end/src/app/streams/unread.spec.ts | FR-16 | stream |
| chatSession › typed() sends at most one typing event per 500 ms and reports it on typingSent$ (FR-10) | front-end/src/app/streams/chat-session.spec.ts | FR-10 | stream |
| chatSession › typingNames$ lists other users typing, without the user's own name (FR-11, FR-13) | front-end/src/app/streams/chat-session.spec.ts | FR-11, FR-13 | stream |
| scrollToBottomSmoothly (FR-17) › asks for a smooth scroll to the end | front-end/src/app/streams/scroll.spec.ts | FR-17 | unit |
| ChatRoom › typing indicator › sends one typing event for a burst of keystrokes (FR-10) | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-10 | component |
| ChatRoom › typing indicator › shows who is typing, with names in bold, between the list and the input (FR-11) | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-11 | component |
| ChatRoom › typing indicator › removes a name as soon as that user sends a message (FR-12) | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-12 | component |
| ChatRoom › typing indicator › never shows the user's own name (FR-13) | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-13 | component |
| ChatRoom › typing indicator › keeps the strip in the layout with a fixed height when empty (FR-14) | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-14 | component |
| ChatRoom › unread counter › is hidden at 0 (FR-16) | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-16 | component |
| ChatRoom › unread counter › counts others' messages while scrolled up and shows the pill (FR-15, FR-16) | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-15, FR-16 | component |
| ChatRoom › unread counter › does not count while the user is within 40 px of the bottom (FR-15) | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-15 | component |
| ChatRoom › unread counter › never counts the user's own messages (FR-19) | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-19 | component |
| ChatRoom › unread counter › clicking the pill scrolls smoothly to the bottom and resets the counter (FR-17) | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-17 | component |
| ChatRoom › unread counter › scrolling down to the bottom resets the counter (FR-18) | front-end/src/app/chat/chat-room/chat-room.spec.ts | FR-18 | component |
| Scripted smoke test: real server + 3 `ws` clients (not committed; run from the session scratchpad) | – | FR-10, FR-11, FR-13, FR-08 | other (manual/scripted) |

## 4. Commands

In the order they were first run. "Runs" counts every run of the exact command.

| # | Command | Folder | Result | Runs |
| --- | --- | --- | --- | --- |
| 1 | `bash scripts/validate.sh` (baseline) | root | fail: `Missing back-end/node_modules` | 1 |
| 2 | `npx vitest run` (baseline) | back-end | fail: `ERR_MODULE_NOT_FOUND` (no node_modules) | 1 |
| 3 | `npx ng test --watch=false` (baseline) | front-end | fail: `Could not find the '@angular/build:unit-test' builder's node package` | 1 |
| 4 | `npm ci` | back-end | pass | 1 |
| 5 | `npm ci` | front-end | pass | 1 |
| 6 | `bash scripts/validate.sh` | root | pass, 12/12 checks (baseline after install) | 1 (3 in total, see #20 and #26) |
| 7 | `npx vitest run` | back-end | pass, 33 tests (baseline) → later: fail (5 new tests, run #10) → pass, 49 tests | 3 |
| 8 | `npx ng test --watch=false` | front-end | pass, 45 tests (baseline) → later runs listed under #15 | 1 |
| 9 | `npx vitest run src/streams/typing.spec.ts` | back-end | pass, 4 tests | 1 |
| 10 | `npx vitest run src/streams/chat-room.spec.ts` | back-end | fail (to list the 5 failing new tests) | 1 |
| 11 | `npx vitest run src/streams/chat-room.spec.ts -t 'never back'` | back-end | fail (to see the frame diff) | 1 |
| 12 | `npm run typecheck` | back-end | pass | 1 |
| 13 | `npm run lint` | back-end | pass | 1 |
| 14 | `npm run lint:deps` | back-end | pass (`no dependency violations found (18 modules, 39 dependencies cruised)`) | 1 |
| 15 | `npx ng test --watch=false` | front-end | fail: TS2345 in `chat-session.spec.ts` → pass, 81 tests → fail: 2 FR-02 tests → pass, 92 tests | 4 |
| 16 | `npm run typecheck` | front-end | pass | 1 |
| 17 | `npm run lint` | front-end | pass | 1 |
| 18 | `PORT=3123 npx tsx src/server.ts` + `node smoke.mjs` (3 `ws` clients) | back-end | pass (expected events received; the shell exited 144 because `pkill -f` matched its own command line) | 1 |
| 19 | `npx vitest run --coverage` | back-end | fail: `MISSING DEPENDENCY Cannot find dependency '@vitest/coverage-v8'` | 1 |
| 20 | `npm install --no-save @vitest/coverage-v8@5.1.1` / `@5.1.0` | back-end / front-end | pass | 1 each |
| 21 | `npx vitest run --coverage --coverage.reporter=text` | back-end | pass, 49 tests, lines 96.59 % | 1 |
| 22 | `npx ng test --watch=false --coverage --coverage-reporters=text` | front-end | pass, 92 tests, lines 100 % | 1 |
| 23 | `npx vitest run --coverage --coverage.reporter=json-summary` | back-end | pass (per-file numbers in section 1) | 1 |
| 24 | `npx ng test --watch=false --coverage --coverage-reporters=json-summary` | front-end | pass (per-file numbers in section 1) | 1 |
| 25 | `node -e '…coverage-summary.json…'` | root | fail once (relative path to the front-end summary), pass with an absolute path | 2 |
| 26 | `bash scripts/validate.sh` | root | pass, 12/12 checks, `ALL CHECKS PASSED` (after implementation, and again after `docs/testing.md`) | 2 |

`scripts/validate.sh` was run 4 times in total: 1 fail (#1), 3 passes (#6, #26 ×2).
Also run (not build/test/lint): `npx prettier --version` (no output kept), `git diff --stat`,
`git diff --numstat`, `git status`, `wc -l`, `grep`/`sed` to inspect files.

## 5. Problems

| Problem | Fix |
| --- | --- |
| `validate.sh`, `vitest` and `ng test` failed at the start: no `node_modules` in either folder. | `npm ci` in both folders. |
| 5 new back-end room tests failed: my expected marble diagrams were wrong (e.g. Carla's diagram had the typing event at frame 5 instead of 4), and joins at frame 0 of a `hot()` stream happen before the room subscribes. | Recounted the frames, moved every join to frame 1 (`-a`), as the existing tests do. No production code changed. |
| Back-end throttle marble tests at the exact window edge (an event at exactly 500 ms) depend on how `TestScheduler` orders same-frame actions. | Chose timings that are clearly inside/outside the window (499 and 502 ms; one keystroke every 120 ms). |
| Front-end build error TS2345: the `hot()` value map in `chat-session.spec.ts` inferred `type: string` instead of the `ServerEvent` union. | Typed it as `hot<ServerEvent>(…)`. |
| Two existing FR-02 component tests failed: `sent` now also holds `{type:'typing'}`, because typing into the box sends a typing ping (FR-10). | Narrowed those two assertions to message frames (`sentMessages()`). FR-02 is still checked the same way (see section 6). |
| `npx vitest run --coverage` failed: `@vitest/coverage-v8` is not a dependency. | `npm install --no-save` with the version matching each folder's Vitest (5.1.1 / 5.1.0), so `package.json` and the lockfiles are unchanged. |
| The text coverage reporter hides fully covered files. | Re-ran with the `json-summary` reporter and printed per-file numbers. |
| The smoke-test shell exited with 144. | `pkill -f "tsx src/server.ts"` also matched the shell's own command line. The client output was printed before that, and the port was checked to be free afterwards. |

## 6. Changes to existing code

| File | Why |
| --- | --- |
| `back-end/src/domain/events.ts` and `front-end/src/app/domain/events.ts` (identical, R2) | Added `TYPING_THROTTLE_MS`/`TYPING_TIMEOUT_MS`, client event `{type:'typing'}`, server event `{type:'typing', userId, name}`, and parsing for both. Existing events unchanged. |
| `back-end/src/streams/chat-room.ts` | `room$` now carries `ServerEvent`s (messages and typing) instead of only `ChatMessage`s; each session forwards room events except its own typing (FR-13) and puts its throttled typing into the room (FR-10). Message handling is the same. |
| `front-end/src/app/streams/chat-session.ts` | `ChatSession` gained `typed()`, `typingSent$` and `typingNames$`. Existing members unchanged. |
| `front-end/src/app/streams/scroll.ts` | Added `scrollToBottomSmoothly` (FR-17). Existing functions unchanged. |
| `front-end/src/app/chat/chat-room/chat-room.ts` | Wires typing pings, the unread counter, the scroll/pill handlers. The FR-05/FR-06 auto-scroll and FR-02 wiring are unchanged. |
| `front-end/src/app/chat/chat-room/chat-room.html` | Wrapped the list in `.list` (so the pill can be positioned over it), added `(scroll)`, the pill, the typing indicator inside the existing `.strip` (which lost `aria-hidden` and became `aria-live="polite"`), and `(input)="typed()"`. |
| `front-end/src/app/chat/chat-room/chat-room.css` | `.list` wrapper; `.strip` keeps `height: 32px` / `flex: none` and gets the indicator layout; styles for the dots and the pill. |
| `front-end/src/app/chat/chat-room/chat-room.spec.ts` | Added the new tests. Changed the assertions of the two existing FR-02 tests from `sent` to `sentMessages()` (message frames only), because typing in the box now also sends a typing ping. Nothing was deleted or skipped. |
| `back-end/src/domain/events.spec.ts`, `back-end/src/streams/chat-room.spec.ts`, `front-end/src/app/domain/events.spec.ts`, `front-end/src/app/streams/chat-session.spec.ts`, `front-end/src/app/streams/scroll.spec.ts` | New tests appended. `scroll.spec.ts` also imports `vi` and the new function. Existing tests unchanged. |

No lint config, dependency-cruiser config, script, `package.json` or lockfile was changed.

## 7. Known gaps

- **The 3-window manual test in `docs/testing.md` was not run.** No browser was used in this
  session. The UI was checked by component tests in jsdom and by an AOT build only. Real layout
  (pill at the bottom center, the strip not jumping, the dots animation, smooth scrolling) has
  not been seen in a browser.
- jsdom has no layout. The unread component tests fake `scrollHeight`, `clientHeight` and
  `scrollTop` and stub `scrollTo`. Real scroll events (including the ones a smooth scroll fires)
  are only covered by the manual test.
- The 2 s removal (FR-12) is tested in virtual time (marble) only, not in the component with
  real timers.
- The "3 pessoas online" line in the header of `typing.png` / `unread.png` is not in FR-10 to
  FR-19 and was not implemented.
- The mockups show "…" as three dots; the requirement text uses the single character "…",
  which is what is rendered.
- Any `input` event counts as typing, including deleting text. The requirements don't say
  whether deleting should count.
- A user who leaves while typing stays in the indicator until their 2 s run out (no "left"
  event exists). This was not tested automatically.
- The server-side throttle can drop a client ping that arrives slightly under 500 ms after the
  last one because of network jitter. That delays the indicator refresh by at most one ping and
  is hidden by the 2 s timeout. It was not measured.
- `@vitest/coverage-v8` is not a project dependency. To reproduce the coverage numbers, install
  it with `--no-save` as shown in `docs/testing.md`.
