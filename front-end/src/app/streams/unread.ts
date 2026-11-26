import { distinctUntilChanged, filter, map, merge, scan, startWith, type Observable } from 'rxjs';

type Step = 'add' | 'reset';

/**
 * FR-15 to FR-19: number of others' messages that arrived while the user was scrolled up.
 *
 * - `message$`: each new message as it arrives (before it is rendered).
 * - `isNearBottom`: measured at that moment, so it reflects where the user *was* (FR-15).
 * - `scroll$`: scroll events on the list; reaching the bottom resets to 0 (FR-18).
 * - `jump$`: clicks on the pill; resets to 0 (FR-17).
 *
 * Own messages never count (FR-19). Starts at 0 and only emits changes.
 */
export function unreadCount$(
  message$: Observable<{ readonly own: boolean }>,
  isNearBottom: () => boolean,
  scroll$: Observable<unknown>,
  jump$: Observable<unknown>,
): Observable<number> {
  const add$ = message$.pipe(
    filter((message) => !message.own && !isNearBottom()),
    map((): Step => 'add'),
  );
  const reachedBottom$ = scroll$.pipe(filter(() => isNearBottom()));
  const reset$ = merge(reachedBottom$, jump$).pipe(map((): Step => 'reset'));

  return merge(add$, reset$).pipe(
    scan((count, step) => (step === 'add' ? count + 1 : 0), 0),
    startWith(0),
    distinctUntilChanged(),
  );
}
