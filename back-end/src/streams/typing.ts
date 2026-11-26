import { repeat, takeUntil, throttleTime, type Observable } from 'rxjs';

/** FR-10: a user's typing events are relayed at most once per this many ms. */
export const TYPING_THROTTLE_MS = 500;

/**
 * FR-10: lets through at most one typing event per `TYPING_THROTTLE_MS` for one user.
 * A sent message (`reset$`) restarts the window, so typing right after sending
 * is relayed at once instead of being swallowed by the previous window.
 */
export function throttleTyping<T>(typing$: Observable<T>, reset$: Observable<unknown>): Observable<T> {
  return typing$.pipe(
    throttleTime(TYPING_THROTTLE_MS, undefined, { leading: true, trailing: false }),
    takeUntil(reset$),
    repeat(),
  );
}
