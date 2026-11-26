import { throttleTime, type Observable } from 'rxjs';
import { TYPING_THROTTLE_MS } from '../domain/events.js';

/**
 * FR-10: lets through at most one typing event per `windowMs` for one user.
 * The client already throttles; the server enforces it so a misbehaving
 * client cannot flood the room.
 */
export function throttleTyping<T>(typing$: Observable<T>, windowMs = TYPING_THROTTLE_MS): Observable<T> {
  return typing$.pipe(throttleTime(windowMs));
}
