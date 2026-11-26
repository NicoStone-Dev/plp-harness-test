import { filter, map, Observable, scan, share, startWith, Subject, switchMap, take, tap } from 'rxjs';
import { normalizeText, type ServerEvent } from '../domain/events';
import { toMessageView, type MessageView } from '../domain/message-view';
import type { ChatConnection } from './chat-connection';
import { typingNames$, typingNotices$ } from './typing';

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
  /** Report a keystroke in the message box (FR-10). */
  keystroke(): void;
  /** Typing notices actually sent, at most one per 500 ms (FR-10). Must be subscribed to send. */
  readonly typingSent$: Observable<unknown>;
  /** Names of the other users typing right now (FR-11 to FR-13). */
  readonly typingNames$: Observable<readonly string[]>;
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

  const keystroke$ = new Subject<void>();
  const typingSent$ = typingNotices$(keystroke$, () => connection.send({ type: 'typing' })).pipe(share());

  return {
    name,
    message$,
    messages$,
    submit: (text) => outgoing$.next(text),
    sent$,
    keystroke: () => keystroke$.next(),
    typingSent$,
    typingNames$: typingNames$(connection.event$),
  };
}
