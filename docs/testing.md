# Testing – typing indicator and unread counter (FR-10 to FR-19)

How the new behaviour is tested. Test names are given as `file › describe › it`.
Paths are relative to `back-end/src/` or `front-end/src/app/`.

Kinds of tests used:

- **Marble tests** (`TestScheduler`, virtual time) for every stream with time logic: the 500 ms
  throttle and the 2 s typing timeout are checked to the millisecond, without waiting.
- **Unit tests** for the pure functions in `domain/` (protocol parsing, indicator and pill texts).
- **Component tests** (Angular `TestBed` + jsdom) that drive the real `ChatRoom` with a fake
  server stream. jsdom has no layout, so the unread tests give the list a fake
  `scrollHeight`/`clientHeight`/`scrollTop` and stub `scrollTo`.

## Typing indicator (FR-10 to FR-14)

Protocol: the client sends `{ "type": "typing" }`; the server relays
`{ "type": "typing", "userId", "name" }` to every *other* joined user. A name is removed when
its 2 s countdown runs out or when a message from the same user arrives, so no "stopped typing"
event is needed.

### Back-end

| Requirement | Step | Expected | Test |
| --- | --- | --- | --- |
| FR-10 | Parse `{"type":"typing"}` from a client (extra fields ignored) | `{ type: 'typing' }` | `domain/events.spec.ts › typing events › parses a client typing event, ignoring extra fields` |
| FR-10 | Feed garbage typing frames (`"typing"`, wrong case) | `null`, never throws (R8) | `domain/events.spec.ts › typing events › returns null for a client typing event that is not an object (R8)` |
| FR-10 | Throttle constant | 500 ms | `streams/typing.spec.ts › throttleTyping$ › uses a 500 ms window by default` |
| FR-10 | Keystrokes at 0, 1, 499, 502, 503 ms | relayed at 0 and 502 only | `streams/typing.spec.ts › throttleTyping$ › relays the first keystroke at once and drops the rest of the 500 ms window` |
| FR-10 | A keystroke every 120 ms for 1.2 s | relayed at 0, 600, 1200 | `streams/typing.spec.ts › throttleTyping$ › relays one event per window during continuous typing` |
| FR-10 | Custom window (10 ms) | same rule with the custom window | `streams/typing.spec.ts › throttleTyping$ › honours a custom window` |
| FR-10 | Ana sends typing at 3, 4, 5, 302 and 602 ms through the room | Bruno gets typing(Ana) at 3 and 602 only | `streams/chat-room.spec.ts › chatRoom › relays at most one typing event per user per 500 ms (FR-10)` |
| FR-10 | Ana types at 3 and 5, Bruno at 4 | Carla gets Ana at 3 and Bruno at 4 (separate throttle per user) | `streams/chat-room.spec.ts › chatRoom › throttles each user separately (FR-10)` |
| FR-11 | Ana, Bruno and Carla joined; Ana and Bruno type | each other user receives `typing` with the typer's name | `streams/chat-room.spec.ts › chatRoom › relays typing to the other joined users, never back to the typer (FR-11, FR-13)` |
| FR-11 | A client types before joining | nothing is relayed | `streams/chat-room.spec.ts › chatRoom › ignores typing before join (FR-11)` |
| FR-11 | Parse a server `typing` event; feed malformed ones | parsed / `null` (R8) | `domain/events.spec.ts › typing events › parses a server typing event…` and `› returns null for server %s (R8)` (4 cases) |
| FR-12 | Ana types, then sends a message | Bruno receives typing then the message; Ana receives only her message | `streams/chat-room.spec.ts › chatRoom › still delivers own messages to the sender after typing (FR-03, FR-12)` |
| FR-12 | Removal after 2 s / on message | done by the client (see front-end); the server keeps no typing state | – |
| FR-13 | Ana types | Ana receives no typing event about herself | `streams/chat-room.spec.ts › chatRoom › relays typing to the other joined users, never back to the typer (FR-11, FR-13)` |
| FR-14 | Indicator height | front-end only | – |
| FR-10/11/13 | Real server + 3 `ws` clients: Ana sends a 5-keystroke burst, garbage, a 2nd ping >500 ms later, then a message | Bruno and Carla get 2 typing(Ana) + the message; Ana gets no typing; server keeps running | manual (scripted smoke test, see `docs/run-log.md`) |

### Front-end

| Requirement | Step | Expected | Test |
| --- | --- | --- | --- |
| FR-10 | Throttle constant | 500 ms | `streams/typing.spec.ts › typingPings$ (FR-10) › uses a 500 ms window by default` |
| FR-10 | Keystrokes at 0, 1, 499, 502, 503 ms | pings at 0 and 502 | `streams/typing.spec.ts › typingPings$ (FR-10) › sends the first keystroke at once and at most one ping per 500 ms` |
| FR-10 | A keystroke every 120 ms for 1.2 s | pings at 0, 600, 1200 | `streams/typing.spec.ts › typingPings$ (FR-10) › keeps pinging every 500 ms while the user keeps typing` |
| FR-10 | `session.typed()` at 1, 2, 3, 600 ms | `{type:'typing'}` sent twice (1 and 600) | `streams/chat-session.spec.ts › chatSession › typed() sends at most one typing event per 500 ms and reports it on typingSent$ (FR-10)` |
| FR-10 | Type 3 characters quickly into the message box | exactly one `{type:'typing'}` sent | `chat/chat-room/chat-room.spec.ts › ChatRoom › typing indicator › sends one typing event for a burst of keystrokes (FR-10)` |
| FR-11 | 1, 2, 3, 4 names | "Ana está digitando…", "Ana e Bruno estão digitando…", "Ana, Bruno e Carla estão digitando…", "Ana, Bruno, Carla e Dani estão digitando…" | `domain/typing-label.spec.ts › typingLabel (FR-11)` (4 tests) |
| FR-11 | Segments for bold names | only names are marked | `domain/typing-label.spec.ts › typingSegments (FR-11) › marks exactly the names so they can be rendered bold` |
| FR-11 | Three users start typing at 1, 3, 5 ms | list grows in start order: [Ana] → [Ana, Bruno] → [Ana, Bruno, Carla] | `streams/typing.spec.ts › whoIsTyping$ › lists several typers in the order they started, each with its own countdown (FR-11, FR-12)` |
| FR-11 | Server sends typing for Bruno, then Carla, then Dani | strip shows the 3 texts, names in `<strong>`, strip is between `.list` and `.composer` | `chat-room.spec.ts › ChatRoom › typing indicator › shows who is typing, with names in bold, between the list and the input (FR-11)` |
| FR-11 | Repeated typing from the same user | no duplicate emission | `streams/typing.spec.ts › whoIsTyping$ › does not emit again while the list is unchanged` |
| FR-11 | Bad server frames (malformed typing) | dropped, stream continues (R8) | `domain/events.spec.ts › typing events › returns null for server %s (R8)` |
| FR-12 | Timeout constant | 2000 ms | `streams/typing.spec.ts › whoIsTyping$ › uses a 2 s timeout by default` |
| FR-12 | Ana types once at 1 ms | shown at 1, removed at 2001 | `streams/typing.spec.ts › whoIsTyping$ › shows a name and removes it 2 s after the last typing event (FR-11, FR-12)` |
| FR-12 | Ana types at 1 and 1001 ms | removed at 3001 (countdown restarts) | `streams/typing.spec.ts › whoIsTyping$ › restarts the 2 s countdown on every new typing event (FR-12)` |
| FR-12 | 3 typers at 1, 3, 5 ms | removed at 2001, 2003, 2005 (own countdown each) | `streams/typing.spec.ts › whoIsTyping$ › lists several typers…` |
| FR-12 | Ana types, then a message from Ana arrives | removed at once | `streams/typing.spec.ts › whoIsTyping$ › removes a name immediately when that user sends a message (FR-12)` |
| FR-12 | Ana types, then a message from someone else arrives | Ana stays until her 2 s are up | `streams/typing.spec.ts › whoIsTyping$ › keeps a name when someone else's message arrives (FR-12)` |
| FR-12 | Component: Bruno types, then Bruno's message arrives | strip empty, dots gone | `chat-room.spec.ts › ChatRoom › typing indicator › removes a name as soon as that user sends a message (FR-12)` |
| FR-12 | Component: 2 s timeout in the real DOM | – | manual (covered in virtual time by the marble tests above) |
| FR-13 | Typing events carrying the own user id | never listed | `streams/typing.spec.ts › whoIsTyping$ › never shows the current user (FR-13)` |
| FR-13 | Typing before the join ack / own id from the ack | ignored / filtered | `streams/typing.spec.ts › othersTyping$ (FR-13) › waits for the join ack and filters out the id it carries` |
| FR-13 | Session wiring | own name filtered | `streams/chat-session.spec.ts › chatSession › typingNames$ lists other users typing, without the user's own name (FR-11, FR-13)` |
| FR-13 | Component: typing event with own id | strip empty | `chat-room.spec.ts › ChatRoom › typing indicator › never shows the user's own name (FR-13)` |
| FR-14 | Strip empty, then with a name | `.strip` exists, computed height `32px` both times, `flex-shrink: 0` | `chat-room.spec.ts › ChatRoom › typing indicator › keeps the strip in the layout with a fixed height when empty (FR-14)`; also `ChatRoom › keeps the reserved indicator strip` |

## Unread counter (FR-15 to FR-19)

Client-only: no protocol change. The counter is `unreadCount$(message$, isAwayFromBottom, reset$)`.
"Away" is measured when the message arrives, *before* it is rendered (same moment FR-05 uses).

### Back-end

| Requirement | Step | Expected | Test |
| --- | --- | --- | --- |
| FR-15 to FR-19 | – | Client-side only; the back-end is unchanged for this group. Message delivery it relies on is covered by the existing FR-03 tests (`streams/chat-room.spec.ts › chatRoom › acks the join and broadcasts every message…`). | – |

### Front-end

| Requirement | Step | Expected | Test |
| --- | --- | --- | --- |
| FR-15 | 3 messages from others while away | 0 → 1 → 2 → 3 | `streams/unread.spec.ts › unreadCount$ › adds 1 per message from someone else while scrolled up (FR-15)` |
| FR-15 | Messages while at / away / at the bottom | only the "away" one counts | `streams/unread.spec.ts › unreadCount$ › does not count messages that arrive while the user is at the bottom (FR-15)` |
| FR-15 | 40 px threshold | 40 px from bottom = at bottom; 41 px = away | `streams/scroll.spec.ts › isNearBottom (FR-05) › is true within 40 px of the bottom and false beyond` (existing) |
| FR-15 | Component: list scrolled to top, Bruno sends 1 then 2 messages | pill "1 nova mensagem", then "3 novas mensagens" | `chat-room.spec.ts › ChatRoom › unread counter › counts others' messages while scrolled up and shows the pill (FR-15, FR-16)` |
| FR-15 | Component: list 40 px from the bottom, Bruno sends a message | no pill | `chat-room.spec.ts › ChatRoom › unread counter › does not count while the user is within 40 px of the bottom (FR-15)` |
| FR-16 | Labels for 0, 1, N | "", "1 nova mensagem", "N novas mensagens" | `domain/unread-label.spec.ts › unreadLabel (FR-16)` (3 tests) |
| FR-16 | Component: counter 0 | no `.pill` in the DOM | `chat-room.spec.ts › ChatRoom › unread counter › is hidden at 0 (FR-16)` |
| FR-16 | Component: pill position | `.pill` is inside `.list` (absolutely positioned at bottom center via CSS) | `chat-room.spec.ts › … › counts others' messages while scrolled up and shows the pill (FR-15, FR-16)`; visual position: manual |
| FR-16 | Reset while already 0 | no extra emission, pill stays hidden | `streams/unread.spec.ts › unreadCount$ › does not emit again when reset while already at 0 (FR-16: pill stays hidden)` |
| FR-17 | Click the pill with 2 unread | `scrollTo({ top: scrollHeight, behavior: 'smooth' })`, pill disappears | `chat-room.spec.ts › ChatRoom › unread counter › clicking the pill scrolls smoothly to the bottom and resets the counter (FR-17)` |
| FR-17 | `scrollToBottomSmoothly` | asks for a smooth scroll to the end | `streams/scroll.spec.ts › scrollToBottomSmoothly (FR-17) › asks for a smooth scroll to the end` |
| FR-17/18 | `reset$` emits with a count of 2 | count → 0, then counts again | `streams/unread.spec.ts › unreadCount$ › resets to 0 on reset$ (reaching the bottom, FR-18; clicking the pill, FR-17)` |
| FR-18 | Component: scroll to 300 px from the bottom, then to the bottom | count kept, then pill disappears | `chat-room.spec.ts › ChatRoom › unread counter › scrolling down to the bottom resets the counter (FR-18)` |
| FR-19 | Own messages while away | never counted | `streams/unread.spec.ts › unreadCount$ › never counts own messages (FR-19)` |
| FR-19 | Component: 1 unread, then 2 own messages while away | still "1 nova mensagem" | `chat-room.spec.ts › ChatRoom › unread counter › never counts the user's own messages (FR-19)` |
| FR-17 | Smooth animation in a real browser | visible smooth scroll | manual |

## Manual test – 3 browser windows

Start both apps (see the last section), open http://localhost:4200 in 3 windows side by side and
join as **Ana**, **Bruno** and **Carla**. Shrink the windows so the message list can scroll.

| Step | Expected |
| --- | --- |
| 1. All three join. | Each sees the chat; the strip between the list and the input is empty but present (32 px, FR-14). No pill. |
| 2. Ana types "oi" (does not send). | Bruno and Carla see "**Ana** está digitando…" with animated dots (FR-11). Ana sees nothing in her own strip (FR-13). |
| 3. Ana stops typing and waits. | About 2 s after her last keystroke the indicator disappears in Bruno's and Carla's windows (FR-12). The layout does not move (FR-14). |
| 4. Ana and Bruno type at the same time. | Carla sees "**Ana** e **Bruno** estão digitando…"; Ana sees "**Bruno** está digitando…"; Bruno sees "**Ana** está digitando…" (FR-11, FR-13). |
| 5. Ana, Bruno and Carla all type. | Each sees only the other two, e.g. Carla: "**Ana** e **Bruno** estão digitando…" (FR-13). |
| 6. Ana presses Enter while Bruno keeps typing. | Ana's name disappears at once in the other windows when her message arrives; Bruno's stays (FR-12). |
| 7. Hold a key down in Ana's box for a few seconds (dev tools → Network → WS on Ana's window). | At most about 2 `typing` frames per second leave Ana's socket (FR-10). |
| 8. Send enough messages to make the list scroll. In Bruno's window, scroll to the top. | No pill yet. |
| 9. Ana sends 1 message. | Bruno: pill "1 nova mensagem" at the bottom center of the list; the list does not jump (FR-15, FR-16, FR-05). |
| 10. Carla sends 2 messages. | Bruno: "3 novas mensagens" (FR-15, FR-16). |
| 11. Bruno (still scrolled up) sends a message himself. | His view scrolls to the bottom (FR-06) and the counter is reset because the bottom was reached (FR-18); his own message never adds 1 (FR-19). |
| 12. Bruno scrolls up again; Ana sends 2 messages. | Bruno: "2 novas mensagens". |
| 13. Bruno clicks the pill. | The list scrolls smoothly to the bottom; the pill disappears (FR-17). |
| 14. Bruno scrolls up; Carla sends 1 message; Bruno scrolls down by hand to the bottom. | Pill shows "1 nova mensagem" and disappears when the bottom (within 40 px) is reached (FR-18). |
| 15. Bruno stays at the bottom; Ana sends a message. | Bruno's list follows the new message; no pill (FR-15, FR-05). |
| 16. Close Carla's window while she is "typing". | Ana and Bruno: her name disappears after at most 2 s; the server keeps running. |

## How to run the tests

From the repository root:

```bash
# Back-end (Vitest)
cd back-end
npm install
npm test                       # = vitest run
npx vitest run --coverage      # needs @vitest/coverage-v8 (npm install --no-save @vitest/coverage-v8@5.1.1)

# Front-end (Angular unit-test builder + Vitest + jsdom)
cd front-end
npm install
npm test                       # = ng test --watch=false
npx ng test --watch=false --coverage   # needs @vitest/coverage-v8 (npm install --no-save @vitest/coverage-v8@5.1.0)

# Everything (lint, dependency rules, contract, tests, build) – the definition of done
bash scripts/validate.sh
```

Running the apps for the manual test:

```bash
cd back-end  && npm start      # ws://localhost:3000
cd front-end && npm start      # http://localhost:4200
```
