# Testing – typing indicator and unread counter (FR-10 to FR-19)

How the new behaviour is tested. Requirement IDs are from
[`requirements.md`](requirements.md).

- **Back-end** tests use Vitest (`back-end/test/`). The room is tested with
  RxJS marble tests (`TestScheduler`, virtual time) and fake `ChatClient`s. One
  integration file starts a real `WebSocketServer` on a random port and
  connects real `ws` clients.
- **Front-end** tests use Angular's Vitest runner (`ng test`, jsdom). Pure
  streams (`typingSignal$`, `typists$`, `unreadCount$`) are tested with marble
  tests. `chatSession` and the `ChatRoom` component are tested with Vitest
  fake timers and a fake `ChatConnection` (a `Subject` of server events). jsdom
  has no layout, so the component tests fake the list's `scrollHeight`,
  `clientHeight`, `scrollTop` and `scrollTo`.

Protocol added (same in both copies of `domain/events.ts`):
client → server `{ type: 'typing' }`, server → client
`{ type: 'typing', userId, name }`.

## Typing indicator (FR-10 to FR-14)

### Back-end

| Requirement | Step | Expected |
| ----------- | ---- | -------- |
| FR-10 | Parse `{"type":"typing"}` from a client | Valid `{ type: 'typing' }` event. Test: `FR-10: parses a client typing event` |
| FR-10 | Client sends `{"type":"typing","name":"Mallory","userId":"x"}` | Extra fields dropped; the server sets the name and id itself. Test: `FR-10: drops extra fields a client puts on a typing event (the server sets the name)` |
| FR-10 | Ana floods typing every 100 ms from t=10 to t=1210 | Bruno receives notices only at t=10, 610, 1210. Test: `FR-10: relays at most one typing notice per user every 500 ms` |
| FR-10 | Ana types at t=10, Bruno at t=11 | Carla receives both; the limit is per user. Test: `FR-10: the 500 ms limit is per user, not shared by the room` |
| FR-10 | Real socket: Ana sends 10 typing events 50 ms apart | Bruno receives 1 (at most 2, ≥ 450 ms apart). Test: `FR-10: a client flooding typing events is relayed at most once per 500 ms` |
| FR-11 | Ana (joined) sends typing | Bruno receives `{ type: 'typing', userId: <Ana's id>, name: 'Ana' }`. Test: `FR-11: relays a typing notice with the typist name to the other users` |
| FR-11 | Parse `{"type":"typing","userId":"u1","name":"Ana"}` from the server | Valid server typing event. Test: `FR-11: parses a server typing event` |
| FR-11 | Client sends typing before joining | Nothing is relayed. Test: `ignores typing events sent before joining` |
| FR-11 | Ana's socket closes, then a typing event arrives | Nothing is relayed after the close. Test: `stops relaying typing notices once the typist disconnects` |
| FR-12 | Ana types, then sends "oi" | Bruno gets `typing` then `message`, so the client can clear Ana when the message arrives; messages still reach everyone in order. Test: `broadcasts messages to every user, including the sender, in arrival order` |
| FR-13 | Ana and Bruno both type | Ana only gets Bruno's notice; Bruno only gets Ana's. Test: `FR-13: never sends a typing notice back to the user who typed` |
| FR-13 | Real socket: Ana sends broken JSON, typing, then a message | Bruno gets `typing` + `message`; Ana gets only her `message`; server keeps running (FR-08). Test: `FR-11 / FR-13: relays typing to the others only, and survives invalid typing frames (FR-08)` |
| FR-08 | Server typing event missing `userId`/`name`, or with a numeric id | Rejected (`null`). Test: `FR-08: rejects malformed server typing events` |
| FR-14 | — (layout only) | Not applicable on the server. manual |

### Front-end

| Requirement | Step | Expected |
| ----------- | ---- | -------- |
| FR-10 | First keystroke | A typing event right away. Test: `FR-10: the first keystroke is sent immediately` |
| FR-10 | Keystroke every 100 ms for 1 s | Events at 0, 500, 1000 ms only. Test: `FR-10: continuous typing sends at most one event per 500 ms` |
| FR-10 | Keystrokes at 0 and 200 ms | Events at 0 and 500 ms (last keystroke reported at window end). Test: `FR-10 / FR-12: the last keystroke of a burst is reported at the end of the window` |
| FR-10 | Keystroke after a message was sent in the same window | Still reported. Test: `FR-10: typing again after sending still reports typing` |
| FR-10 | `session.typed()` ×3, wait 500 ms, wait 1 s | `connection.send` gets 1, then 2 typing events, no more. Test: `FR-10: keystrokes send typing events, at most one per 500 ms` |
| FR-10 | Type "o", "oi" in the real input | One `typing` sent at once, a second one at 500 ms. Test: `FR-10: typing in the message box sends a throttled typing event` |
| FR-10 | Type "oi", submit the form | Input clears; the programmatic clear is not sent as typing. Test: `FR-10: clearing the input after sending is not reported as typing` |
| FR-11 | `typingText` with 1, 2, 3 and 4 names | "Ana está digitando…", "Ana e Bruno estão digitando…", "Ana, Bruno e Carla estão digitando…", "Ana, Bruno, Carla e Davi estão digitando…". Tests: `FR-11: one name`, `FR-11: two names`, `FR-11: three names`, `FR-11: more than three names keeps the same pattern` |
| FR-11 | `typingText([])`; separators for 3 names | `''`; `', '`, `' e '`, `''`. Tests: `is empty when nobody is typing`, `nameSeparator puts " e " before the last name and ", " elsewhere` |
| FR-11 | Ana, Bruno type, Ana types again | List `[Ana]` → `[Ana, Bruno]`, order kept. Test: `FR-11: lists other users typing, in the order they started` |
| FR-11 | Two users both named "Ana" type | Both listed; tracked by user id. Test: `keeps two users with the same name apart (by user id)` |
| FR-11 | Ana, Bruno, Carla2 type (component) | Strip text goes through the 1/2/3-name sentences; names are bold (`<strong>`). Test: `FR-11: shows one, two and three names in the strip` |
| FR-11 | Inspect the card's children | Order is list → strip → composer. Test: `FR-11: the indicator sits between the message list and the input` |
| FR-12 | Ana types at 1 ms and again at 1001 ms | Removed at 3001 ms (2 s after the last event). Test: `FR-12: a name disappears 2 s after that user’s last typing event` |
| FR-12 | Ana, Bruno, Carla type 100 ms apart | Each removed 2 s after their own event. Test: `FR-11: three typists, then each times out independently` |
| FR-12 | Ana and Bruno type, Ana's message arrives | Ana removed at once, Bruno stays. Test: `FR-12: a name disappears immediately when that user sends a message` (stream and component) |
| FR-12 | Ana types, Bruno's message arrives | Ana stays. Test: `FR-12: a message from someone else does not clear the typist` |
| FR-12 | Typing at 0 and 200 ms, message sent at 300 ms | The trailing typing event due at 500 ms is dropped. Tests: `FR-12: a pending typing event is dropped when the message is sent first`, `FR-12: sending a message cancels the pending typing event` |
| FR-12 | Ana types; advance 1999 ms, then 1 ms (component) | Text still shown at 1999 ms, empty at 2000 ms. Test: `FR-12: a name disappears 2 s after the last typing event` |
| FR-13 | A typing event with the user's own id | Ignored. Tests: `FR-13: the user never sees their own name` (stream and component), `FR-11 / FR-13: typists$ shows others after the join, never the user` |
| FR-14 | Strip with nobody typing, then with Ana, then after timeout | The same `.strip` node is always there with computed height `32px`. Test: `FR-14: the strip keeps its 32 px height, empty or not` |
| FR-14 | Look at the real browser while names come and go | The input and list do not move. manual |

## Unread counter (FR-15 to FR-19)

### Back-end

The unread counter is client-only: the server sends each message once to
every user, unchanged from the base app.

| Requirement | Step | Expected |
| ----------- | ---- | -------- |
| FR-15 to FR-19 | Messages still reach every user, including the sender | Sender gets their own message back (the client uses `authorId` to tell own messages apart, FR-19). Test: `broadcasts messages to every user, including the sender, in arrival order` |
| FR-15 to FR-18 | — (scroll position is client-side) | Not applicable on the server. manual |

### Front-end

| Requirement | Step | Expected |
| ----------- | ---- | -------- |
| FR-15 | 3 messages from others while scrolled up | Counter 0 → 1 → 2 → 3. Test: `FR-15: counts messages from others while scrolled up` |
| FR-15 | Messages while at the bottom | Stays 0. Test: `FR-15: does not count while at the bottom` |
| FR-15 | Positions up, bottom, up for 3 messages | Counts only the 1st and 3rd (position read when each message arrives). Test: `FR-15: uses the scroll position measured when each message arrives` |
| FR-15 | Component: scroll to 39 px from the bottom, Ana sends | No pill (within 40 px). Test: `FR-15: does not count when within 40 px of the bottom` |
| FR-15 / FR-16 | Component: scroll to 600 px from the bottom, 1 then 3 messages | Pill shows "1 nova mensagem", then "3 novas mensagens". Test: `FR-15 / FR-16: counts messages from others while scrolled up and shows the pill` |
| FR-16 | `unreadText(1)`, `unreadText(2)`, `unreadText(12)` | "1 nova mensagem", "2 novas mensagens", "12 novas mensagens". Tests: `FR-16: singular`, `FR-16: plural` |
| FR-16 | Component with counter 0 | No `.pill` in the DOM. Test: `FR-16: the pill is hidden at 0` |
| FR-16 | Pill position (bottom center of the list) | Matches `docs/design/unread.png`. manual |
| FR-17 | Two unread, click the pill | `scrollTo({ top: scrollHeight, behavior: 'smooth' })` called; pill gone. Test: `FR-17: clicking the pill scrolls smoothly to the bottom and resets the counter` |
| FR-17 / FR-18 | Counter at 2, reset, new message | 2 → 0 → 1. Test: `FR-17 / FR-18: a reset sets it back to 0, and counting starts again` |
| FR-17 / FR-18 | Reset while already 0 | No new emission. Test: `a reset at 0 emits nothing new` |
| FR-18 | Scroll events: up, up, bottom | Only the last one resets. Test: `FR-18: passes only the scroll events that end at the bottom` |
| FR-18 | Component: 1 unread, scroll to 300 px from bottom, then to the bottom | Pill stays, then disappears. Test: `FR-18: scrolling to the bottom resets the counter` |
| FR-19 | Own, other, own messages while scrolled up (stream) | Counter only goes to 1. Test: `FR-19: own messages never increase the counter` |
| FR-19 | Component: own message while scrolled up; scroll up; Ana; own | No pill after the own message; "1 nova mensagem" after Ana and after the second own message. Test: `FR-19: own messages never increase the counter` |

## Manual test – 3 browser windows (Ana, Bruno, Carla)

Start the server and the app (see the commands below), open
http://localhost:4200 in 3 windows side by side, and join as **Ana**,
**Bruno** and **Carla**.

| Step | Expected |
| ---- | -------- |
| 1. Ana types one letter and stops. | Bruno and Carla see "**Ana** está digitando…" with the animated dots, between the list and the input. Ana sees nothing in her own strip (FR-11, FR-13). |
| 2. Wait without typing. | About 2 s after Ana's last key, the line disappears for Bruno and Carla (FR-12). |
| 3. Ana and Bruno type at the same time, without stopping. | Carla sees "**Ana** e **Bruno** estão digitando…" (in the order they started). Ana sees only "**Bruno** está digitando…", Bruno only "**Ana** está digitando…" (FR-11, FR-13). |
| 4. Carla also types while Ana and Bruno keep typing. | Nobody sees their own name. Each sees the other two, e.g. Ana sees "**Bruno** e **Carla** estão digitando…". With a 4th window, it would read "**Ana**, **Bruno** e **Carla** estão digitando…" (FR-11). |
| 5. While Ana is listed as typing, she presses Enter with text. | Her name disappears immediately from Bruno's and Carla's indicator, at the same moment her message appears (FR-12). |
| 6. Hold a key down in Ana's window for several seconds; in DevTools → Network → WS, look at the frames Ana sends. | `{"type":"typing"}` frames go out at most once every 500 ms (FR-10). |
| 7. Watch the input and the message list while names appear and disappear. | Nothing moves: the strip keeps its 32 px height (FR-14). |
| 8. Ana and Bruno send enough messages for Carla's list to scroll. Carla scrolls up more than 40 px from the bottom. | No pill yet. |
| 9. Ana sends 1 message. | Carla sees a pill at the bottom center of the list: "1 nova mensagem". Carla's list does not move (FR-15, FR-16, FR-05). |
| 10. Bruno sends 2 more messages. | Carla's pill reads "3 novas mensagens" (FR-15, FR-16). |
| 11. Carla clicks the pill. | The list scrolls smoothly to the bottom and the pill disappears (FR-17). |
| 12. Carla scrolls up again; Ana sends 2 messages; Carla scrolls down to the bottom with the mouse wheel. | Pill shows "2 novas mensagens", then disappears when the bottom is reached (FR-18). |
| 13. Carla scrolls up and sends a message herself. | Her list jumps to the bottom (FR-06) and the counter does not go up (FR-19). |
| 14. Carla stays at the bottom; Bruno sends a message. | Carla's list follows the new message and no pill appears (FR-05, FR-15). |
| 15. Regression: try to send an empty message; check bubbles, names and times. | Not sent; own messages right/blue, others left with name and HH:mm (FR-02 to FR-04). |

## How to run the tests

Back-end (`back-end/`):

```bash
cd back-end
npm install
npm test                       # = npx vitest run
npx vitest run --coverage      # with line coverage (v8)
npm run typecheck              # tsc --noEmit on src/
npx tsc -p test/tsconfig.json  # type-check the tests too
```

Front-end (`front-end/`):

```bash
cd front-end
npm install
npx ng test --watch=false             # or: npm test -- --watch=false
npx ng test --watch=false --coverage  # with line coverage (v8)
npx ng build
```

Protocol copies must stay identical:

```bash
cmp back-end/src/domain/events.ts front-end/src/app/domain/events.ts
```

Manual test: `cd back-end && npm run dev` and `cd front-end && npm start`,
then open http://localhost:4200 in 3 windows.
