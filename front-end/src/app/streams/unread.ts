import { distinctUntilChanged, filter, map, merge, type Observable, scan, startWith } from 'rxjs';

const RESET = 'reset';
const INCREMENT = 'increment';

/**
 * FR-15 / FR-17 / FR-18 / FR-19: number of messages from others that arrived while
 * the user was scrolled up.
 *
 * @param message$      each new message, emitted *before* it is rendered
 * @param wasNearBottom measured on each message, before it is rendered
 * @param reset$        the user is back at the bottom (scrolled there, or clicked the pill)
 */
export function unreadCount$(
  message$: Observable<{ readonly own: boolean }>,
  wasNearBottom: () => boolean,
  reset$: Observable<unknown>,
): Observable<number> {
  return merge(
    message$.pipe(
      // FR-19: own messages never count; FR-15: only while scrolled up.
      filter((message) => !message.own && !wasNearBottom()),
      map(() => INCREMENT),
    ),
    reset$.pipe(map(() => RESET)),
  ).pipe(
    scan((count, step) => (step === RESET ? 0 : count + 1), 0),
    startWith(0),
    distinctUntilChanged(),
  );
}

/** FR-16: "1 nova mensagem" / "N novas mensagens". */
export function unreadLabel(count: number): string {
  return count === 1 ? '1 nova mensagem' : `${count} novas mensagens`;
}
