import {
  concat,
  distinctUntilChanged,
  filter,
  groupBy,
  map,
  merge,
  mergeMap,
  of,
  scan,
  startWith,
  switchMap,
  take,
  throttleTime,
  timer,
  type Observable,
} from 'rxjs';
import { TYPING_THROTTLE_MS, TYPING_TIMEOUT_MS, type ServerEvent } from '../domain/events';

type JoinedEvent = Extract<ServerEvent, { type: 'joined' }>;
type MessageEvent = Extract<ServerEvent, { type: 'message' }>;
type TypingEvent = Extract<ServerEvent, { type: 'typing' }>;

const isJoined = (event: ServerEvent): event is JoinedEvent => event.type === 'joined';
const isMessage = (event: ServerEvent): event is MessageEvent => event.type === 'message';
const isTyping = (event: ServerEvent): event is TypingEvent => event.type === 'typing';

/** One user starting (name) or stopping (null) to type. */
interface TypingChange {
  readonly userId: string;
  readonly name: string | null;
}

/** FR-10: keystrokes -> at most one typing ping per `windowMs` (leading edge). */
export function typingPings$(keystroke$: Observable<unknown>, windowMs = TYPING_THROTTLE_MS): Observable<void> {
  return keystroke$.pipe(
    throttleTime(windowMs, undefined, { leading: true, trailing: false }),
    map(() => undefined),
  );
}

/**
 * FR-11 / FR-12 / FR-13: names of the *other* users currently typing, in the order
 * they started. A name leaves `timeoutMs` after that user's last typing event, or
 * immediately when a message from them arrives. Starts with [].
 */
export function whoIsTyping$(
  event$: Observable<ServerEvent>,
  selfId: string,
  timeoutMs = TYPING_TIMEOUT_MS,
): Observable<readonly string[]> {
  const authorId$ = event$.pipe(
    filter(isMessage),
    map(({ message }) => message.authorId),
  );

  const change$ = event$.pipe(
    filter(isTyping),
    filter(({ userId }) => userId !== selfId),
    groupBy(({ userId }) => userId),
    mergeMap((typing$) =>
      typing$.pipe(
        // Every new typing event from this user restarts their 2 s countdown.
        switchMap(({ userId, name }) =>
          concat(
            of<TypingChange>({ userId, name }),
            merge(timer(timeoutMs), authorId$.pipe(filter((id) => id === userId))).pipe(
              take(1),
              map((): TypingChange => ({ userId, name: null })),
            ),
          ),
        ),
      ),
    ),
  );

  return change$.pipe(
    scan((typers: ReadonlyMap<string, string>, { userId, name }) => {
      const next = new Map(typers);
      if (name === null) next.delete(userId);
      else next.set(userId, name);
      return next;
    }, new Map<string, string>()),
    map((typers): readonly string[] => [...typers.values()]),
    startWith([] as readonly string[]),
    distinctUntilChanged(sameNames),
  );
}

/** `whoIsTyping$` for this user, once the server has told us our id. Starts with []. */
export function othersTyping$(
  event$: Observable<ServerEvent>,
  timeoutMs = TYPING_TIMEOUT_MS,
): Observable<readonly string[]> {
  return event$.pipe(
    filter(isJoined),
    take(1),
    switchMap(({ userId }) => whoIsTyping$(event$, userId, timeoutMs)),
    startWith([] as readonly string[]),
    distinctUntilChanged(sameNames),
  );
}

function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, index) => name === b[index]);
}
