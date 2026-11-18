import {
  concat,
  distinctUntilChanged,
  filter,
  groupBy,
  map,
  merge,
  mergeMap,
  Observable,
  of,
  scan,
  share,
  shareReplay,
  startWith,
  Subject,
  switchMap,
  take,
  tap,
  throttleTime,
  timer,
} from 'rxjs';
import { normalizeText, type ServerEvent } from '../domain/events';
import { toMessageView, type MessageView } from '../domain/message-view';
import type { ChatConnection } from '../services/chat-socket.service';

type JoinedEvent = Extract<ServerEvent, { type: 'joined' }>;
type MessageEvent = Extract<ServerEvent, { type: 'message' }>;
type TypingEvent = Extract<ServerEvent, { type: 'typing' }>;

const isJoined = (event: ServerEvent): event is JoinedEvent => event.type === 'joined';
const isMessage = (event: ServerEvent): event is MessageEvent => event.type === 'message';
const isTyping = (event: ServerEvent): event is TypingEvent => event.type === 'typing';

/** At most one typing event per this interval (FR-10). */
export const TYPING_THROTTLE_MS = 500;
/** A name leaves the indicator this long after that user's last keystroke (FR-12). */
export const TYPING_TIMEOUT_MS = 2000;

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
  /** The draft after each keystroke in the message box. */
  readonly keystroke: Subject<string>;
  /** Typing events actually sent to the server; subscribe to activate (FR-10). */
  readonly typingSent$: Observable<void>;
  /** Names of the *other* users currently typing, in the order they started (FR-11–13). */
  readonly typers$: Observable<readonly string[]>;
}

/** A change to the set of users who are typing. */
type TypingChange =
  | { readonly userId: string; readonly name: string; readonly typing: true }
  | { readonly userId: string; readonly typing: false };

export function chatSession(name: string, connection: ChatConnection): ChatSession {
  // The server acknowledges the join with our id; everything that depends on it waits for it.
  const userId$ = connection.event$.pipe(
    filter(isJoined),
    take(1),
    map(({ userId }) => userId),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const message$ = userId$.pipe(
    switchMap((userId) =>
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

  // FR-10: a keystroke that leaves text in the box is "typing". Throttled to one event per
  // 500 ms; the throttle restarts after each sent message, because sending clears the
  // indicator for everyone else (FR-12) and the next keystroke should show it again at once.
  const keystroke = new Subject<string>();
  const typingSent$ = sent$.pipe(
    startWith(null),
    switchMap(() =>
      keystroke.pipe(
        filter((draft) => draft.trim() !== ''),
        throttleTime(TYPING_THROTTLE_MS),
      ),
    ),
    tap(() => connection.send({ type: 'typing' })),
    map((): void => undefined),
    share(),
  );

  const typers$ = userId$.pipe(
    switchMap((selfId) => typersOf(connection.event$, selfId)),
    startWith([] as readonly string[]),
    distinctUntilChanged(sameNames),
  );

  return { name, message$, messages$, outgoing, sent$, keystroke, typingSent$, typers$ };
}

/**
 * Who is typing, from the raw event stream. Each user has their own timeline:
 * a typing event shows them and (re)starts a 2 s timer; the timer or a message
 * from them hides them (FR-12). Our own id is ignored (FR-13).
 */
export function typersOf(
  event$: Observable<ServerEvent>,
  selfId: string,
): Observable<readonly string[]> {
  const started$ = event$.pipe(
    filter(isTyping),
    map(({ userId, name }): TypingChange => ({ userId, name, typing: true })),
  );
  const stopped$ = event$.pipe(
    filter(isMessage),
    map(({ message }): TypingChange => ({ userId: message.authorId, typing: false })),
  );

  return merge(started$, stopped$).pipe(
    filter((change) => change.userId !== selfId),
    groupBy((change) => change.userId),
    mergeMap((perUser$) =>
      perUser$.pipe(
        switchMap((change) =>
          change.typing
            ? concat(
                of(change),
                timer(TYPING_TIMEOUT_MS).pipe(
                  map((): TypingChange => ({ userId: change.userId, typing: false })),
                ),
              )
            : of(change),
        ),
      ),
    ),
    scan((typing: ReadonlyMap<string, string>, change) => {
      const next = new Map(typing);
      if (!change.typing) next.delete(change.userId);
      // A Map keeps first-insertion order, so names stay put while someone keeps typing.
      else if (!next.has(change.userId)) next.set(change.userId, change.name);
      return next;
    }, new Map<string, string>()),
    map((typing) => [...typing.values()]),
    distinctUntilChanged(sameNames),
  );
}

function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, i) => name === b[i]);
}
