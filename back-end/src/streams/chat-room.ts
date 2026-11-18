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
  throttleTime,
  type Observable,
} from 'rxjs';
import { WebSocket } from 'ws';
import { createMessage } from '../domain/chat-message.js';
import type { ClientEvent, ServerEvent } from '../domain/events.js';
import { clientEvent$, closed$, socketError$ } from './socket.js';

type JoinEvent = Extract<ClientEvent, { type: 'join' }>;
type SendEvent = Extract<ClientEvent, { type: 'message' }>;
type TypingEvent = Extract<ClientEvent, { type: 'typing' }>;

const isJoin = (event: ClientEvent): event is JoinEvent => event.type === 'join';
const isSend = (event: ClientEvent): event is SendEvent => event.type === 'message';
const isTyping = (event: ClientEvent): event is TypingEvent => event.type === 'typing';

/** At most one typing event per user per this interval (FR-10). */
export const TYPING_THROTTLE_MS = 500;

/** Something said in the room, tagged with who said it. */
interface RoomEvent {
  readonly from: string;
  readonly event: ServerEvent;
}

/**
 * One chat room. Every joined client's messages are merged into `room$`
 * and fanned out to every joined client, in the order the server received them.
 */
export function chatRoom(connections: Observable<WebSocket>): Observable<never> {
  const room$ = new Subject<RoomEvent>();

  return connections.pipe(
    // One failing client must never take the room (or the server) down.
    mergeMap((socket) => clientSession(socket, room$).pipe(catchError(() => EMPTY))),
  );
}

function clientSession(socket: WebSocket, room$: Subject<RoomEvent>): Observable<never> {
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
          // Nobody is told about their own typing (FR-13).
          room$.pipe(
            filter(({ from, event }) => event.type !== 'typing' || from !== userId),
            map(({ event }) => event),
          ),
        ).pipe(tap((event) => send(socket, event))),

        // Inbound: this client's messages go to the room.
        event$.pipe(
          filter(isSend),
          map((event) => createMessage(userId, name, event.text)),
          tap((message) => room$.next({ from: userId, event: { type: 'message', message } })),
        ),

        // Inbound: typing notifications, throttled per user even if the client floods them (FR-10).
        event$.pipe(
          filter(isTyping),
          throttleTime(TYPING_THROTTLE_MS),
          tap(() => room$.next({ from: userId, event: { type: 'typing', userId, name } })),
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
