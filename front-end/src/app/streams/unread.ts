import { distinctUntilChanged, filter, map, merge, type Observable, scan, startWith } from 'rxjs';

/**
 * Unread counter for the "N novas mensagens" pill.
 *
 * - FR-15: each message from someone else that arrives while the user is
 *   scrolled up (measured *before* it is rendered) adds 1.
 * - FR-19: the user's own messages never add to it.
 * - FR-17 / FR-18: `reset$` (pill clicked, or the bottom reached by scrolling) sets it to 0.
 */
export function unreadCount$(
  message$: Observable<{ readonly own: boolean }>,
  wasNearBottom: () => boolean,
  reset$: Observable<unknown>,
): Observable<number> {
  const unseen$ = message$.pipe(
    filter((message) => !message.own && !wasNearBottom()),
    map(() => 1),
  );

  return merge(unseen$, reset$.pipe(map(() => 0))).pipe(
    scan((count, delta) => (delta === 0 ? 0 : count + delta), 0),
    startWith(0),
    distinctUntilChanged(),
  );
}
