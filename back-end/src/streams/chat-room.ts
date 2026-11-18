import { randomUUID } from 'node:crypto';
import {
  catchError,
  concat,
  EMPTY,
  filter,
  ignoreElements,
  map,
  merge,
  mergeMap,
  of,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap,
  type Observable,
} from 'rxjs';
import { WebSocket } from 'ws';
import { createMessage } from '../domain/chat-message.js';
import type { ChatMessage, ClientEvent, ServerEvent } from '../domain/events.js';
import { clientEvent$, closed$, socketError$ } from './socket.js';

type JoinEvent = Extract<ClientEvent, { type: 'join' }>;
type SendEvent = Extract<ClientEvent, { type: 'message' }>;

const isJoin = (event: ClientEvent): event is JoinEvent => event.type === 'join';
const isSend = (event: ClientEvent): event is SendEvent => event.type === 'message';

/**
 * One chat room. Every joined client's messages are merged into `room$`
 * and fanned out to every joined client, in the order the server received them.
 */
export function chatRoom(connections: Observable<WebSocket>): Observable<never> {
  const room$ = new Subject<ChatMessage>();

  return connections.pipe(
    // One failing client must never take the room (or the server) down.
    mergeMap((socket) => clientSession(socket, room$).pipe(catchError(() => EMPTY))),
  );
}

function clientSession(socket: WebSocket, room$: Subject<ChatMessage>): Observable<never> {
  const userId = randomUUID();
  const event$ = clientEvent$(socket);

  // The first valid join names the client; later joins are ignored.
  const name$ = event$.pipe(
    filter(isJoin),
    take(1),
    map((event) => event.name),
  );

  const session$ = name$.pipe(
    switchMap((name) =>
      merge(
        // Outbound: acknowledge the join, then everything said in the room from now on.
        // `room$` is a plain Subject, so there is no history (FR-07).
        concat(
          of<ServerEvent>({ type: 'joined', userId, name }),
          room$.pipe(map((message): ServerEvent => ({ type: 'message', message }))),
        ).pipe(tap((event) => send(socket, event))),

        // Inbound: this client's messages go to the room.
        event$.pipe(
          filter(isSend),
          map((event) => createMessage(userId, name, event.text)),
          tap((message) => room$.next(message)),
        ),
      ),
    ),
  );

  // Swallow socket errors so they are never thrown as unhandled 'error' events.
  const error$ = socketError$(socket).pipe(
    tap((error) => console.warn(`[socket ${userId.slice(0, 8)}] ${error.message}`)),
  );

  return merge(session$, error$).pipe(ignoreElements(), takeUntil(closed$(socket)));
}

function send(socket: WebSocket, event: ServerEvent): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
}
