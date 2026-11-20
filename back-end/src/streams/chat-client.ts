import type { Observable } from 'rxjs';
import type { ClientEvent, ServerEvent } from '../domain/events.js';

/**
 * One connected client, as the room sees it. Transport-agnostic, so the room
 * can be driven by real `ws` sockets (see `socket.ts`) or by marble tests.
 */
export interface ChatClient {
  /** Valid events sent by this client; invalid frames are already dropped (FR-08). */
  readonly event$: Observable<ClientEvent>;
  /** Emits once when the connection closes. */
  readonly closed$: Observable<void>;
  /** Transport errors on this connection. */
  readonly error$: Observable<Error>;
  send(event: ServerEvent): void;
}
