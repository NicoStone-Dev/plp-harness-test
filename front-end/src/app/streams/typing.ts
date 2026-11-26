import {
  concat,
  distinctUntilChanged,
  groupBy,
  map,
  mergeMap,
  of,
  scan,
  startWith,
  switchMap,
  throttleTime,
  timer,
  type Observable,
} from 'rxjs';

/** FR-10: at most one typing event every 500 ms. */
export const TYPING_THROTTLE_MS = 500;
/** FR-12: a name disappears 2 s after that user's last keystroke. */
export const TYPING_EXPIRE_MS = 2000;

/** What we learn about another user: they typed, or they stopped (sent a message). */
export type TypingSignal =
  | { readonly kind: 'typing'; readonly userId: string; readonly name: string }
  | { readonly kind: 'stopped'; readonly userId: string };

/** FR-10: keystrokes -> typing pings, the first one immediately, then at most one per window. */
export function typingPings$(keystroke$: Observable<unknown>, windowMs = TYPING_THROTTLE_MS): Observable<void> {
  return keystroke$.pipe(
    throttleTime(windowMs),
    map(() => undefined),
  );
}

interface Change {
  readonly userId: string;
  /** null = remove this user from the indicator. */
  readonly name: string | null;
}

/**
 * FR-11 / FR-12: names of the users currently typing, in the order they started.
 * Starts empty. Each user's name is removed `expireMs` after their last typing
 * signal, or immediately when they stop (send a message).
 */
export function typingUsers$(
  signal$: Observable<TypingSignal>,
  expireMs = TYPING_EXPIRE_MS,
): Observable<readonly string[]> {
  return signal$.pipe(
    // One timer per user: a new signal from that user restarts only their timer.
    groupBy((signal) => signal.userId),
    mergeMap((user$) =>
      user$.pipe(
        switchMap((signal): Observable<Change> => {
          const removed: Change = { userId: signal.userId, name: null };
          return signal.kind === 'typing'
            ? concat(of({ userId: signal.userId, name: signal.name }), timer(expireMs).pipe(map(() => removed)))
            : of(removed);
        }),
      ),
    ),
    scan((typing: ReadonlyMap<string, string>, change) => {
      const next = new Map(typing);
      if (change.name === null) next.delete(change.userId);
      else next.set(change.userId, change.name);
      return next;
    }, new Map<string, string>()),
    map((typing) => [...typing.values()]),
    startWith([] as readonly string[]),
    distinctUntilChanged(sameNames),
  );
}

function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, index) => name === b[index]);
}
