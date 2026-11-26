# Testing – typing indicator and unread counter

How FR-10 to FR-19 (see `requirements.md`) are tested. Test names are written as
`file › describe › it`. Time-based behaviour (500 ms throttle, 2 s expiry) is tested with
marble tests (`TestScheduler`, virtual time), so no test waits for real time.

## Typing indicator (FR-10 to FR-14)

### Back-end

| Requirement | Step | Expected |
| --- | --- | --- |
| FR-10 | A client sends the frame `{"type":"typing"}` | It is parsed to `{ type: 'typing' }`; extra fields (e.g. a forged `name`) are dropped — `events.spec.ts › typing events › parses a client typing ping, ignoring extra fields` |
| FR-10 | A client sends malformed typing frames (truncated JSON, binary, bare string `"typing"`) | They are dropped and the stream keeps going — `socket.spec.ts › clientEvent$ typing frames (R8, FR-10) › passes typing pings and drops malformed ones` |
| FR-10 | Typing pings at 0, 1, 499, 500, 501, 700 ms go through the server throttle | Only 0 and 501 pass (500 ms window) — `typing.spec.ts › throttleTyping (FR-10) › lets one ping through per 500 ms` |
| FR-10 | Ana floods typing pings (11, 12, 13, 301, 512 ms) while Bruno also types | Bruno receives "Ana is typing" only at 11 and 512 ms; Bruno's own window is independent — `chat-room.spec.ts › chatRoom › typing indicator › relays at most one typing event per 500 ms per user (FR-10)` |
| FR-11 | Ana, Bruno and Carla join; Ana sends a typing ping | Bruno and Carla receive `{ type: 'typing', userId, name: 'Ana' }` — `chat-room.spec.ts › chatRoom › typing indicator › relays typing to the other clients, never back to the typist (FR-11, FR-13)` |
| FR-11 | A client sends a typing ping before joining | Nobody receives anything — `chat-room.spec.ts › chatRoom › typing indicator › ignores typing before join` |
| FR-12 | Ana types, then sends a message | Others get the typing event, then the message, in that order (the client uses the message to clear Ana's name) — `chat-room.spec.ts › chatRoom › typing indicator › keeps typing and messages in server order` |
| FR-13 | Ana sends a typing ping | Ana herself receives no typing event — `chat-room.spec.ts › chatRoom › typing indicator › relays typing to the other clients, never back to the typist (FR-11, FR-13)` |
| FR-14 | (layout only) | No back-end part — manual |
| R8 | `parseServerEvent` (shared `events.ts`) gets bad typing shapes (no `userId`, no `name`, non-string name); `parseClientEvent` gets `[{"type":"typing"}]` or `{"type":"TYPING"}` | Parsed to `null` — `events.spec.ts › typing events › returns null for server typing …` / `returns null for client …` |

### Front-end

| Requirement | Step | Expected |
| --- | --- | --- |
| FR-10 | Keystrokes at 0, 1, 500 (boundary), 501, 1002 ms | Pings at 0, 501, 1002 — `streams/typing.spec.ts › typingPings$ (FR-10) › sends the first keystroke at once, then at most one per 500 ms` |
| FR-10 | One keystroke every 100 ms for 600 ms | Pings at 0 and 600 ms only — `streams/typing.spec.ts › typingPings$ (FR-10) › a steady stream of keystrokes (every 100 ms) sends one ping per 500 ms` |
| FR-10 | `session.keystroke()` at 1, 2, 303, 604 ms | `{ type: 'typing' }` sent to the server exactly twice (1 and 604 ms) — `chat-session.spec.ts › chatSession › keystroke() sends at most one typing ping per 500 ms (FR-10)` |
| FR-10 | Type "o", "oi", "oi!" quickly in the message box | Exactly one `{ type: 'typing' }` is sent — `chat-room.spec.ts › ChatRoom › typing indicator › sends one typing event for a burst of keystrokes (FR-10)` |
| FR-10 | Send a message (the input is cleared programmatically) | Clearing does not send another typing event — `chat-room.spec.ts › ChatRoom › typing indicator › does not send typing when the input is cleared after sending (FR-10)` |
| FR-11 | Build the label for 0, 1, 2, 3 and 4 names | "", "Ana está digitando…", "Ana e Bruno estão digitando…", "Ana, Bruno e Carla estão digitando…", "Ana, Bruno, Carla e Davi estão digitando…" — `indicator-text.spec.ts › typingLabel (FR-11) › …` |
| FR-11 | Bruno, then Carla, then Davi send typing events | The strip shows "Bruno está digitando…" → "Bruno e Carla estão digitando…" → "Bruno, Carla e Davi estão digitando…", names in bold — `chat-room.spec.ts › ChatRoom › typing indicator › shows who is typing, in the design wording (FR-11)` |
| FR-11 | Ana, Bruno, Carla start typing at 1, 2, 3 ms | Names listed in start order; each expires on its own timer — `streams/typing.spec.ts › typingUsers$ › keeps several users in the order they started, each with its own timer` |
| FR-12 | Ana types once | Her name appears and is removed exactly 2000 ms later — `streams/typing.spec.ts › typingUsers$ › starts empty, shows a name, and removes it 2 s after the last keystroke` |
| FR-12 | Ana types at 1 ms and again at 1001 ms | Her name stays until 3001 ms (timer restarts) — `streams/typing.spec.ts › typingUsers$ › restarts the 2 s timer on every new typing event from that user` |
| FR-12 | Ana types, then sends a message 100 ms later | Her name is removed at once — `streams/typing.spec.ts › typingUsers$ › removes a name immediately when that user sends a message (FR-12)` and `chat-room.spec.ts › ChatRoom › typing indicator › removes a name as soon as that user sends a message (FR-12)` |
| FR-12 | Ana and Bruno type; Ana sends a message | Only Ana's name is removed — `streams/typing.spec.ts › typingUsers$ › one user's message does not clear another user's name` |
| FR-12 | Ana's name expires, then she types again | Her name comes back and expires again 2 s later — `streams/typing.spec.ts › typingUsers$ › can be shown again after expiring` |
| FR-11–13 | Full session: Bruno and Carla type, own typing event arrives, Bruno sends a message | `typing$` = [] → [Bruno] → [Bruno, Carla] → [Carla] → [] at 2005 ms — `chat-session.spec.ts › chatSession › typing$ shows other users typing and clears them on their message or after 2 s (FR-11 to FR-13)` |
| FR-13 | A typing event with the user's own id arrives | It is dropped; typing events before the join ack are dropped too — `chat-session.spec.ts › typingSignals$ (FR-12, FR-13) › waits for the join ack, drops own typing, and turns messages into stops` |
| FR-13 | The component receives a typing event for its own user | The strip stays empty — `chat-room.spec.ts › ChatRoom › typing indicator › never shows the own name (FR-13)` |
| FR-14 | Nobody is typing | The `.strip` element is still rendered (empty) — `chat-room.spec.ts › ChatRoom › typing indicator › keeps the strip in the layout while empty (FR-14)` and `chat-room.spec.ts › ChatRoom › keeps the reserved indicator strip` |
| FR-14 | Names appear and disappear while watching the message list and input | The list and the input do not move (the strip is a fixed 32 px; jsdom has no layout) — manual |

## Unread counter (FR-15 to FR-19)

### Back-end

| Requirement | Step | Expected |
| --- | --- | --- |
| FR-15 to FR-19 | (client-only: scroll position, pill, counter) | No back-end change; messages are still broadcast in order — existing `chat-room.spec.ts › chatRoom › acks the join and broadcasts every message to every joined client in order (FR-03)` — manual for the feature itself |

### Front-end

| Requirement | Step | Expected |
| --- | --- | --- |
| FR-15 | Three messages from others arrive while scrolled up | Counter 0 → 1 → 2 → 3 — `streams/unread.spec.ts › unreadCount$ › counts others' messages while scrolled up (FR-15)` |
| FR-15 | Messages from others arrive at bottom / scrolled up / at bottom | Only the scrolled-up one counts — `streams/unread.spec.ts › unreadCount$ › does not count when the user is at the bottom (FR-15)` |
| FR-15 | Component: list 1000 px tall, 300 px visible, scrollTop 0; a message from Bruno arrives | Pill appears — `chat-room.spec.ts › ChatRoom › unread counter › counts others' messages while scrolled up, with singular/plural text (FR-15, FR-16)` |
| FR-15 | Component: scrollTop 700 (0 px from bottom); a message from Bruno arrives | No pill — `chat-room.spec.ts › ChatRoom › unread counter › does not count when the user is at the bottom (FR-15)` |
| FR-16 | Format the label for 0, 1, 2, 12 | "", "1 nova mensagem", "2 novas mensagens", "12 novas mensagens" — `indicator-text.spec.ts › unreadLabel (FR-16) › …` |
| FR-16 | Component: 1 then 3 unread messages | Pill text "1 nova mensagem", then "3 novas mensagens" — `chat-room.spec.ts › ChatRoom › unread counter › counts others' messages while scrolled up, with singular/plural text (FR-15, FR-16)` |
| FR-16 | Counter is 0 | No pill in the DOM — `chat-room.spec.ts › ChatRoom › unread counter › is hidden at 0 (FR-16)`; repeated resets at 0 emit nothing — `streams/unread.spec.ts › unreadCount$ › does not emit on resets while already at 0 (pill stays hidden, FR-16)` |
| FR-16 | Pill position (bottom center of the list) | Matches `docs/design/unread.png` — manual |
| FR-17 | Pill click while counter is 2 | Counter resets to 0, later messages count from 1 again — `streams/unread.spec.ts › unreadCount$ › resets to 0 when the pill is clicked (FR-17)` |
| FR-17 | Component: click the pill | `scrollTo({ top: scrollHeight, behavior: 'smooth' })` is called and the pill disappears — `chat-room.spec.ts › ChatRoom › unread counter › clicking the pill scrolls smoothly to the bottom and resets the counter (FR-17)` |
| FR-17 | Smooth-scroll helper with and without `scrollTo` | Calls `scrollTo` with `behavior: 'smooth'`; falls back to setting `scrollTop` — `scroll.spec.ts › scrollToBottomSmoothly (FR-17) › …` |
| FR-18 | Scroll events: one still scrolled up, one at the bottom | Only the one at the bottom resets — `streams/unread.spec.ts › unreadCount$ › resets to 0 when scrolling reaches the bottom, not on other scrolls (FR-18)` |
| FR-18 | Component: scroll to 200 px, then to 35 px from the bottom | Pill stays at "2 novas mensagens", then disappears — `chat-room.spec.ts › ChatRoom › unread counter › scrolling to the bottom resets the counter; scrolling elsewhere does not (FR-18)` |
| FR-19 | Own, other, own messages arrive while scrolled up | Counter goes to 1 only for the other's message — `streams/unread.spec.ts › unreadCount$ › never counts own messages (FR-19)` |
| FR-19 | Component: own message while scrolled up; other's then own message | Own messages never add to the pill — `chat-room.spec.ts › ChatRoom › unread counter › never counts own messages (FR-19)` |

## Manual test – 3 browser windows (Ana, Bruno, Carla)

Start the back-end (`cd back-end && npm start`) and the front-end (`cd front-end && npm start`),
open `http://localhost:4200` in three windows side by side and join as Ana, Bruno and Carla.

| Step | Expected |
| --- | --- |
| 1. Look at the area between the message list and the input in all windows | Empty, 32 px high; nothing moves (FR-14) |
| 2. Ana types a few letters | Bruno and Carla see "**Ana** está digitando…" with animated dots; Ana sees nothing (FR-11, FR-13) |
| 3. Ana stops typing and waits | The indicator disappears in Bruno's and Carla's windows about 2 s after her last keystroke (FR-12) |
| 4. Ana and Bruno type at the same time | Carla sees "**Ana** e **Bruno** estão digitando…"; Ana sees "**Bruno** está digitando…"; Bruno sees "**Ana** está digitando…" (FR-11, FR-13) |
| 5. Ana, Bruno and Carla all type | Each sees the other two; with a 4th window, "Ana, Bruno e Carla estão digitando…" (FR-11) |
| 6. Ana keeps typing and presses Enter | Her name disappears from the others' indicator immediately, as her message appears (FR-12) |
| 7. Throughout steps 2–6, watch the list and the input | They never jump when the indicator appears or disappears (FR-14) |
| 8. In DevTools (Network › WS) in Ana's window, type continuously for 3 s | About one `{"type":"typing"}` frame every 500 ms, never more (FR-10) |
| 9. Send enough messages to make the list scroll. Carla scrolls up more than 40 px from the bottom | No pill yet |
| 10. Ana sends a message | Carla sees a pill at the bottom center of the list: "1 nova mensagem"; Carla's list does not move (FR-15, FR-16) |
| 11. Bruno sends two messages | Carla's pill: "3 novas mensagens" (FR-15, FR-16) |
| 12. Carla clicks the pill | The list scrolls smoothly to the bottom; the pill disappears (FR-17) |
| 13. Carla scrolls up again; Ana sends one message; Carla scrolls down by hand to the bottom | The pill shows "1 nova mensagem", then disappears when Carla reaches the bottom (FR-18) |
| 14. Carla scrolls up and sends a message herself | Her list jumps to the bottom (FR-06); no pill appears and the counter does not grow (FR-19) |
| 15. Bruno is at the bottom; Ana sends a message | Bruno's list follows the new message (FR-05); no pill (FR-15) |
| 16. Send a malformed frame from DevTools (e.g. `ws.send('{"type":"typing"')`) | Nothing happens; the server and the other windows keep working (FR-08) |

## How to run the tests

```bash
# Everything (both folders, lint, dependency rules, tests, build) — "done" = ALL CHECKS PASSED
bash scripts/validate.sh

# Back-end
cd back-end
npm test                     # vitest run
npx vitest run --coverage    # needs @vitest/coverage-v8 (see run-log.md)

# Front-end
cd front-end
npm test                     # ng test --watch=false
npx ng test --watch=false --coverage
```
