import {
  concat,
  distinctUntilChanged,
  filter,
  groupBy,
  map,
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

/** FR-10: at most one typing ping per `windowMs`, sent on the first keystroke of each window. */
export function typingPings$(keystroke$: Observable<unknown>, windowMs = TYPING_THROTTLE_MS): Observable<void> {
  return keystroke$.pipe(
    throttleTime(windowMs),
    map(() => undefined),
  );
}

/** One user started (name) or stopped (null) typing. */
interface TypingChange {
  readonly userId: string;
  readonly name: string | null;
}

type JoinedEvent = Extract<ServerEvent, { type: 'joined' }>;
const isJoined = (event: ServerEvent): event is JoinedEvent => event.type === 'joined';

/** A typing ping starts a user; any message from them stops them (FR-12). */
function toTypingSignal(event: ServerEvent): TypingChange | null {
  switch (event.type) {
    case 'typing':
      return { userId: event.userId, name: event.name };
    case 'message':
      return { userId: event.message.authorId, name: null };
    default:
      return null;
  }
}

/**
 * FR-11 / FR-12 / FR-13: names of the other users who are typing right now, in the
 * order they started. A name leaves `ttlMs` after that user's last typing ping, or as
 * soon as a message from them arrives. Our own id (from the join ack) is never listed.
 */
export function typingNames$(
  event$: Observable<ServerEvent>,
  ttlMs = TYPING_TIMEOUT_MS,
): Observable<readonly string[]> {
  return event$.pipe(
    filter(isJoined),
    take(1),
    switchMap(({ userId: selfId }) =>
      event$.pipe(
        map(toTypingSignal),
        filter((change): change is TypingChange => change !== null && change.userId !== selfId),
        // One timer per user: a new ping or a message replaces that user's pending expiry.
        groupBy((change) => change.userId),
        mergeMap((user$) =>
          user$.pipe(
            switchMap((change) =>
              change.name === null
                ? of(change)
                : concat(of(change), timer(ttlMs).pipe(map((): TypingChange => ({ ...change, name: null })))),
            ),
          ),
        ),
        scan((typing: ReadonlyMap<string, string>, change) => {
          const next = new Map(typing);
          if (change.name === null) next.delete(change.userId);
          else next.set(change.userId, change.name);
          return next;
        }, new Map<string, string>()),
        map((typing) => [...typing.values()]),
      ),
    ),
    startWith([] as readonly string[]),
    distinctUntilChanged(sameNames),
  );
}

function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, index) => name === b[index]);
}
