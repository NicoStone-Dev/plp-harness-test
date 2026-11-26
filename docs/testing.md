# Testing – typing indicator and unread counter (FR-10 to FR-19)

How the feature in `docs/requirements.md` (FR-10 to FR-19) is tested. FR-01 to FR-08 keep
their existing tests, which all still pass.

Test names below are the `describe › it` names as Vitest prints them. Files:

| Short name | File |
| --- | --- |
| BE events | `back-end/src/domain/events.spec.ts` |
| BE typing | `back-end/src/streams/typing.spec.ts` |
| BE room | `back-end/src/streams/chat-room.spec.ts` |
| FE events | `front-end/src/app/domain/events.spec.ts` |
| FE typing (domain) | `front-end/src/app/domain/typing.spec.ts` |
| FE unread (domain) | `front-end/src/app/domain/unread.spec.ts` |
| FE typing (stream) | `front-end/src/app/streams/typing.spec.ts` |
| FE unread (stream) | `front-end/src/app/streams/unread.spec.ts` |
| FE session | `front-end/src/app/streams/chat-session.spec.ts` |
| FE scroll | `front-end/src/app/streams/scroll.spec.ts` |
| FE component | `front-end/src/app/chat/chat-room/chat-room.spec.ts` |

Stream tests with time (throttle, 2 s expiry) are marble tests with `TestScheduler`, so
they run in virtual time (rule R7). Component tests render the real `ChatRoom` with a fake
server connection.

## Typing indicator (FR-10 to FR-14)

### Back-end

| Requirement | Step | Expected |
| --- | --- | --- |
| FR-10 | Client sends `{"type":"typing"}` | Parsed to `{ type: 'typing' }`; extra fields ignored — BE events `parseClientEvent › parses a typing event and ignores extra fields (FR-10)` |
| FR-10 | Client sends a malformed typing frame (`"Typing"`, bare string) | Parsed to `null`, never throws — BE events `parseClientEvent › returns null for typing with wrong case (R8)`, `… typing as a bare string (R8)` |
| FR-10 | Keystrokes at 0, 1, 499, 500, 501 ms reach `throttleTyping` | Only 0 and 501 pass (window is 500 ms, inclusive) — BE typing `throttleTyping (FR-10) › lets the first keystroke through and drops the rest of the 500 ms window` |
| FR-10 | Keystrokes more than 500 ms apart | All pass — BE typing `throttleTyping (FR-10) › passes every keystroke that is more than 500 ms apart`; default window is 500 — `… uses a 500 ms window by default` |
| FR-10 | Ana pings at 2, 3, 300, 503 ms; Bruno pings at 4 ms | Others receive Ana's typing at 2 and 503 only; Bruno's is throttled separately — BE room `chatRoom › typing indicator › relays at most one typing event per 500 ms per user (FR-10)` |
| FR-11 | Ana types while Bruno and Carla are joined | Bruno and Carla receive `{ type: 'typing', userId, name: 'Ana' }` — BE room `… relays typing to the other clients but never back to the typist (FR-11, FR-13)` |
| FR-11 | A client sends typing before joining | Ignored; after joining, its typing carries the joined name — BE room `… ignores typing before join, and typing carries the joined name (FR-11)` |
| FR-12 | Ana sends typing and then a message | Others get the typing event and then the message, in order (the client clears Ana on the message) — BE room `… a message is still delivered right after a typing ping (FR-12 relies on it)` |
| FR-13 | Ana types | Ana receives nothing back — BE room `… relays typing to the other clients but never back to the typist (FR-11, FR-13)` |
| FR-11 | Server typing event is valid / invalid (`unknown type`, missing `userId`, missing `name`, non-string `name`) | Valid parsed; invalid → `null` — BE events `parseServerEvent › parses a valid typing event (FR-11)`, `parseServerEvent › returns null for … (R8)` |
| FR-14 | — | Layout only (front-end) — n/a on the back-end |

### Front-end

| Requirement | Step | Expected |
| --- | --- | --- |
| FR-10 | Keystrokes at 0, 1, 2, 300, 501, 502, 1100 ms into `typingPings$` | Pings at 0, 501, 1100 — FE typing (stream) `typingPings$ (FR-10) › sends on the first keystroke, then at most once per 500 ms` |
| FR-10 | No keystrokes | No pings — FE typing (stream) `typingPings$ (FR-10) › sends nothing while the user does not type` |
| FR-10 | `session.typing()` at 1, 2, 3, 600 ms | Exactly two `{ type: 'typing' }` sent (at 1 and 600) — FE session `chatSession › typing() sends at most one typing event per 500 ms (FR-10)` |
| FR-10 | Type "o", "oi", "oi!" quickly in the input | One typing event sent — FE component `ChatRoom › typing indicator › sends one typing event for a burst of keystrokes (FR-10)` |
| FR-10 | Type "oi" and send | Sent: one typing, then the message; clearing the input sends no typing — FE component `… clearing the input after sending is not a keystroke (FR-10)` |
| FR-11 | 0 / 1 / 2 / 3 / 4 names | `""`, "Ana está digitando…", "Ana e Bruno estão digitando…", "Ana, Bruno e Carla estão digitando…", "Ana, Bruno, Carla e Davi estão digitando…" — FE typing (domain) `typingText (FR-11) › …` (4 tests) |
| FR-11 | Names are marked for bold | Only names have `name: true` — FE typing (domain) `typingParts (FR-11) › marks only the names, so they can be rendered in bold` |
| FR-11 | Ana, then Bruno start typing | `[Ana]`, then `[Ana, Bruno]`, each with its own timer — FE typing (stream) `typingNames$ › lists several users in the order they started, each with its own timer (FR-11)` |
| FR-11 | Server sends typing for Ana, then Bruno | The strip between list and composer shows "Ana está digitando…", then "Ana e Bruno estão digitando…" with `<strong>` names — FE component `… shows who is typing, with bold names, between the list and the input (FR-11)` |
| FR-11 | Three users typing | "Ana, Bruno e Carla estão digitando…" — FE component `… lists three typists as "Ana, Bruno e Carla" (FR-11)` |
| FR-11 | Typing before the join ack; unrelated events | Ignored — FE typing (stream) `typingNames$ › ignores typing before the join is acknowledged`, `… ignores events that are neither typing nor messages (R8)` |
| FR-11 | Session wiring | `typingNames$` lists Bruno, not self — FE session `chatSession › typingNames$ lists others typing from the server events (FR-11, FR-13)` |
| FR-12 | Bruno pings once | Shown, removed exactly 2000 ms later — FE typing (stream) `typingNames$ › shows a name 2 s after the last ping, then removes it (FR-11, FR-12)` |
| FR-12 | Bruno pings again after 1000 ms | Timer restarts; removed 2000 ms after the last ping — FE typing (stream) `typingNames$ › every new ping restarts that user's 2 s timer (FR-12)` |
| FR-12 | Bruno sends a message | Removed immediately; old timer cancelled — FE typing (stream) `typingNames$ › removes a name immediately when that user sends a message (FR-12)`; FE component `… removes a name as soon as that user sends a message (FR-12)` |
| FR-12 | Someone else sends a message | Bruno stays until his own timer — FE typing (stream) `typingNames$ › a message from someone else does not remove a typist` |
| FR-12 | Expiry after 2 s in the rendered page | manual (covered in virtual time by the stream tests above) |
| FR-13 | Server sends a typing event with our own id | Not listed — FE typing (stream) `typingNames$ › never lists the current user, even if the server echoed it (FR-13)`; FE component `… never shows the current user (FR-13)` |
| FR-14 | Nobody typing → someone typing → nobody | The same `.strip` element stays in the DOM, empty when nobody types — FE component `… keeps the strip in the layout while empty (FR-14)`, `ChatRoom › keeps the reserved indicator strip` |
| FR-14 | Strip height stays 32 px (no layout jump) | manual (CSS `height: 32px`; jsdom has no layout) |
| FR-11 | Typing parsing on the client | Valid typing parsed; invalid → `null` — FE events (same cases as BE events) |

## Unread counter (FR-15 to FR-19)

### Back-end

The unread counter is purely client-side; the back-end only has to deliver messages in
order with their `authorId`, which the existing tests already cover.

| Requirement | Step | Expected |
| --- | --- | --- |
| FR-15 to FR-19 | Messages are broadcast to all joined clients, in order, with `authorId` | Covered by existing `chatRoom › acks the join and broadcasts every message to every joined client in order (FR-03)` |
| FR-15 to FR-19 | Anything specific to the counter | n/a — no back-end logic |

### Front-end

| Requirement | Step | Expected |
| --- | --- | --- |
| FR-15 | Three messages from others while scrolled up | Counter 1, 2, 3 — FE unread (stream) `unreadCount$ › counts messages from others while scrolled up (FR-15)` |
| FR-15 | Messages while near the bottom (≤ 40 px) | Not counted — FE unread (stream) `unreadCount$ › does not count messages that arrive while at the bottom (FR-15)`; FE component `ChatRoom › unread counter › does not count while the user is at the bottom (FR-15)` |
| FR-15 / FR-16 | List scrolled 500 px up; 1 then 3 messages from others | Pill shows "1 nova mensagem", then "3 novas mensagens" — FE component `… counts messages from others while scrolled up (FR-15, FR-16)` |
| FR-16 | Counter text for 0 / 1 / N | `""`, "1 nova mensagem", "N novas mensagens" — FE unread (domain) `unreadLabel (FR-16) › is empty at 0`, `… uses the singular for 1 and the plural for more` |
| FR-16 | Counter at 0 | Starts at 0; no pill in the DOM — FE unread (stream) `unreadCount$ › starts at 0 so the pill is hidden (FR-16)`; FE component `… is hidden at 0 (FR-16)` |
| FR-16 | Pill is at the bottom center of the list | manual (CSS position) |
| FR-17 | Click the pill | Counter resets to 0 and counts again afterwards — FE unread (stream) `unreadCount$ › resets when the pill is clicked, and counts again afterwards (FR-17)` |
| FR-17 | Click the pill in the component | `scrollTo({ top: scrollHeight, behavior: 'smooth' })` called; pill disappears — FE component `… clicking the pill scrolls smoothly to the bottom and resets the counter (FR-17)`; FE scroll `scrollToBottomSmoothly (FR-17) › asks the element for a smooth scroll to the end` |
| FR-17 | The scroll is visibly smooth | manual |
| FR-18 | Scroll to a position still far from the bottom, then to the bottom | First scroll keeps the count; the second resets it — FE unread (stream) `unreadCount$ › resets when a scroll reaches the bottom, not on other scrolls (FR-18)`; FE component `… scrolling to the bottom resets the counter; scrolling elsewhere does not (FR-18)` |
| FR-19 | Own messages while scrolled up | Never counted — FE unread (stream) `unreadCount$ › never counts the user's own messages (FR-19)`; FE component `… never counts the user's own messages (FR-19)` |

## Manual test with 3 browser windows

Start the back-end (`cd back-end && npm start`) and the front-end (`cd front-end && npm start`),
open `http://localhost:4200` in three windows and join as **Ana**, **Bruno** and **Carla**.

| Step | Expected |
| --- | --- |
| 1. Nobody types. | No indicator in any window; the 32 px strip above the input is empty and the input does not move. |
| 2. Ana types one letter. | Bruno and Carla see "**Ana** está digitando…" with the animated dots, between the list and the input. Ana sees nothing. |
| 3. Ana stops typing and waits. | About 2 s after her last keystroke the indicator disappears for Bruno and Carla; the layout does not jump. |
| 4. Ana and Bruno type at the same time. | Carla sees "**Ana** e **Bruno** estão digitando…". Ana sees "**Bruno** está digitando…"; Bruno sees "**Ana** está digitando…". |
| 5. Ana, Bruno and Carla all type. | Each window lists only the other two (e.g. Carla: "**Ana** e **Bruno** estão digitando…"). Open a 4th window (Davi) to see "**Ana**, **Bruno** e **Carla** estão digitando…". |
| 6. Ana types and presses Enter. | Her name disappears from Bruno's and Carla's indicator immediately, as her message appears. |
| 7. Ana keeps typing continuously for 5 s (DevTools → Network → WS on Ana's window). | At most about 2 typing frames per second are sent; the indicator stays visible for the others the whole time. |
| 8. In Bruno's window, send enough messages to make the list scroll, then scroll up more than 40 px. | No pill yet. |
| 9. Ana sends one message. | Bruno sees a pill at the bottom center of the list: "1 nova mensagem". Bruno's list does not scroll. |
| 10. Carla sends two more messages. | Bruno's pill shows "3 novas mensagens". |
| 11. Bruno clicks the pill. | The list scrolls smoothly to the bottom and the pill disappears. |
| 12. Bruno scrolls up again; Ana sends a message; Bruno scrolls down by hand to the bottom. | Pill appears with "1 nova mensagem" and disappears when Bruno reaches the bottom. |
| 13. Bruno scrolls up and sends a message himself. | The list scrolls to the bottom (FR-06) and no pill appears; his own message is never counted. |
| 14. Bruno stays at the bottom while Ana sends messages. | The list follows the new messages (FR-05); no pill. |
| 15. Repeat steps 2–6 and 8–13 after Carla reloads her page and joins again. | Same behaviour; no history (FR-07). |

## How to run the tests

```bash
# Back-end (from the repository root)
cd back-end
npm test                         # vitest run
npx vitest run --coverage        # with coverage (needs @vitest/coverage-v8, see below)

# Front-end (from the repository root)
cd front-end
npm test                         # ng test --watch=false
npx ng test --watch=false --coverage

# Everything: types, lint, dependency rules, tests, AOT build, both folders
bash scripts/validate.sh         # must print ALL CHECKS PASSED
```

Coverage needs the V8 provider, which is not in `package.json`. Install it without changing
the project files, matching the installed Vitest version:

```bash
cd back-end  && npm install --no-save @vitest/coverage-v8@5.1.1
cd front-end && npm install --no-save @vitest/coverage-v8@5.1.0
```
