import { distinctUntilChanged, filter, map, merge, scan, startWith, type Observable } from 'rxjs';

type UnreadStep = 'add' | 'reset';

/**
 * FR-15 / FR-18 / FR-19: unread counter.
 * Each message from someone else that arrives while the user is away from the
 * bottom (`isAwayFromBottom()`, measured before the message is rendered) adds 1;
 * own messages never count. Every `reset$` emission (reaching the bottom, or the
 * pill being clicked) sets it back to 0. Starts at 0.
 */
export function unreadCount$(
  message$: Observable<{ readonly own: boolean }>,
  isAwayFromBottom: () => boolean,
  reset$: Observable<unknown>,
): Observable<number> {
  return merge(
    message$.pipe(
      filter((message) => !message.own && isAwayFromBottom()),
      map((): UnreadStep => 'add'),
    ),
    reset$.pipe(map((): UnreadStep => 'reset')),
  ).pipe(
    scan((count, step: UnreadStep) => (step === 'reset' ? 0 : count + 1), 0),
    startWith(0),
    distinctUntilChanged(),
  );
}
