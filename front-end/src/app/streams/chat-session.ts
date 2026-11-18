import { filter, map, Observable, scan, share, startWith, Subject, switchMap, take, tap } from 'rxjs';
import { normalizeText, type ServerEvent } from '../domain/events';
import { toMessageView, type MessageView } from '../domain/message-view';
import type { ChatConnection } from '../services/chat-socket.service';

type JoinedEvent = Extract<ServerEvent, { type: 'joined' }>;
type MessageEvent = Extract<ServerEvent, { type: 'message' }>;

const isJoined = (event: ServerEvent): event is JoinedEvent => event.type === 'joined';
const isMessage = (event: ServerEvent): event is MessageEvent => event.type === 'message';

export interface ChatSession {
  readonly name: string;
  /** Each message as it arrives, in server order (FR-03). */
  readonly message$: Observable<MessageView>;
  /** All messages received since joining (FR-07: the server sends no history). */
  readonly messages$: Observable<readonly MessageView[]>;
  /** Raw text typed by the user; blank text is dropped (FR-02). */
  readonly outgoing: Subject<string>;
  /** Text that was actually sent. */
  readonly sent$: Observable<string>;
}

export function chatSession(name: string, connection: ChatConnection): ChatSession {
  // The server acknowledges the join with our id; every later message is compared to it.
  const message$ = connection.event$.pipe(
    filter(isJoined),
    take(1),
    switchMap(({ userId }) =>
      connection.event$.pipe(
        filter(isMessage),
        map(({ message }) => toMessageView(message, userId)),
      ),
    ),
    share(),
  );

  const messages$ = message$.pipe(
    scan((all: readonly MessageView[], message) => [...all, message], []),
    startWith([] as readonly MessageView[]),
  );

  const outgoing = new Subject<string>();
  const sent$ = outgoing.pipe(
    map(normalizeText),
    filter((text): text is string => text !== null),
    tap((text) => connection.send({ type: 'message', text })),
    share(),
  );

  return { name, message$, messages$, outgoing, sent$ };
}
