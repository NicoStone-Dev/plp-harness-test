import {
  asyncScheduler,
  concat,
  distinctUntilChanged,
  filter,
  groupBy,
  map,
  mergeMap,
  Observable,
  of,
  race,
  scan,
  shareReplay,
  startWith,
  switchMap,
  take,
  throttleTime,
  timer,
  withLatestFrom,
  type SchedulerLike,
} from 'rxjs';
import type { ServerEvent } from '../domain/events';

/** FR-10: at most one typing event every 500 ms. */
export const TYPING_THROTTLE_MS = 500;
/** FR-12: a name disappears 2 s after that user's last keystroke. */
export const TYPING_TIMEOUT_MS = 2000;

type TypingEvent = Extract<ServerEvent, { type: 'typing' }>;
type MessageEvent = Extract<ServerEvent, { type: 'message' }>;

const isTyping = (event: ServerEvent): event is TypingEvent => event.type === 'typing';
const isMessage = (event: ServerEvent): event is MessageEvent => event.type === 'message';

/**
 * FR-10: keystrokes -> the moments a typing event should be sent.
 *
 * Throttled to one per 500 ms. The trailing edge is kept so the last keystroke
 * of a burst is reported too (the name then lasts 2 s after it), but a trailing
 * emission is dropped if a message was sent after that keystroke, otherwise the
 * name would reappear right after the message cleared it (FR-12).
 */
export function typingSignal$(
  keystroke$: Observable<unknown>,
  sent$: Observable<unknown>,
  scheduler: SchedulerLike = asyncScheduler,
): Observable<void> {
  // How many messages have been sent so far: tags each keystroke with its "epoch".
  const sentCount$ = sent$.pipe(
    scan((count) => count + 1, 0),
    startWith(0),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  return keystroke$.pipe(
    withLatestFrom(sentCount$),
    map(([, epoch]) => epoch),
    throttleTime(TYPING_THROTTLE_MS, scheduler, { leading: true, trailing: true }),
    withLatestFrom(sentCount$),
    filter(([epoch, now]) => epoch === now),
    map(() => undefined),
  );
}

type Change = { readonly userId: string } & (
  { readonly typing: true; readonly name: string } | { readonly typing: false }
);

/**
 * FR-11 to FR-13: server events -> names of the *other* users typing right now,
 * in the order they started typing.
 */
export function typists$(
  event$: Observable<ServerEvent>,
  selfId: string,
  scheduler: SchedulerLike = asyncScheduler,
): Observable<readonly string[]> {
  const messageFrom = (userId: string) =>
    event$.pipe(
      filter(isMessage),
      filter(({ message }) => message.authorId === userId),
    );

  const change$ = event$.pipe(
    filter(isTyping),
    filter(({ userId }) => userId !== selfId), // FR-13 (the server also never echoes it)
    groupBy(({ userId }) => userId),
    mergeMap((typing$) =>
      typing$.pipe(
        // Each new typing event restarts this user's 2 s countdown (FR-12)...
        switchMap(({ userId, name }) =>
          concat(
            of<Change>({ userId, name, typing: true }),
            // ...which ends early if they send a message (FR-12).
            race(timer(TYPING_TIMEOUT_MS, scheduler), messageFrom(userId)).pipe(
              take(1),
              map((): Change => ({ userId, typing: false })),
            ),
          ),
        ),
      ),
    ),
  );

  return change$.pipe(
    scan((typing: ReadonlyMap<string, string>, change) => {
      const next = new Map(typing);
      if (change.typing) next.set(change.userId, change.name);
      else next.delete(change.userId);
      return next;
    }, new Map<string, string>()),
    map((typing) => [...typing.values()]),
    startWith([] as readonly string[]),
    distinctUntilChanged((a, b) => a.length === b.length && a.every((name, i) => name === b[i])),
  );
}
