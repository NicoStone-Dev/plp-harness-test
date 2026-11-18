import type { EventEmitter } from 'node:events';
import { filter, Observable, take } from 'rxjs';
import type { RawData, WebSocket, WebSocketServer } from 'ws';
import { parseClientEvent, type ClientEvent } from '../domain/events.js';

/**
 * Node-style listener (`on`/`off`) as an Observable.
 * RxJS `fromEvent` is not used because `ws` sockets also expose the DOM-style
 * `addEventListener`, which `fromEvent` prefers and which wraps the arguments.
 */
export function fromEmitter<A extends unknown[], R>(
  emitter: EventEmitter,
  event: string,
  project: (...args: A) => R,
): Observable<R> {
  return new Observable<R>((subscriber) => {
    const handler = (...args: A) => subscriber.next(project(...args));
    emitter.on(event, handler as (...args: unknown[]) => void);
    return () => emitter.off(event, handler as (...args: unknown[]) => void);
  });
}

/** Every client that connects to the server. */
export function connection$(server: WebSocketServer): Observable<WebSocket> {
  return fromEmitter(server, 'connection', (socket: WebSocket) => socket);
}

/** Valid events sent by one client. Binary frames and invalid data are dropped (FR-08). */
export function clientEvent$(socket: WebSocket): Observable<ClientEvent> {
  return fromEmitter(socket, 'message', (data: RawData, isBinary: boolean) =>
    isBinary ? null : parseClientEvent(rawDataToText(data)),
  ).pipe(filter((event): event is ClientEvent => event !== null));
}

/** Emits once when the socket closes. */
export function closed$(socket: WebSocket): Observable<void> {
  return fromEmitter(socket, 'close', () => undefined).pipe(take(1));
}

/** Protocol errors on one socket (bad frames, oversized payloads, ...). */
export function socketError$(socket: WebSocket): Observable<Error> {
  return fromEmitter(socket, 'error', (error: Error) => error);
}

function rawDataToText(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return data.toString('utf8');
}
