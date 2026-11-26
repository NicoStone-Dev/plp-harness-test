import {
  concat,
  distinctUntilChanged,
  filter,
  groupBy,
  map,
  mergeMap,
  type Observable,
  of,
  scan,
  startWith,
  switchMap,
  take,
  throttleTime,
  timer,
} from 'rxjs';
import type { ServerEvent } from '../domain/events';

/** FR-10: at most one typing event every 500 ms. */
export const TYPING_THROTTLE_MS = 500;
/** FR-12: a name disappears 2 s after that user's last keystroke. */
export const TYPING_IDLE_MS = 2000;

type JoinedEvent = Extract<ServerEvent, { type: 'joined' }>;
const isJoined = (event: ServerEvent): event is JoinedEvent => event.type === 'joined';

/** A user started (typing: true) or stopped (typing: false) typing. */
interface TypingChange {
  readonly userId: string;
  readonly name: string;
  readonly typing: boolean;
}

/** FR-10: keystrokes -> typing pings, at most one per `windowMs` (leading edge). */
export function typingPings$(keystroke$: Observable<unknown>, windowMs = TYPING_THROTTLE_MS): Observable<void> {
  return keystroke$.pipe(
    throttleTime(windowMs),
    map(() => undefined),
  );
}

/** Server events -> names of the other users typing now, once the join is acknowledged (FR-13). */
export function typingNames$(event$: Observable<ServerEvent>, idleMs = TYPING_IDLE_MS): Observable<readonly string[]> {
  return event$.pipe(
    filter(isJoined),
    take(1),
    switchMap(({ userId }) => activeTypers$(event$, userId, idleMs)),
    startWith([] as readonly string[]),
    distinctUntilChanged(sameNames),
  );
}

/**
 * FR-11 / FR-12 / FR-13: names of users other than `selfId` who are typing, in the
 * order they started. A name is removed `idleMs` after that user's last typing
 * event, or as soon as a message from them arrives.
 */
export function activeTypers$(
  event$: Observable<ServerEvent>,
  selfId: string,
  idleMs = TYPING_IDLE_MS,
): Observable<readonly string[]> {
  const change$ = event$.pipe(
    map(toTypingChange),
    filter((change): change is TypingChange => change !== null && change.userId !== selfId),
    groupBy((change) => change.userId),
    // Per user: each keystroke restarts that user's idle timer; a message ends it at once.
    mergeMap((user$) =>
      user$.pipe(
        switchMap((change) =>
          change.typing ? concat(of(change), timer(idleMs).pipe(map(() => ({ ...change, typing: false })))) : of(change),
        ),
      ),
    ),
  );

  return change$.pipe(
    scan((typers: ReadonlyMap<string, string>, change) => {
      const next = new Map(typers);
      if (change.typing) next.set(change.userId, change.name);
      else next.delete(change.userId);
      return next;
    }, new Map<string, string>()),
    map((typers) => [...typers.values()]),
    startWith([] as readonly string[]),
    distinctUntilChanged(sameNames),
  );
}

function toTypingChange(event: ServerEvent): TypingChange | null {
  switch (event.type) {
    case 'typing':
      return { userId: event.userId, name: event.name, typing: true };
    case 'message':
      return { userId: event.message.authorId, name: event.message.author, typing: false };
    default:
      return null;
  }
}

function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, index) => name === b[index]);
}
