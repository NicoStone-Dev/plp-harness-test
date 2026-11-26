# Testing – typing indicator and unread counter (FR-10 to FR-19)

How the new behaviour is tested. Automated tests are named as
`file › describe › test`. Front-end paths are relative to `front-end/src/app/`,
back-end paths to `back-end/`.

Kinds of test used:

- **unit**: pure functions (`events.ts`, `indicators.ts`).
- **stream**: RxJS marble tests with `TestScheduler` (virtual time, so the 500 ms
  and 2 s timings are tested exactly, with no real waiting).
- **component**: Angular `TestBed` + jsdom, driving `ChatRoom` with a fake
  connection (a `Subject<ServerEvent>`). jsdom has no layout, so the list's
  `scrollHeight`/`clientHeight`/`scrollTop` are stubbed (1000 px of content in
  a 300 px viewport) and `scrollTo` is a spy.

Protocol added for this feature (same in both copies of `domain/events.ts`):
client → server `{ type: 'typing' }`; server → client
`{ type: 'typing', userId, name }`. The server relays typing to everyone
**except** the typist. The client hides a name after 2 s or when a `message`
from that `userId` arrives.

## Typing indicator (FR-10 to FR-14)

### Back-end

| Requirement | Step | Expected |
| ----------- | ---- | -------- |
| FR-10 | Parse the frame `{"type":"typing"}` | `{ type: 'typing' }`. Test: `test/events.spec.ts › parseClientEvent › FR-10: accepts a typing event` |
| FR-10 | Parse a typing frame with extra fields (`name`, `userId`) | Extra fields are dropped, so a client cannot spoof a name. Test: `test/events.spec.ts › parseClientEvent › FR-10: drops extra fields from a typing event` |
| FR-10 | Throttle: keystrokes every 100 ms from 0 to 600 ms | Relayed at 0 and 600 ms only. Test: `test/typing.spec.ts › throttleTyping (FR-10) › relays the first keystroke at once and at most one per 500 ms` |
| FR-10 | Throttle: keystrokes 600 ms apart | Every one is relayed. Test: `test/typing.spec.ts › throttleTyping (FR-10) › relays a keystroke again after a 500 ms window has passed` |
| FR-10 | Room: Ana sends typing every 100 ms from 1 to 601 ms | Bruno receives notices at 1 and 601 ms only. Test: `test/chat-room.spec.ts › chatRoom › FR-10: relays at most one typing notice per 500 ms per user` |
| FR-10 | Room: Ana and Bruno type at overlapping times | Each user has their own 500 ms window, and Carla gets both. Test: `test/chat-room.spec.ts › chatRoom › FR-10: throttles each user separately` |
| FR-11 | Parse the frame `{"type":"typing","userId","name"}` | Accepted, with `userId` and `name`. Test: `test/events.spec.ts › parseServerEvent › FR-11: accepts a typing event with userId and name` |
| FR-11, FR-13 | Ana, Bruno and Carla join, then Ana types | Bruno and Carla receive `{ type: 'typing', userId: <Ana's id>, name: 'Ana' }`. Ana receives nothing. Test: `test/chat-room.spec.ts › chatRoom › FR-11 / FR-13: relays a typing notice to the other users, never to the typist` |
| FR-12 | Throttle: a message is sent 200 ms after a keystroke, then another keystroke comes at 300 ms | The 300 ms keystroke is relayed at once, because the message reset the window. Test: `test/typing.spec.ts › throttleTyping (FR-10) › a sent message restarts the window, so the next keystroke is relayed at once` |
| FR-12 | Room: Ana types, sends a message, then types again | Bruno receives `typing`, `message`, `typing` in that order. The second typing is not swallowed by the throttle. Test: `test/chat-room.spec.ts › chatRoom › FR-12: after a message, the next keystroke is relayed at once` |
| FR-08 | Typing before join, and malformed typing frames | Ignored. Test: `test/chat-room.spec.ts › chatRoom › FR-08: ignores typing before join`, `test/events.spec.ts › parseServerEvent › FR-08: rejects a typing event without userId or name` |
| FR-12 | Ana disconnects, then her socket emits typing again | Nothing more is relayed. Test: `test/chat-room.spec.ts › chatRoom › stops relaying typing from a client that disconnected` |
| FR-14 | Layout | Not applicable on the back-end (manual, front-end) |

### Front-end

| Requirement | Step | Expected |
| ----------- | ---- | -------- |
| FR-10 | `typingSignal$`: keystrokes at 0, 100 and 200 ms | Sent at 0 ms (leading) and 500 ms (trailing, so the last keystroke is not lost). Test: `streams/typing.spec.ts › typingSignal$ (FR-10) › sends the first keystroke at once and the last one at the end of the 500 ms window` |
| FR-10 | `typingSignal$`: a keystroke every 50 ms for 1.45 s | Sent at 0, 500, 1000 and 1500 ms, never more than once per 500 ms. Test: `streams/typing.spec.ts › typingSignal$ (FR-10) › never sends more than one event per 500 ms while the user keeps typing` |
| FR-10 | Session: 3 keystrokes, wait 499 ms, 1 keystroke, wait 1 ms | One `{type:'typing'}` at once, and a second one at 500 ms. Test: `streams/chat-session.spec.ts › chatSession: typing › FR-10: sends one typing event at once, then at most one per 500 ms` |
| FR-10 | Component: 5 `input` events in the message box | 1 typing event sent, then 1 more after 500 ms. Test: `chat/chat-room/chat-room.spec.ts › ChatRoom › typing indicator › FR-10: typing in the message box sends one typing event per 500 ms` |
| FR-10 | Component: type "oi", click Enviar | Sends `typing` then `message`. The input is cleared and the clearing is not reported as typing. Test: `chat-room.spec.ts › typing indicator › FR-10: clearing the input after sending is not reported as typing` |
| FR-11 | Text for 1, 2 and 3 names | "Ana está digitando…", "Ana e Bruno estão digitando…", "Ana, Bruno e Carla estão digitando…". Test: `domain/indicators.spec.ts › typingText (FR-11) › one name / two names / three names` |
| FR-11 | Names are the bold parts | Only the names are marked `name: true`. Test: `domain/indicators.spec.ts › typingText (FR-11) › marks only the names as bold parts` |
| FR-11 | `typingNames$`: Ana, Bruno and Davi start typing 10 ms apart | `[Ana]`, `[Ana, Bruno]`, `[Ana, Bruno, Davi]`, in the order they started. Test: `streams/typing.spec.ts › typingNames$ › FR-11: lists several typists in the order they started` |
| FR-11 | Component: typing events from Ana, Bruno and Davi | `.strip` shows the 3 sentences in turn. The names are in `<strong>`, and the strip sits between `.list-area` and `.composer`. Test: `chat-room.spec.ts › typing indicator › FR-11: shows one, two and three names between the list and the input` |
| FR-12 | `typingNames$`: one typing event at 10 ms | Hidden at 2010 ms. Test: `streams/typing.spec.ts › typingNames$ › FR-11: shows a typist, and FR-12: hides them 2 s after their last typing event` |
| FR-12 | `typingNames$`: typing at 10 ms and again at 1010 ms | Hidden at 3010 ms, because the countdown restarts. Test: `streams/typing.spec.ts › typingNames$ › FR-12: each typing event restarts that user’s 2 s countdown` |
| FR-12 | `typingNames$`: Ana and Bruno type, then Ana's message arrives | Ana is removed at once and Bruno stays. Test: `streams/typing.spec.ts › typingNames$ › FR-12: a message from the typist hides them at once, others stay` |
| FR-12 | Component (fake timers): Ana types, then 1999 ms pass, then 1 more ms | Still shown at 1999 ms and gone at 2000 ms. Test: `chat-room.spec.ts › typing indicator › FR-12: a name disappears 2 s after the last typing event` |
| FR-12 | Component: Ana and Bruno type, then a message from Ana arrives | Shows "Bruno está digitando…". Test: `chat-room.spec.ts › typing indicator › FR-12: a name disappears at once when that user sends a message` |
| FR-12 | Session: 2 keystrokes, then send "oi" | Sends `typing` and `message`, and no trailing `typing` afterwards that would show the name again. Test: `streams/chat-session.spec.ts › chatSession: typing › FR-12: sending a message cancels the pending typing event` |
| FR-02 | Session: 2 keystrokes, then submit "   " | No message is sent, and the trailing typing event still goes out. Test: `streams/chat-session.spec.ts › chatSession: typing › FR-02: blank text is still not sent and does not cancel the pending typing event` |
| FR-13 | `typingNames$`: typing events from self, then from Ana | Only Ana is listed. Test: `streams/typing.spec.ts › typingNames$ › FR-13: never lists the own user` |
| FR-13 | Session: `joined` as Carla, then typing from Carla and from Ana | `typing$` emits `[]`, then `['Ana']`. Test: `streams/chat-session.spec.ts › chatSession: typing › FR-11 / FR-13: typing$ lists the others who are typing, not the own user` |
| FR-13 | Component: typing event carrying the own `userId` | Strip stays empty. Test: `chat-room.spec.ts › typing indicator › FR-13: never shows the own name` |
| FR-08 | Session: typing arrives before `joined` | Ignored. Test: `streams/chat-session.spec.ts › chatSession: typing › FR-08: ignores typing events that arrive before the join is acknowledged` |
| FR-14 | Component: computed style of `.strip`, empty and with a name | `height: 32px` and `flex-shrink: 0` in both states. Test: `chat-room.spec.ts › typing indicator › FR-14: the strip is always in the layout, with a fixed 32 px height` |
| FR-14 | Look at the real page while someone starts or stops typing | The message list and the input do not move (manual, step 5 of the 3-window test below) |

## Unread counter (FR-15 to FR-19)

The counter lives only in the browser. The back-end sends no new events for
it, but it relies on the server sending `authorId` (FR-19) and delivering
messages in order (FR-03).

### Back-end

| Requirement | Step | Expected |
| ----------- | ---- | -------- |
| FR-15, FR-19 | Ana, Bruno and Carla send messages, and Carla joins late | Each joined user gets every message in order, with no history. This is what the counter counts. Test: `test/chat-room.spec.ts › chatRoom › FR-03 / FR-07: messages still reach every joined user in order, without history` |
| FR-19 | The typing notice's `userId` is the same id as the user's own `joined.userId`, which is also the message `authorId` | Equal. Test: `test/chat-room.spec.ts › chatRoom › FR-11 / FR-13: relays a typing notice to the other users, never to the typist` (last assertion) |
| FR-16 to FR-18 | Pill, scrolling | Not applicable on the back-end (front-end only) |

### Front-end

| Requirement | Step | Expected |
| ----------- | ---- | -------- |
| FR-15 | `unreadCount$`: 3 messages from others while scrolled up | 0 → 1 → 2 → 3. Test: `streams/unread.spec.ts › unreadCount$ › FR-15: adds 1 per message from others while scrolled up` |
| FR-15 | `unreadCount$`: messages that arrive while at the bottom | Not counted. Test: `streams/unread.spec.ts › unreadCount$ › FR-15: does not count messages that arrive while at the bottom` |
| FR-15 | Component: list exactly 40 px from the bottom, then a message from Ana | No pill (40 px still counts as "at the bottom"). Test: `chat-room.spec.ts › unread counter › FR-15: does not count when the user is within 40 px of the bottom` |
| FR-15 | Component: list 41 px from the bottom, then a message from Ana | "1 nova mensagem". Test: `chat-room.spec.ts › unread counter › FR-15: counts when the user is more than 40 px from the bottom` |
| FR-16 | Label for 1 and N | "1 nova mensagem", "2 novas mensagens", "12 novas mensagens". Test: `domain/indicators.spec.ts › unreadLabel (FR-16) › singular for 1 / plural for N` |
| FR-16 | `unreadCount$` with no messages | Starts at 0. Test: `streams/unread.spec.ts › unreadCount$ › starts at 0 (FR-16: pill hidden)` |
| FR-16 | Component: just joined | No `.pill` in the DOM. Test: `chat-room.spec.ts › unread counter › FR-16: the pill is hidden at 0` |
| FR-15, FR-16 | Component: scrolled up, then messages from Ana, Bruno, Ana | Pill reads "1 nova mensagem", then "3 novas mensagens". It is inside `.list-area`, outside the scrolling `<ol>`. Test: `chat-room.spec.ts › unread counter › FR-15 / FR-16: counts messages from others while scrolled up` |
| FR-16 | Pill is at the bottom center of the list (CSS `left: 50%`, `translateX(-50%)`, `bottom: 12px`) | Looks like `docs/design/unread.png` (manual, step 9 below) |
| FR-17 | `unreadCount$`: reset at 30 ms after 2 messages, then another message | 2 → 0 → 1. Test: `streams/unread.spec.ts › unreadCount$ › FR-17 / FR-18: a reset sets it back to 0, and counting starts again` |
| FR-17 | Component: 2 unread, click the pill | `scrollTo({ top: 1000, behavior: 'smooth' })` is called and the pill disappears. Test: `chat-room.spec.ts › unread counter › FR-17: clicking the pill scrolls smoothly to the bottom and resets the counter` |
| FR-17 | The scroll is visibly smooth | Animated, not a jump (manual, step 10 below) |
| FR-18 | Component: 2 unread, scroll to 400 px (still up), then to the bottom | Still "2 novas mensagens" at 400 px, and the pill is gone at the bottom. Test: `chat-room.spec.ts › unread counter › FR-18: reaching the bottom by scrolling resets the counter` |
| FR-18 | `unreadCount$`: reset while already at 0 | No new emission. Test: `streams/unread.spec.ts › unreadCount$ › a reset at 0 emits nothing new` |
| FR-19 | `unreadCount$`: own messages while scrolled up | Not counted. Test: `streams/unread.spec.ts › unreadCount$ › FR-19: own messages never add to the counter` |
| FR-19 | Component: 1 unread, then an own message arrives | Still "1 nova mensagem". Test: `chat-room.spec.ts › unread counter › FR-19: own messages never increase the counter` |
| FR-06, FR-18 | Component: own message while scrolled up | The list scrolls to the bottom (FR-06), and the resulting scroll event clears the counter. Test: `chat-room.spec.ts › unread counter › FR-06: an own message still scrolls to the bottom, which then clears the counter (FR-18)` |
| FR-05 | Component: scrolled up to 200 px, then a message from Ana | `scrollTop` stays at 200. Test: `chat-room.spec.ts › unread counter › FR-05: a message from others while scrolled up does not move the list` |

## Manual test with 3 browser windows

Start the server and the app (see "How to run the tests" for the folders):
`npm run dev` in `back-end/`, `npm start` in `front-end/`. Open
http://localhost:4200 in 3 windows side by side.

| Step | Expected |
| ---- | -------- |
| 1. Join as **Ana**, **Bruno** and **Carla**, one name per window. | Each window shows the chat screen with "Você: <name>". There is an empty strip above the input. |
| 2. In Ana's window, type a few letters slowly (do not send). | Bruno and Carla see the animated dots and "**Ana** está digitando…" between the list and the input. Ana sees nothing in her own strip (FR-11, FR-13). |
| 3. Stop typing in Ana's window and wait. | About 2 s after Ana's last key, the line disappears in Bruno's and Carla's windows (FR-12). |
| 4. Ana and Bruno both type at the same time. | Carla sees "**Ana** e **Bruno** estão digitando…". Ana sees "**Bruno** está digitando…" and Bruno sees "**Ana** está digitando…". |
| 5. While step 4 is going on, Carla also types. Watch every window's list and input while the line appears and disappears. | Ana sees "**Bruno** e **Carla** estão digitando…" (with all three typing, each sees the other two). The list and the input do not move when the line appears or disappears (FR-14). |
| 6. Ana types "oi" and presses Enter right away. | In Bruno's and Carla's windows Ana's name leaves the indicator as soon as the message appears, without waiting 2 s, and does not come back (FR-12). |
| 7. Ana holds a key down for 5 s. Open DevTools → Network → WS in Ana's window. | Outgoing `{"type":"typing"}` frames are about 500 ms apart, never closer (FR-10). |
| 8. Send about 10 messages so Bruno's list scrolls. In Bruno's window, scroll up more than 40 px. | No pill yet. |
| 9. Ana sends 1 message, then Carla sends 2. | Bruno sees the pill at the bottom center of the list: "1 nova mensagem", then "3 novas mensagens" (FR-15, FR-16, docs/design/unread.png). Bruno's scroll position does not change (FR-05). |
| 10. Bruno clicks the pill. | The list scrolls smoothly to the bottom and the pill disappears (FR-17). |
| 11. Bruno scrolls up again. Ana sends 2 messages. Bruno scrolls down by hand to the bottom. | The pill shows "2 novas mensagens" and disappears when the bottom is reached (FR-18). |
| 12. Bruno scrolls up, then sends a message himself. | The counter does not go up for his own message. His list jumps to the bottom (FR-06) and any pill disappears (FR-19, FR-18). |
| 13. Bruno, at the bottom, receives a message from Ana. | The list follows the new message and no pill appears (FR-05, FR-15). |
| 14. Close Carla's window while she is typing. | Her name disappears from the others' indicator within 2 s. The other windows keep working. |

## How to run the tests

Back-end (vitest, Node 20+):

```bash
cd back-end
npm install
npx vitest run              # or: npm test
npx vitest run --coverage   # or: npm run test:coverage  (report in back-end/coverage/)
npm run typecheck
```

Front-end (Angular unit-test builder, vitest + jsdom):

```bash
cd front-end
npm install
npx ng test --watch=false              # or: npm test -- --watch=false
npx ng test --watch=false --coverage   # report in front-end/coverage/front-end/
npm run build
```

Check that the two protocol copies are still identical:

```bash
cmp back-end/src/domain/events.ts front-end/src/app/domain/events.ts
```
