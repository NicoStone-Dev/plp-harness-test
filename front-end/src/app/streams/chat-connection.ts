import type { Observable } from 'rxjs';
import type { ClientEvent, ServerEvent } from '../domain/events';

/**
 * A WebSocket to the chat server, already joined under a name.
 * Defined in streams/ and implemented by ChatSocketService.
 */
export interface ChatConnection {
  /** Valid server events. Hot and shared; the socket stays open while anyone subscribes. */
  readonly event$: Observable<ServerEvent>;
  send(event: ClientEvent): void;
}
