import { NEVER, type Observable } from 'rxjs';
import type { TestScheduler } from 'rxjs/testing';
import type { ClientEvent, ServerEvent } from '../src/domain/events.js';
import type { ChatClient } from '../src/streams/chat-client.js';

/** What a fake client received, stamped with the virtual time. */
export interface Received {
  readonly at: number;
  readonly event: ServerEvent;
}

export interface FakeClient extends ChatClient {
  readonly received: Received[];
}

/** A ChatClient driven by marble diagrams; records everything the room sends it. */
export function fakeClient(
  scheduler: TestScheduler,
  event$: Observable<ClientEvent>,
  closed$: Observable<void> = NEVER,
): FakeClient {
  const received: Received[] = [];
  return {
    event$,
    closed$,
    error$: NEVER,
    received,
    send: (event) => received.push({ at: scheduler.now(), event }),
  };
}

export const join = (name: string): ClientEvent => ({ type: 'join', name });
export const say = (text: string): ClientEvent => ({ type: 'message', text });
export const typing: ClientEvent = { type: 'typing' };

/** Only the typing notices a client received, as `name@time`. */
export function typingSeen(client: FakeClient): string[] {
  return client.received.flatMap(({ at, event }) => (event.type === 'typing' ? [`${event.name}@${at}`] : []));
}
