# Testing – typing indicator and unread counter (FR-10 to FR-19)

How the new behaviour is tested. Test names are quoted exactly as they appear in the
spec files (`describe › it`). Time logic is tested with marble tests (`TestScheduler`,
virtual time), so 500 ms / 2 s timings are checked exactly and instantly.

Files:

| Side | Spec file | What it tests |
| --- | --- | --- |
| Back-end | `back-end/src/domain/events.spec.ts` | Parsing of the new `typing` events, garbage input (R8) |
| Back-end | `back-end/src/streams/socket.spec.ts` | Typing frames over a (fake) `ws` socket |
| Back-end | `back-end/src/streams/typing.spec.ts` | 500 ms throttle (marble) |
| Back-end | `back-end/src/streams/chat-room.spec.ts` | Room relays typing to others only, throttled (marble) |
| Front-end | `front-end/src/app/domain/events.spec.ts` | Same parsing tests as the back-end copy |
| Front-end | `front-end/src/app/domain/typing.spec.ts` | Indicator text, which keys count as typing |
| Front-end | `front-end/src/app/domain/unread.spec.ts` | Pill text |
| Front-end | `front-end/src/app/streams/typing.spec.ts` | Throttle, 2 s timeout, removal on message, self-filter (marble) |
| Front-end | `front-end/src/app/streams/unread.spec.ts` | Counter rules (marble) |
| Front-end | `front-end/src/app/streams/chat-session.spec.ts` | Session wiring: `typed()`, `typingSent$`, `typingNames$` |
| Front-end | `front-end/src/app/streams/scroll.spec.ts` | Smooth scroll to bottom |
| Front-end | `front-end/src/app/chat/chat-room/chat-room.spec.ts` | Component: DOM, keystrokes, pill, scroll |

## Typing indicator (FR-10 to FR-14)

### Back-end

| Requirement | Step | Expected | Test |
| --- | --- | --- | --- |
| FR-10 | Client sends `{"type":"typing"}` | Parsed as `{ type: 'typing' }`; spoofed `userId`/`name` fields are dropped | `parseClientEvent typing (FR-10) › parses a typing event and drops any extra fields` |
| FR-10 | Client sends a malformed typing frame (`"typing"`, `[{"type":"typing"}]`) | Parsed to `null`, never throws | `parseClientEvent › returns null for typing as a string (R8)`, `… typing in an array (R8)` |
| FR-10 | Socket receives broken JSON, a binary typing frame, then a valid one | Only the valid one comes out; stream stays alive | `clientEvent$ (R8, FR-08) › accepts typing frames and drops malformed ones (FR-10, R8)` |
| FR-10 | Keystrokes at 0, 1, 499, 501, 1100 ms | Relayed at 0, 501, 1100 (one per 500 ms window) | `throttleTyping (FR-10) › relays the first keystroke and drops the rest of the 500 ms window` |
| FR-10 | Window constant | 500 ms | `throttleTyping (FR-10) › uses a 500 ms window` |
| FR-10 | Ana sends typing at 2, 3, 399 and 599 ms | Bruno receives typing at 2 and 599 only | `chatRoom › typing indicator › relays at most one typing event per user every 500 ms (FR-10)` |
| FR-11 | Ana types; Bruno types | Bruno receives `{type:'typing', name:'Ana'}`; Ana receives `name:'Bruno'` | `chatRoom › typing indicator › relays typing to every other joined client, never back to the typist (FR-11, FR-13)` |
| FR-11 | Server sends `{"type":"typing","userId":"u1","name":"Ana"}` | Parsed by the client-side parser (shared file) | `parseServerEvent › parses a valid typing event (FR-11)` |
| FR-11 | Server typing event without `userId` / `name` / with numeric name | `null` | `parseServerEvent › returns null for typing without userId (R8)` (+ 2 more cases) |
| FR-12 | Ana types, then sends a message | Bruno gets typing then the message, in order (the client uses the message to clear the name) | `chatRoom › typing indicator › still delivers messages in order after typing (FR-03, FR-12 relies on the message event)` |
| FR-13 | Ana types | Ana's own socket never receives her typing event | `chatRoom › typing indicator › relays typing to every other joined client, never back to the typist (FR-11, FR-13)` |
| FR-07 / FR-10 | Typing before join; a user who joins later | Pre-join typing is ignored; late joiner gets no earlier typing | `chatRoom › typing indicator › ignores typing before join and does not relay it to late joiners (FR-07)` |
| FR-14 | — | Layout only, nothing on the server | n/a |

### Front-end

| Requirement | Step | Expected | Test |
| --- | --- | --- | --- |
| FR-10 | Keystrokes at 0, 1, 2, 300, 499, 501, 1200 ms | Pings at 0, 501, 1200 | `typingPings$ (FR-10) › sends at most one ping per 500 ms while the user keeps typing` |
| FR-10 | No keystrokes | No pings | `typingPings$ (FR-10) › sends nothing without keystrokes` |
| FR-10 | `session.typed()` at 1, 2, 300, 600 ms | `{type:'typing'}` sent twice (1 and 600) | `chatSession › typed() sends at most one typing event per 500 ms and reports it on typingSent$ (FR-10)` |
| FR-10 | Which keys count | Letters, space, accents, emoji, Backspace, Delete, IME keys count; Enter, Tab, arrows, Shift, Esc, F5, Ctrl/Cmd shortcuts do not | `isTypingKey (FR-10) › counts printable characters and editing keys`, `… ignores Enter, navigation, modifiers and shortcuts` |
| FR-10 | In the component: press Tab, Enter, Ctrl+C, then `o`, `i`, Backspace | Nothing for the first three, then exactly one `{type:'typing'}` | `ChatRoom › typing indicator › sends one typing event for a burst of keystrokes, ignoring Enter/Tab/shortcuts (FR-10)` |
| FR-11 | Format 1 / 2 / 3 / 4 names | "Ana está digitando…", "Ana e Bruno estão digitando…", "Ana, Bruno e Carla estão digitando…", "Ana, Bruno, Carla e Davi estão digitando…" | `typingText (FR-11) › formats one, two and three names`, `… keeps the same pattern for more names` |
| FR-11 | Names are marked for bold rendering | `isName: true` on names only | `typingParts (FR-11) › marks names so they can be rendered bold` |
| FR-11 | Bruno, then Carla and Davi start typing (component) | Strip reads "Bruno está digitando…", then "Bruno, Carla e Davi estão digitando…" with names in `<strong>`; strip sits between the list and the composer | `ChatRoom › typing indicator › shows who is typing between the list and the input, with names in bold (FR-11)` |
| FR-11 | Several typists | Listed in the order they started; re-typing keeps the position | `activeTypers$ › lists several typists in the order they started, each with their own timer (FR-11, FR-12)` |
| FR-12 | Ana types at 1 and 501 ms | Name shown from 1 ms, removed at 2501 ms (2 s after the last keystroke) | `activeTypers$ › shows a user while typing and drops them 2 s after the last keystroke (FR-11, FR-12)` |
| FR-12 | Timeout constant | 2000 ms | `activeTypers$ › uses a 2 s idle timeout` |
| FR-12 | Ana types, then her message arrives | Name removed at once, no timer left | `activeTypers$ › drops a user immediately when their message arrives (FR-12)` |
| FR-12 | Bruno sends a message while only Ana types | Ana stays until her own timeout | `activeTypers$ › a message from someone not typing changes nothing` |
| FR-12 | Bruno and Carla typing, Bruno's message arrives (component) | Strip reads "Carla está digitando…" | `ChatRoom › typing indicator › removes a name immediately when that user sends a message (FR-12)` |
| FR-13 | Typing event with my own `userId` | Never listed | `activeTypers$ › never shows the current user (FR-13)` |
| FR-13 | Own id is taken from the `joined` ack; events before it are ignored | Only Bruno listed | `typingNames$ › waits for the join ack to learn who "me" is (FR-13)` |
| FR-13 | Session level | `typingNames$` shows Bruno, not Ana (me) | `chatSession › typingNames$ lists other users typing, never the current user (FR-11, FR-13)` |
| FR-13 | Component receives my own typing event | Strip stays empty | `ChatRoom › typing indicator › never shows the current user (FR-13)` |
| FR-14 | Nobody typing → someone typing → nobody | Same `.strip` element all along, empty when nobody types | `ChatRoom › typing indicator › keeps the same strip element, empty, when nobody is typing (FR-14)`, `ChatRoom › keeps the reserved indicator strip` |
| FR-14 | Strip height | 32 px whether empty or not (jsdom has no layout, so the pixel height is checked by hand) | manual (step 3 and 9 of the manual test) |
| R8 | Non-typing/non-message events (e.g. `joined`) | Ignored by the typing stream | `activeTypers$ › ignores events that are neither typing nor messages` |

## Unread counter (FR-15 to FR-19)

### Back-end

| Requirement | Step | Expected | Test |
| --- | --- | --- | --- |
| FR-15 to FR-19 | — | Purely client-side; the server only delivers messages in order (already covered by `chatRoom › acks the join and broadcasts every message to every joined client in order (FR-03)`) | n/a |

### Front-end

| Requirement | Step | Expected | Test |
| --- | --- | --- | --- |
| FR-15 | 3 messages from others while scrolled up | Counter 1, 2, 3 | `unreadCount$ › counts others' messages while scrolled up (FR-15)` |
| FR-15 | Messages from others: at bottom, scrolled up, at bottom | Only the scrolled-up one counts | `unreadCount$ › does not count others' messages while at the bottom (FR-15)` |
| FR-15 | 40 px threshold | ≤ 40 px from bottom = at bottom | `isNearBottom (FR-05) › is true within 40 px of the bottom and false beyond` (existing) |
| FR-15 | Component, list scrolled 600 px up, other's message arrives | Pill appears | `ChatRoom › unread counter › counts others' messages while scrolled up and shows singular/plural (FR-15, FR-16)` |
| FR-15 | Component, list 20 px from bottom, other's message arrives | No pill | `ChatRoom › unread counter › does not count while at the bottom (FR-15)` |
| FR-16 | Label for 0, 1, 2, 13, -1, NaN | null (hidden), "1 nova mensagem", "2 novas mensagens", "13 novas mensagens", null, null | `unreadLabel (FR-16) › is hidden (null) at 0`, `… uses the singular for 1 and the plural for more`, `… treats nonsense counts as nothing unread` |
| FR-16 | Component with nothing unread | No `.unread-pill` | `ChatRoom › unread counter › is hidden at 0 (FR-16)` |
| FR-16 | Component after 1, then 3 unread | "1 nova mensagem", then "3 novas mensagens" | `ChatRoom › unread counter › counts others' messages while scrolled up and shows singular/plural (FR-15, FR-16)` |
| FR-16 | Pill position (bottom centre of the list) | Visual | manual (step 13 of the manual test) |
| FR-17 | Click the pill | `scrollTo({ top: scrollHeight, behavior: 'smooth' })` called; pill disappears | `ChatRoom › unread counter › clicking the pill scrolls smoothly to the bottom and resets to 0 (FR-17)` |
| FR-17 | `smoothScrollToBottom` | Uses smooth `scrollTo`; falls back to setting `scrollTop` | `smoothScrollToBottom (FR-17) › asks the browser for a smooth scroll to the end`, `… falls back to a jump where scrollTo is missing` |
| FR-17 / FR-18 | Reset in the middle of counting, then a new message | 0, then counts from 1 again | `unreadCount$ › resets to 0 on reset$ and counts again afterwards (FR-17, FR-18)` |
| FR-18 | Scroll events: up, up, bottom, up, bottom | Reset only for the two "bottom" events | `reachedBottom$ (FR-18) › emits only for scroll events that end at the bottom` |
| FR-18 | Component: scroll but stay 300 px up, then scroll to the bottom | Pill stays at "1 nova mensagem", then disappears | `ChatRoom › unread counter › reaching the bottom by scrolling resets to 0 (FR-18)` |
| FR-19 | Own, other, own while scrolled up | Only the other counts | `unreadCount$ › never counts own messages (FR-19)` |
| FR-19 | Component, scrolled up, own message arrives | No pill | `ChatRoom › unread counter › never counts own messages (FR-19)` |

## Manual test with 3 browser windows

Setup: `cd back-end && npm start` (ws://localhost:3000) and `cd front-end && npm start`
(http://localhost:4200). Open three windows side by side and join as **Ana**, **Bruno**
and **Carla**.

| Step | Expected |
| --- | --- |
| 1. Each window joins (Ana, Bruno, Carla). | All three see the chat. The strip above the input is empty. |
| 2. Exchange a few messages from each window. | FR-01 to FR-08 unchanged: everyone sees every message in order, own messages on the right. |
| 3. In Carla's window, inspect the strip under the list (DevTools). | Height is 32 px while empty (FR-14). |
| 4. Ana types continuously for ~3 s (watch the Network › WS tab in Ana's window). | Ana sends at most 2 `typing` frames per second (FR-10). Bruno and Carla see "**Ana** está digitando…" with animated dots; Ana sees nothing in her own strip (FR-13). |
| 5. Ana stops typing. | About 2 s after her last key, the indicator disappears in Bruno's and Carla's windows (FR-12). |
| 6. Ana and Bruno type at the same time. | Carla sees "**Ana** e **Bruno** estão digitando…" (FR-11). Ana sees only "**Bruno** está digitando…", Bruno only "**Ana** está digitando…" (FR-13). |
| 7. Ana, Bruno and Carla all type. | Each window shows the other two. Messages list and input do not move (FR-14). |
| 8. While Ana and Bruno type, Ana presses Enter to send. | In Carla's window "Ana" disappears immediately, "Bruno está digitando…" remains (FR-12). |
| 9. Everybody stops. | Strip goes blank after ~2 s; the message list does not change height (FR-14). |
| 10. Press Tab, arrow keys or Ctrl+A in Ana's input. | No `typing` frame is sent; nobody sees Ana typing (FR-10). |
| 11. Send enough messages to make the list scroll. In Bruno's window, scroll to the top. | No pill yet. |
| 12. Ana sends one message. | Bruno sees a pill "1 nova mensagem" at the bottom centre of the list (FR-15, FR-16). His scroll position does not change (FR-05). |
| 13. Ana and Carla send two more messages. | Bruno's pill shows "3 novas mensagens" (FR-15, FR-16). Position matches `docs/design/unread.png`. |
| 14. Bruno clicks the pill. | The list scrolls smoothly to the bottom; the pill disappears (FR-17). |
| 15. Bruno scrolls up again; Ana sends one message. | Pill "1 nova mensagem". |
| 16. Bruno scrolls to the bottom with the mouse wheel. | Pill disappears as he reaches the bottom (FR-18). |
| 17. Bruno scrolls up, then sends a message himself. | No pill; his list jumps to the bottom (FR-06, FR-19). |
| 18. Bruno scrolls up just a little (less than 40 px from the bottom); Ana sends a message. | No pill; Bruno's list follows the new message (FR-05, FR-15). |
| 19. Carla stays at the bottom throughout steps 12–18. | Carla never sees a pill (FR-15). |

## How to run the tests

Everything (what "done" means for this repo):

```bash
bash scripts/validate.sh
```

Back-end:

```bash
cd back-end
npm install
npm run typecheck && npm run lint && npm run lint:deps
npm test                      # = vitest run
```

Front-end:

```bash
cd front-end
npm install
npm run typecheck && npm run lint && npm run lint:deps
npm test                      # = ng test --watch=false
npx ng build --configuration development
```

Coverage (needs `@vitest/coverage-v8`, which is not in `package.json`; install it without
saving, matching each folder's vitest version):

```bash
cd back-end  && npm install --no-save @vitest/coverage-v8@5.1.1 && npx vitest run --coverage
cd front-end && npm install --no-save @vitest/coverage-v8@5.1.0 && npx ng test --watch=false --coverage
```
