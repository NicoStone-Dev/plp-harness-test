import { filter, map, merge, type Observable, scan, startWith, distinctUntilChanged } from 'rxjs';
import type { MessageView } from '../domain/message-view';

/**
 * The unread counter (FR-15–19).
 *
 * - `message$`: every incoming message, emitted *before* it is rendered.
 * - `scrolledUp`: whether the list is currently more than 40 px from the bottom.
 * - `reset$`: the user reached the bottom (by scrolling, FR-18, or with the pill, FR-17).
 */
export function unreadCount(
  message$: Observable<MessageView>,
  scrolledUp: () => boolean,
  reset$: Observable<unknown>,
): Observable<number> {
  const unseen$ = message$.pipe(
    // FR-19: own messages never count. FR-15: only while scrolled up.
    filter((message) => !message.own && scrolledUp()),
    map(() => (count: number) => count + 1),
  );
  const cleared$ = reset$.pipe(map(() => (_count: number) => 0));

  return merge(unseen$, cleared$).pipe(
    scan((count, update) => update(count), 0),
    startWith(0),
    distinctUntilChanged(),
  );
}
