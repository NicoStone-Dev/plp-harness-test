import {
  concat,
  distinctUntilChanged,
  filter,
  groupBy,
  map,
  merge,
  mergeMap,
  type Observable,
  of,
  repeat,
  scan,
  startWith,
  switchMap,
  take,
  takeUntil,
  throttleTime,
  timer,
} from 'rxjs';
import type { ServerEvent } from '../domain/events';

/** FR-10: at most one typing event per this many ms. */
export const TYPING_THROTTLE_MS = 500;
/** FR-12: a name disappears this long after that user's last keystroke. */
export const TYPING_TIMEOUT_MS = 2000;

type TypingEvent = Extract<ServerEvent, { type: 'typing' }>;
type MessageEvent = Extract<ServerEvent, { type: 'message' }>;

const isTyping = (event: ServerEvent): event is TypingEvent => event.type === 'typing';
const isMessage = (event: ServerEvent): event is MessageEvent => event.type === 'message';

/**
 * FR-10: keystrokes -> typing signals, at most one per 500 ms. The first keystroke
 * goes out at once and the last one is not lost (trailing). A sent message
 * (`sent$`) drops any pending trailing signal, so the name is not shown again
 * right after the message cleared it (FR-12), and restarts the window.
 */
export function typingSignal$<T>(keystroke$: Observable<T>, sent$: Observable<unknown>): Observable<T> {
  return keystroke$.pipe(
    throttleTime(TYPING_THROTTLE_MS, undefined, { leading: true, trailing: true }),
    takeUntil(sent$),
    repeat(),
  );
}

/** One user starting (name) or stopping (null) to type. */
interface TypingChange {
  readonly userId: string;
  readonly name: string | null;
}

/**
 * FR-11 / FR-12 / FR-13: names of the other users who are typing, in the order
 * they started. A name is removed 2 s after that user's last typing event or as
 * soon as a message from them arrives. The own user is never listed.
 */
export function typingNames$(event$: Observable<ServerEvent>, selfId: string): Observable<readonly string[]> {
  const messageFrom$ = (userId: string) =>
    event$.pipe(filter((event): event is MessageEvent => isMessage(event) && event.message.authorId === userId));

  return event$.pipe(
    filter(isTyping),
    filter((event) => event.userId !== selfId),
    groupBy((event) => event.userId),
    mergeMap((typist$) =>
      typist$.pipe(
        // Every new typing event restarts this user's 2 s countdown.
        switchMap(({ userId, name }) =>
          concat(
            of<TypingChange>({ userId, name }),
            merge(timer(TYPING_TIMEOUT_MS), messageFrom$(userId)).pipe(
              take(1),
              map((): TypingChange => ({ userId, name: null })),
            ),
          ),
        ),
      ),
    ),
    scan((typists: ReadonlyMap<string, string>, { userId, name }) => {
      const next = new Map(typists);
      if (name === null) next.delete(userId);
      else next.set(userId, name);
      return next;
    }, new Map<string, string>()),
    map((typists) => [...typists.values()]),
    startWith([] as readonly string[]),
    distinctUntilChanged(sameNames),
  );
}

/** Same names in the same order. */
export function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, index) => name === b[index]);
}
