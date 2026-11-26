import { throttleTime, type Observable } from 'rxjs';

/** FR-10: at most one typing event per user every 500 ms. */
export const TYPING_THROTTLE_MS = 500;

/**
 * Lets through the first typing ping, then drops the rest for `windowMs`.
 * Applied per client on the server, so a misbehaving client cannot flood the room
 * even if it ignores the client-side throttle.
 */
export function throttleTyping<T>(typing$: Observable<T>, windowMs = TYPING_THROTTLE_MS): Observable<T> {
  return typing$.pipe(throttleTime(windowMs));
}
