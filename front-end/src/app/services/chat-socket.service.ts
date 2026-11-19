import { Injectable } from '@angular/core';
import { catchError, defer, EMPTY, filter, map, share } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';
import { parseServerEvent, type ClientEvent, type ServerEvent } from '../domain/events';
import type { ChatConnection } from '../streams/chat-connection';

export const CHAT_SERVER_URL = `ws://${location.hostname}:3000`;

@Injectable({ providedIn: 'root' })
export class ChatSocketService {
  /** Lazy: the socket opens on the first subscription to `event$`. */
  connect(name: string): ChatConnection {
    // Keep raw frames; parsing happens in the pipeline so invalid data is just dropped (FR-08).
    const socket$ = webSocket<unknown>({ url: CHAT_SERVER_URL, deserializer: ({ data }) => data });

    const event$ = defer(() => {
      // Buffered by the subject until the socket is open, so join is always the first frame.
      socket$.next({ type: 'join', name } satisfies ClientEvent);
      return socket$;
    }).pipe(
      map((raw) => (typeof raw === 'string' ? parseServerEvent(raw) : null)),
      filter((event): event is ServerEvent => event !== null),
      // A dropped connection simply ends the stream.
      catchError(() => EMPTY),
      share(),
    );

    return { event$, send: (event) => socket$.next(event) };
  }
}
