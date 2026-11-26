import { distinctUntilChanged, filter, map, merge, Observable, scan, startWith } from 'rxjs';

/**
 * FR-15 to FR-19: the unread counter.
 *
 * Each message from someone else that arrives while the user is scrolled up
 * (`wasNearBottom()` measured *before* it is rendered) adds 1 (FR-15). The user's
 * own messages never count (FR-19). Any `reset$` emission sets it back to 0
 * (FR-17 pill click, FR-18 reaching the bottom).
 */
export function unreadCount$(
  message$: Observable<{ readonly own: boolean }>,
  wasNearBottom: () => boolean,
  reset$: Observable<unknown>,
): Observable<number> {
  const unread$ = message$.pipe(
    filter((message) => !message.own),
    filter(() => !wasNearBottom()),
    map(() => (count: number) => count + 1),
  );
  const cleared$ = reset$.pipe(map(() => () => 0));

  return merge(unread$, cleared$).pipe(
    scan((count, update) => update(count), 0),
    startWith(0),
    distinctUntilChanged(),
  );
}

/** FR-18: scroll events -> the ones that left the list at the bottom. */
export function reachedBottom$(
  scroll$: Observable<unknown>,
  atBottom: () => boolean,
): Observable<void> {
  return scroll$.pipe(
    filter(() => atBottom()),
    map(() => undefined),
  );
}
