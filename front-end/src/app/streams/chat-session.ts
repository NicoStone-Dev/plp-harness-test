import { filter, map, mergeMap, Observable, of, scan, share, startWith, Subject, switchMap, take, tap } from 'rxjs';
import { normalizeText, type ServerEvent } from '../domain/events';
import { toMessageView, type MessageView } from '../domain/message-view';
import type { ChatConnection } from './chat-connection';
import { typingPings$, typingUsers$, type TypingSignal } from './typing';

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
  /** Submit raw text typed by the user; blank text is dropped (FR-02). */
  submit(text: string): void;
  /** Text that was actually sent. */
  readonly sent$: Observable<string>;
  /** Names of the other users currently typing, in the order they started (FR-11 to FR-13). */
  readonly typing$: Observable<readonly string[]>;
  /** Report a keystroke in the message box (FR-10). */
  keystroke(): void;
  /** Typing pings actually sent: at most one per 500 ms. Must be subscribed for pings to go out. */
  readonly typingSent$: Observable<void>;
}

/** Server events -> this user's messages as views, once the join is acknowledged. */
export function messageViews$(event$: Observable<ServerEvent>): Observable<MessageView> {
  // The server acknowledges the join with our id; every later message is compared to it.
  return event$.pipe(
    filter(isJoined),
    take(1),
    switchMap(({ userId }) =>
      event$.pipe(
        filter(isMessage),
        map(({ message }) => toMessageView(message, userId)),
      ),
    ),
  );
}

/**
 * Server events -> what we learn about other users typing, once the join is acknowledged.
 * Our own id is filtered out (FR-13); a message from someone means they stopped (FR-12).
 */
export function typingSignals$(event$: Observable<ServerEvent>): Observable<TypingSignal> {
  return event$.pipe(
    filter(isJoined),
    take(1),
    switchMap(({ userId: selfId }) =>
      event$.pipe(
        mergeMap((event): Observable<TypingSignal> => {
          if (event.type === 'typing' && event.userId !== selfId) {
            return of({ kind: 'typing', userId: event.userId, name: event.name });
          }
          if (event.type === 'message') return of({ kind: 'stopped', userId: event.message.authorId });
          return of();
        }),
      ),
    ),
  );
}

/** Running list of every message so far, starting empty. */
export function messageList$(message$: Observable<MessageView>): Observable<readonly MessageView[]> {
  return message$.pipe(
    scan((all: readonly MessageView[], message) => [...all, message], []),
    startWith([] as readonly MessageView[]),
  );
}

/** Raw typed text -> normalized text that was handed to `send` (FR-02). */
export function sentText$(text$: Observable<string>, send: (text: string) => void): Observable<string> {
  return text$.pipe(
    map(normalizeText),
    filter((text): text is string => text !== null),
    tap((text) => send(text)),
  );
}

export function chatSession(name: string, connection: ChatConnection): ChatSession {
  const message$ = messageViews$(connection.event$).pipe(share());
  const messages$ = messageList$(message$);

  // Private to the session: callers push text through `submit`.
  const outgoing$ = new Subject<string>();
  const sent$ = sentText$(outgoing$, (text) => connection.send({ type: 'message', text })).pipe(share());

  const typing$ = typingUsers$(typingSignals$(connection.event$));

  // Private to the session: callers report keystrokes through `keystroke`.
  const keystroke$ = new Subject<void>();
  const typingSent$ = typingPings$(keystroke$).pipe(
    tap(() => connection.send({ type: 'typing' })),
    share(),
  );

  return {
    name,
    message$,
    messages$,
    submit: (text) => outgoing$.next(text),
    sent$,
    typing$,
    keystroke: () => keystroke$.next(),
    typingSent$,
  };
}
