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
import type { ClientEvent, ServerEvent } from '../domain/events.js';
import type { ChatClient } from './chat-client.js';
import { throttleTyping } from './typing.js';

type JoinEvent = Extract<ClientEvent, { type: 'join' }>;
type SendEvent = Extract<ClientEvent, { type: 'message' }>;
type TypingEvent = Extract<ClientEvent, { type: 'typing' }>;

/** What is broadcast in the room: messages and typing notices. */
type RoomEvent = Extract<ServerEvent, { type: 'message' | 'typing' }>;

const isJoin = (event: ClientEvent): event is JoinEvent => event.type === 'join';
const isSend = (event: ClientEvent): event is SendEvent => event.type === 'message';
const isTyping = (event: ClientEvent): event is TypingEvent => event.type === 'typing';

/** FR-13: a typing notice is never sent back to the user who is typing. */
const isForUser = (userId: string) => (event: RoomEvent): boolean =>
  !(event.type === 'typing' && event.userId === userId);

/**
 * One chat room. Every joined client's messages are merged into `room$`
 * and fanned out to every joined client, in the order the server received them.
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
          room$.pipe(filter(isForUser(userId))),
        ).pipe(tap((event) => client.send(event))),

        // Inbound: this client's messages go to the room.
        event$.pipe(
          filter(isSend),
          map((event): RoomEvent => ({ type: 'message', message: createMessage(userId, name, event.text) })),
          tap((event) => room$.next(event)),
        ),

        // Inbound: this client's keystrokes, throttled per user (FR-10), go to the room.
        throttleTyping(event$.pipe(filter(isTyping)), event$.pipe(filter(isSend))).pipe(
          map((): RoomEvent => ({ type: 'typing', userId, name })),
          tap((event) => room$.next(event)),
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
