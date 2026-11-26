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
import { createMessage } from '../domain/chat-message.js';
import type { ChatMessage, ClientEvent, ServerEvent } from '../domain/events.js';
import type { ChatClient } from './chat-client.js';
import { throttleTyping } from './typing.js';

type JoinEvent = Extract<ClientEvent, { type: 'join' }>;
type SendEvent = Extract<ClientEvent, { type: 'message' }>;
type TypingEvent = Extract<ClientEvent, { type: 'typing' }>;

const isJoin = (event: ClientEvent): event is JoinEvent => event.type === 'join';
const isSend = (event: ClientEvent): event is SendEvent => event.type === 'message';
const isTyping = (event: ClientEvent): event is TypingEvent => event.type === 'typing';

/** What one session publishes to the whole room. */
type RoomEvent =
  | { readonly kind: 'message'; readonly message: ChatMessage }
  | { readonly kind: 'typing'; readonly userId: string; readonly name: string };

/** Room event -> what `userId` should receive, or null if it is not for them. */
function toServerEvent(event: RoomEvent, userId: string): ServerEvent | null {
  switch (event.kind) {
    case 'message':
      return { type: 'message', message: event.message };
    case 'typing':
      // FR-13: nobody is told that they themselves are typing.
      return event.userId === userId ? null : { type: 'typing', userId: event.userId, name: event.name };
  }
}

/**
 * One chat room. Every joined client's messages and typing pings are merged into
 * `room$` and fanned out to every joined client, in the order the server received them.
 * Typing pings are throttled per user (FR-10) and never echoed to their sender (FR-13).
 */
export function chatRoom(client$: Observable<ChatClient>): Observable<never> {
  // Private to this room: only handed to the room's own sessions.
  const room$ = new Subject<RoomEvent>();

  return client$.pipe(
    // One failing client must never take the room (or the server) down.
    mergeMap((client) => clientSession(client, room$).pipe(catchError(() => EMPTY))),
  );
}

function clientSession(client: ChatClient, room$: Subject<RoomEvent>): Observable<never> {
  const userId = randomUUID();
  const { event$ } = client;

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
          room$.pipe(
            map((event) => toServerEvent(event, userId)),
            filter((event): event is ServerEvent => event !== null),
          ),
        ).pipe(tap((event) => client.send(event))),

        // Inbound: this client's messages go to the room.
        event$.pipe(
          filter(isSend),
          map((event) => createMessage(userId, name, event.text)),
          tap((message) => room$.next({ kind: 'message', message })),
        ),

        // Inbound: this client's typing pings, at most one per 500 ms (FR-10).
        throttleTyping(event$.pipe(filter(isTyping))).pipe(
          tap(() => room$.next({ kind: 'typing', userId, name })),
        ),
      ),
    ),
  );

  // Swallow socket errors so they are never thrown as unhandled 'error' events.
  const error$ = client.error$.pipe(
    tap((error) => console.warn(`[socket ${userId.slice(0, 8)}] ${error.message}`)),
  );

  return merge(session$, error$).pipe(ignoreElements(), takeUntil(client.closed$));
}
