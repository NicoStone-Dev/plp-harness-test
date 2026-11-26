import { distinctUntilChanged, filter, map, merge, scan, startWith, type Observable } from 'rxjs';

type UnreadAction = 'add' | 'reset';

/**
 * FR-15 to FR-19: number of messages from others that arrived while the user was
 * scrolled up.
 * - A message from someone else adds 1 if, when it arrived (before it is rendered),
 *   the user was not near the bottom (FR-15). Own messages never count (FR-19).
 * - A scroll that ends near the bottom resets to 0 (FR-18).
 * - Clicking the pill (`jump$`) resets to 0 (FR-17).
 */
export function unreadCount$(
  message$: Observable<{ readonly own: boolean }>,
  isNearBottom: () => boolean,
  scroll$: Observable<unknown>,
  jump$: Observable<unknown>,
): Observable<number> {
  const action$: Observable<UnreadAction> = merge(
    message$.pipe(
      filter((message) => !message.own && !isNearBottom()),
      map((): UnreadAction => 'add'),
    ),
    scroll$.pipe(
      filter(() => isNearBottom()),
      map((): UnreadAction => 'reset'),
    ),
    jump$.pipe(map((): UnreadAction => 'reset')),
  );

  return action$.pipe(
    scan((count, action) => (action === 'add' ? count + 1 : 0), 0),
    startWith(0),
    distinctUntilChanged(),
  );
}
