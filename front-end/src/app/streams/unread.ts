import { distinctUntilChanged, filter, map, merge, type Observable, scan, startWith } from 'rxjs';

type UnreadStep = 'add' | 'reset';

/**
 * Unread counter.
 * - FR-15: a message from someone else while the user is scrolled up (more than
 *   40 px from the bottom, measured *before* the message renders) adds 1.
 * - FR-19: the user's own messages never add.
 * - FR-17 / FR-18: any emission of `reset$` (pill click, reaching the bottom) sets it to 0.
 */
export function unreadCount$(
  message$: Observable<{ readonly own: boolean }>,
  wasNearBottom: () => boolean,
  reset$: Observable<unknown>,
): Observable<number> {
  return merge(
    message$.pipe(
      filter((message) => !message.own && !wasNearBottom()),
      map((): UnreadStep => 'add'),
    ),
    reset$.pipe(map((): UnreadStep => 'reset')),
  ).pipe(
    scan((count, step: UnreadStep) => (step === 'add' ? count + 1 : 0), 0),
    startWith(0),
    distinctUntilChanged(),
  );
}

/** FR-18: scroll events -> one emission each time the user is at the bottom (within 40 px). */
export function reachedBottom$(scroll$: Observable<unknown>, isAtBottom: () => boolean): Observable<void> {
  return scroll$.pipe(
    filter(() => isAtBottom()),
    map(() => undefined),
  );
}
