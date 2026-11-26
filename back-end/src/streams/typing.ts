import { throttleTime, type Observable } from 'rxjs';

/** FR-10: at most one typing event per user every 500 ms. */
export const TYPING_THROTTLE_MS = 500;

/**
 * Server-side guard for FR-10: a client may send typing events as often as it
 * likes, but the room relays at most one per `windowMs` for that client.
 */
export function throttleTyping<T>(typing$: Observable<T>, windowMs = TYPING_THROTTLE_MS): Observable<T> {
  return typing$.pipe(throttleTime(windowMs));
}
