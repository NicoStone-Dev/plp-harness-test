# Reactive Chat

A real-time group chat written in reactive style with RxJS on both ends:
a Node WebSocket server (`back-end/`) and an Angular client (`front-end/`).

It implements the base app (FR-01 to FR-08 in
[`docs/requirements.md`](docs/requirements.md)) plus the typing indicator and
unread counter (FR-10 to FR-19). How they are tested: [`docs/testing.md`](docs/testing.md).

## Running

Requires Node 20+ (tested with Node 24).

```bash
# Terminal 1 – WebSocket server on ws://localhost:3000
cd back-end
npm install
npm run dev

# Terminal 2 – Angular app on http://localhost:4200
cd front-end
npm install
npm start
```

Open http://localhost:4200 in two or more tabs and join with different names.

| Command (back-end)  | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Run the server with tsx, reload on change |
| `npm start`         | Run the server once with tsx          |
| `npm run typecheck` | Type-check with `tsc --noEmit`        |
| `npm run build`     | Compile to `dist/` (tests excluded)   |
| `npm test`          | Run the vitest suite                  |
| `npm run test:coverage` | Same, with v8 coverage            |

| Command (front-end) | What it does                          |
| ------------------- | ------------------------------------- |
| `npm start`         | `ng serve` on port 4200               |
| `npm run build`     | Production build to `dist/front-end`  |
| `npx ng test --watch=false` | Run the vitest suite once     |

The server port can be changed with `PORT=…`. The client always connects to
port 3000 on the host it was loaded from (`CHAT_SERVER_URL` in
`front-end/src/app/services/chat-socket.service.ts`).

## Protocol

JSON text frames. The types are in `domain/events.ts`. **The back-end and
front-end copies of that file are identical** and must be kept that way:

```bash
cmp back-end/src/domain/events.ts front-end/src/app/domain/events.ts
```

| Direction       | Event                                  | Meaning |
| --------------- | -------------------------------------- | ------- |
| client → server | `{ type: 'join', name }`               | Must come first. Name is trimmed, 1–20 characters. |
| client → server | `{ type: 'message', text }`            | Text is trimmed, 1–1000 characters. |
| client → server | `{ type: 'typing' }`                   | The user typed in the message box. Throttled to one per 500 ms (client and server). |
| server → client | `{ type: 'joined', userId, name }`     | Join accepted; `userId` identifies your own messages. |
| server → client | `{ type: 'message', message }`         | `message = { id, authorId, author, text, sentAt }`. `sentAt` is the server's clock in epoch ms. |
| server → client | `{ type: 'typing', userId, name }`     | Someone else is typing. Never sent back to the typist. |

The same file has the validators (`normalizeName`, `normalizeText`,
`parseClientEvent`, `parseServerEvent`), so both sides apply the same rules.
Anything that does not parse into a valid event is dropped. This includes
non-JSON, binary frames, unknown types, messages sent before joining and
repeated joins.

## Structure

```
back-end/src/
  domain/events.ts        protocol types + validation (shared copy)
  domain/chat-message.ts  stamps a message with id and server time
  streams/socket.ts       ws sockets as Observables (connections, events, close, errors)
  streams/chat-client.ts  ChatClient: a transport-agnostic connected client
  streams/chat-room.ts    the room: per-client sessions merged into one broadcast stream
  server.ts               wires the WebSocketServer to the room

front-end/src/app/
  domain/events.ts        protocol types + validation (shared copy)
  domain/message-view.ts  what the UI renders for a message (own?, avatar initial/color)
  services/chat-socket.service.ts  rxjs/webSocket connection → Observable<ServerEvent>
  streams/chat-connection.ts       ChatConnection interface (implemented by the service)
  streams/chat-session.ts message$, messages$ (scan), submit(text) → sent$
  streams/scroll.ts       near-bottom check, autoScroll$, scroll helpers, nextRender()
  streams/typing.ts       typingNotices$ (throttle), typingNames$ (who is typing), label text
  streams/unread.ts       unreadCount$ (scan over messages and resets), pill label
  chat/join/              name screen (docs/design/join.png)
  chat/chat-room/         chat screen (docs/design/typing.png, unread.png)
  app.ts                  join$ → session$ → which screen to show
```

## How it is reactive

**Server.** Each connection becomes a session stream. The first valid `join`
starts the session. After that, `switchMap` merges two streams. One is
outbound: the `joined` ack, followed by the room stream. The other is
inbound: this client's messages, stamped and pushed into the room. Each
session ends with `takeUntil(close)`. The room is a single `Subject`, so
order of arrival at the server is the delivery order for everyone (FR-03).
Because it has no replay, newcomers get no history (FR-07). Every session is
wrapped in `catchError`, and socket `error` events are consumed as a stream,
so a misbehaving client can only close its own socket (FR-08). Frames over
64 KiB are rejected by `ws` (`maxPayload`).

**Client.** `webSocket()` gives a hot, shared `event$`. `message$` waits for
`joined` (to learn the user's id), then maps each `message` event to a view,
and `messages$` accumulates them with `scan`. The scroll rule (FR-05, FR-06)
is a pipeline on `message$`:

```ts
autoScroll$(
  message$,
  () => isNearBottom(list),               // measured before the DOM updates
  () => nextRender(injector),             // wait for Angular to render it
).pipe(tap(() => scrollToBottom(list)))   // bound to the component with toSignal
```

The form inputs are also streams. `valueChanges` drives the "Entrar"
disabled state (FR-01). Submitted text flows through `normalizeText` and
`filter` before it is sent, and the input is cleared only for text that was
actually sent (FR-02).

## Requirements covered

| ID    | Where |
| ----- | ----- |
| FR-01 | `chat/join/join.ts` (`canJoin$`, `normalizeName`) |
| FR-02 | `streams/chat-session.ts` (`sent$`), `chat/chat-room/chat-room.ts` |
| FR-03 | `back-end/src/streams/chat-room.ts` (single room stream), `date: 'HH:mm'` in the template |
| FR-04 | `domain/message-view.ts` (`own`), `chat-room.css` |
| FR-05 | `chat-room.ts` scroll pipeline, `streams/scroll.ts` (40 px) |
| FR-06 | same pipeline (`message.own` always scrolls) |
| FR-07 | room is a plain `Subject`; clients subscribe only after joining |
| FR-08 | `parseClientEvent`, per-session `catchError`, socket error stream, `maxPayload` |
| FR-10 | `streams/typing.ts` (`typingNotices$`), `back-end/src/streams/chat-room.ts` (`throttleTime`) |
| FR-11–FR-13 | `streams/typing.ts` (`typingNames$`, `typingSegments`); server skips the typist |
| FR-14 | `.typing` strip in `chat-room.css` (fixed 32 px) |
| FR-15–FR-19 | `streams/unread.ts` (`unreadCount$`), pill in `chat-room.html` |

Out of scope: the "pessoas online" count, reconnection and persistence.
