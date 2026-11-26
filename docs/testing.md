# Testing – typing indicator and unread counter

How FR-10 to FR-19 (see [`requirements.md`](requirements.md)) are tested.
Every automated test named below is a `describe › it` title. Back-end tests are in
`back-end/src/**/*.test.ts`; front-end tests are in `front-end/src/app/**/*.spec.ts`.

Kinds of test used:

- **stream**: RxJS marble tests with `TestScheduler`, in virtual time. Used for the 500 ms
  throttle and the 2 s timeout, so timing is exact and the tests run instantly.
- **unit**: plain function tests, such as label formatting and protocol parsing.
- **component**: the real `ChatRoom` in Angular `TestBed` (jsdom), driven by a real
  `chatSession` over a fake connection. jsdom has no layout, so the tests set the list's
  `scrollHeight`, `clientHeight` and `scrollTop` by hand.
- **integration**: a real `ws` server on a random port with real `ws` clients.

---

## Typing indicator (FR-10 to FR-14)

### Back-end

| Requirement | Step | Expected |
| --- | --- | --- |
| FR-10 | Client sends `{"type":"typing"}` | Parsed as a typing event. Test: `parseClientEvent – typing (FR-10) › accepts a typing event` |
| FR-10 | Client sends a typing event with extra `userId`/`name` fields | Extra fields dropped, so a client cannot pose as someone else. Test: `parseClientEvent – typing (FR-10) › drops extra fields a client tries to smuggle in (FR-08)` |
| FR-10 | Ana sends typing at 1, 2 and 3 ms, then again at 504 ms | Bruno receives exactly 2 typing events. Test: `chatRoom – typing indicator › FR-10: relays at most one typing event per 500 ms per user` |
| FR-10 | Ana and Bruno each send typing twice in the same window | Carla receives one from Ana and one from Bruno, because the throttle is per user. Test: `chatRoom – typing indicator › FR-10: throttles each user independently` |
| FR-11 | Ana types | Bruno receives `{ type: 'typing', userId: <Ana's id>, name: 'Ana' }`. Test: `chatRoom – typing indicator › FR-11: typing events carry the typist id and name to the other users` |
| FR-11 | Server event `typing` with or without `userId`/`name` | Accepted only when both are strings. Tests: `parseServerEvent – typing (FR-11) › accepts a typing event with userId and name`, `› rejects a typing event without userId or name` |
| FR-11, FR-13 | Over real sockets, Ana sends typing and then a message | Bruno gets `typing` with name Ana. Ana gets her message but no `typing`. Test: `server over real WebSockets › FR-11 / FR-13: relays typing to the others, not back to the typist` |
| FR-12 | Ana types, then sends a message | Bruno receives `joined`, `typing`, `message`, in that order. The client uses the message to clear Ana's name. Test: `chatRoom – typing indicator › FR-12: a message after typing is still delivered to everyone, in order` |
| FR-12 | 2 s timeout | Done on the client, so nothing to test here. See the front-end table. |
| FR-13 | Ana types twice, more than 500 ms apart | Ana receives no typing events and Bruno receives 2. Test: `chatRoom – typing indicator › FR-13: never echoes typing events back to the typist` |
| FR-08 | Typing sent before join | Ignored. Test: `chatRoom – typing indicator › ignores typing events sent before joining (FR-08)` |
| FR-08 | Ana's socket closes, then a typing event arrives | Nothing is relayed. Test: `chatRoom – typing indicator › stops relaying a user typing once their connection closes` |
| FR-08 | Invalid JSON, a binary frame and a typing event with extra fields, followed by a message | The server keeps working. Bruno gets one typing event (name Ana) and the trimmed message. Test: `server over real WebSockets › FR-08: invalid frames are ignored and the server keeps working` |
| FR-14 | Layout | Front-end only. |

### Front-end

| Requirement | Step | Expected |
| --- | --- | --- |
| FR-10 | Keystrokes at 0, 100, 200, 499, 650, 1100 and 1200 ms | Notices at 0, 650 and 1200 ms. The first is sent at once and the rest of each 500 ms window is dropped. Test: `typingNotices$ (FR-10) › sends at most one typing notice per 500 ms, the first one immediately` |
| FR-10 | 3 quick keystrokes, then 1 more after 600 ms | `send` is called 2 times. Test: `typingNotices$ (FR-10) › calls send once per notice` |
| FR-10 | `session.keystroke()` at 0 and 0 ms, then at 200 and 600 ms (fake timers) | Exactly 2 `{type:'typing'}` frames on the connection. Test: `chatSession › FR-10: keystrokes send typing notices, at most one per 500 ms` |
| FR-10 | Two `input` events in the message box | One `{type:'typing'}` is sent. Test: `ChatRoom › typing indicator › FR-10: typing in the message box sends a typing event` |
| FR-11 | Ana types, then Bruno, then Ana again | Names are `[]`, then `['Ana']`, then `['Ana','Bruno']`, in the order they started typing. Test: `typingNames$ › FR-11: lists other typists in the order they started typing` |
| FR-11 | Ana, Bruno and Carla type | `['Ana','Bruno','Carla']`. Test: `typingNames$ › FR-11: three typists` |
| FR-11 | Format 1, 2 and 3 names | "Ana está digitando…", "Ana e Bruno estão digitando…", "Ana, Bruno e Carla estão digitando…". Test: `typingLabel / typingSegments (FR-11) › formats one, two and three names` |
| FR-11 | Format 0 names | Empty. Test: `typingLabel / typingSegments (FR-11) › is empty when nobody is typing` |
| FR-11 | Segments for 2 names | Names and connecting words are separate segments, and names are rendered bold. Test: `typingLabel / typingSegments (FR-11) › marks the names (rendered in bold) apart from the connecting words` |
| FR-11 | Ana and Bruno type (component) | The strip between `.list-area` and `.composer` reads "Ana e Bruno estão digitando…" with both names in `<strong>`. Test: `ChatRoom › typing indicator › FR-11: shows other typists between the list and the input, names in bold` |
| FR-11 | Three typists (component) | "Ana, Bruno e Carla estão digitando…". Test: `ChatRoom › typing indicator › FR-11: three typists` |
| FR-11 | Typing event arrives before `joined` | Ignored. Test: `typingNames$ › waits for the join acknowledgement before showing anyone` |
| FR-12 | Ana types at 1 ms and 1001 ms | She disappears at 3001 ms (2 s after the last event), not at 2001 ms. Test: `typingNames$ › FR-12: removes a name 2 s after that user's last typing event` |
| FR-12 | Ana and Bruno type, then Ana's message arrives | Only Ana is removed, at once. Test: `typingNames$ › FR-12: removes a name immediately when that user sends a message` |
| FR-12 | Ana types, then a message from someone else arrives | Ana stays. Test: `typingNames$ › FR-12: a message from someone else does not remove a typist` |
| FR-12 | Ana types, then sends (session) | Names go `[]`, `['Ana']`, `[]`. Test: `chatSession › FR-11 / FR-12: exposes the other typists and drops them when they send` |
| FR-12 | Ana types, then sends (component) | The strip is empty. Test: `ChatRoom › typing indicator › FR-12: a name disappears when that user sends a message` |
| FR-12 | Ana types and the clock advances 1999 ms, then 1 ms more (fake timers) | Still shown at 1999 ms, gone at 2000 ms. Test: `ChatRoom › typing indicator › FR-12: a name disappears 2 s after the last typing event` |
| FR-13 | A typing event with the user's own id (echo) | Never listed. Test: `typingNames$ › FR-13: never includes the user's own name, even if the server echoes it` |
| FR-13 | The same in the component | The strip is empty. Test: `ChatRoom › typing indicator › FR-13: never shows the user's own name` |
| FR-14 | Nobody typing | The `.typing` strip is still in the DOM, with no children. Its fixed 32 px height is set in CSS (`.typing { height: 32px }`). Test: `ChatRoom › typing indicator › FR-14: the indicator strip is always rendered, even when empty` |
| FR-14 | The layout really does not jump (actual pixel height) | jsdom has no layout. **manual** (step 5 of the manual test) |

---

## Unread counter (FR-15 to FR-19)

### Back-end

The unread counter is purely client-side. The back-end only has to keep delivering
every message with its `authorId`.

| Requirement | Step | Expected |
| --- | --- | --- |
| FR-15, FR-19 | Ana sends a message | Every user, including Ana, receives it with author Ana. The client needs this to tell own messages from others'. Test: `chatRoom – base app still works › FR-03: broadcasts each message to every user, including the sender` |
| FR-15 | Bruno joins after Ana's message | Bruno gets no history, so nothing is counted from before he joined. Test: `chatRoom – base app still works › FR-07: a late joiner gets no history` |
| FR-16 to FR-18 | Pill, click and scroll | Front-end only. |

### Front-end

| Requirement | Step | Expected |
| --- | --- | --- |
| FR-15 | Three messages from others while scrolled up | Counter goes 0, 1, 2, 3. Test: `unreadCount$ › FR-15: counts others' messages while scrolled up` |
| FR-15 | A message while near the bottom, then one after scrolling up | Only the second one counts. Test: `unreadCount$ › FR-15: does not count while near the bottom` |
| FR-15, FR-16 | List 700 px from the bottom, then messages from Ana, Bruno and Ana (component) | No pill at first, then "1 nova mensagem", then "3 novas mensagens". Test: `ChatRoom › unread counter › FR-15 / FR-16: counts others' messages while scrolled up and shows the pill` |
| FR-15 | List 20 px from the bottom, then a message from Ana (component) | No pill. Test: `ChatRoom › unread counter › FR-15: does not count when the user is at the bottom` |
| FR-16 | Label for 1, 3 and 12 | "1 nova mensagem", "3 novas mensagens", "12 novas mensagens". Test: `unreadLabel (FR-16) › uses singular for 1 and plural otherwise` |
| FR-16 | Counter is 0 | No pill rendered (`@if (unread() > 0)`). Checked in `ChatRoom › unread counter › FR-15 / FR-16: …` (first assertion) |
| FR-16 | Pill is at the bottom center of the list and looks like `docs/design/unread.png` | **manual** (step 9 of the manual test) |
| FR-17, FR-18 | Two messages, a reset, one more message | 0, 1, 2, then 0, then 1. Test: `unreadCount$ › FR-17 / FR-18: a reset (pill click or reaching the bottom) sets it back to 0` |
| FR-17, FR-18 | Reset while already at 0 | No duplicate emission. Test: `unreadCount$ › does not re-emit 0 for a reset at 0` |
| FR-17 | Click the pill (component) | `scrollTo({ top: scrollHeight, behavior: 'smooth' })` is called and the pill disappears. Test: `ChatRoom › unread counter › FR-17: clicking the pill scrolls smoothly to the bottom and resets the counter` |
| FR-17 | The scroll animation is actually smooth | **manual** (step 10 of the manual test) |
| FR-18 | Scroll to 300 px (still far from the bottom), then to the bottom (component) | Still "2 novas mensagens" after the first scroll. Pill gone after the second. Test: `ChatRoom › unread counter › FR-18: reaching the bottom by scrolling resets the counter` |
| FR-19 | Own messages mixed with others' (stream) | Only others' messages count. Test: `unreadCount$ › FR-19: own messages never increase the counter` |
| FR-19 | Own message while scrolled up (component) | No pill. Test: `ChatRoom › unread counter › FR-19: own messages never increase the counter` |

Regression tests for the base app, which also run in these suites:
`chatSession › FR-02 / FR-03 still work: …`,
`ChatRoom › base app still works › FR-02: Enviar sends the trimmed text and clears the input`,
`ChatRoom › base app still works › FR-04: own messages are marked own, others show the author`,
and the back-end FR-03, FR-07 and FR-08 tests listed above.

---

## Manual test with 3 browser windows

Start the server (`cd back-end && npm run dev`) and the app (`cd front-end && npm start`).
Open http://localhost:4200 in three windows side by side.

| Step | Expected |
| --- | --- |
| 1. In the windows, join as **Ana**, **Bruno** and **Carla** | Each window shows the chat screen with "Você: <name>". The strip above the input is empty. |
| 2. Ana types one letter in the message box | Bruno and Carla see "**Ana** está digitando…" with the animated dots, between the list and the input (FR-11). Ana sees nothing (FR-13). |
| 3. Ana stops typing and waits | About 2 s after her last keystroke, the indicator disappears in Bruno's and Carla's windows (FR-12). |
| 4. Open DevTools → Network → WS in Ana's window, then Ana keeps typing for 5 s | Ana's window sends at most about 2 `{"type":"typing"}` frames per second, never 2 within 500 ms (FR-10). Ana's name stays visible the whole time. |
| 5. Ana and Bruno both type at the same time | Carla sees "**Ana** e **Bruno** estão digitando…" (or "Bruno e Ana", in the order they started). The message list and input do not move when the indicator appears or disappears (FR-14). |
| 6. Ana, Bruno and Carla all type | Each window sees the other two, e.g. Carla sees "**Ana** e **Bruno** estão digitando…". Nobody sees their own name (FR-13). To see the three-name form, open a 4th window as Dani, who sees "**Ana**, **Bruno** e **Carla** estão digitando…" (FR-11). |
| 7. Ana presses Enter while Bruno and Carla see her typing | Ana's message appears, and her name leaves the indicator at once in the other windows, without waiting 2 s (FR-12). |
| 8. Send enough messages to make the list scroll. In Bruno's window, scroll up more than 40 px from the bottom | No pill yet. |
| 9. Ana sends 1 message, then Carla sends 2 | Bruno sees a pill at the bottom center of the list: "1 nova mensagem", then "3 novas mensagens" (FR-15, FR-16). His list does not auto-scroll (FR-05). |
| 10. Bruno clicks the pill | The list scrolls smoothly to the bottom and the pill disappears (FR-17). |
| 11. Bruno scrolls up again, Ana sends 2 messages, then Bruno scrolls down to the bottom with the mouse wheel | The pill shows "2 novas mensagens", then disappears when he reaches the bottom (FR-18). |
| 12. Bruno scrolls up and sends a message himself | His list jumps to the bottom (FR-06). The counter does not go up (FR-19) and no pill appears. |
| 13. Carla, at the bottom of her list, receives a message from Ana | Her list follows the new message and no pill appears (FR-05, FR-15). |

---

## Running the tests

Back-end (vitest, Node):

```bash
cd back-end
npm install
npm test                          # same as: npx vitest run
npx vitest run --coverage         # with v8 coverage (also: npm run test:coverage)
npm run typecheck                 # tsc --noEmit, includes the test files
```

Front-end (Angular unit-test builder with vitest + jsdom):

```bash
cd front-end
npm install
npx ng test --watch=false             # same as: npm test -- --watch=false
npx ng test --watch=false --coverage  # with v8 coverage, HTML report in coverage/front-end/
```

Protocol copies must stay identical:

```bash
cmp back-end/src/domain/events.ts front-end/src/app/domain/events.ts
```
