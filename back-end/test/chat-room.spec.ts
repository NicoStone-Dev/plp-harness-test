import { NEVER, of, type Observable } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ClientEvent, ServerEvent } from '../src/domain/events.js';
import type { ChatClient } from '../src/streams/chat-client.js';
import { chatRoom } from '../src/streams/chat-room.js';

/** A fake client that records every event the room sends it, with the virtual time. */
interface FakeClient extends ChatClient {
  readonly received: { readonly at: number; readonly event: ServerEvent }[];
}

describe('chatRoom', () => {
  let scheduler: TestScheduler;

  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
  });

  function fakeClient(event$: Observable<ClientEvent>, closed$: Observable<void> = NEVER): FakeClient {
    const received: FakeClient['received'] = [];
    return {
      event$,
      closed$,
      error$: NEVER,
      send: (event) => received.push({ at: scheduler.now(), event }),
      received,
    };
  }

  const join = (name: string): ClientEvent => ({ type: 'join', name });
  const say = (text: string): ClientEvent => ({ type: 'message', text });
  const typing: ClientEvent = { type: 'typing' };

  /** Runs a room with the given clients until the virtual clock stops. */
  function run(build: (hot: (marbles: string, values?: Record<string, ClientEvent>) => Observable<ClientEvent>) => FakeClient[]) {
    let clients: FakeClient[] = [];
    scheduler.run(({ hot, expectObservable }) => {
      clients = build((marbles, values) => hot(marbles, values));
      expectObservable(chatRoom(of(...clients))).toBe('');
    });
    return clients;
  }

  const typingNotices = (client: FakeClient) =>
    client.received
      .filter(({ event }) => event.type === 'typing')
      .map(({ at, event }) => ({ at, name: event.type === 'typing' ? event.name : '' }));

  it('FR-11 / FR-13: relays a typing notice to the other users, never to the typist', () => {
    const [ana, bruno, carla] = run((hot) => [
      fakeClient(hot('j 9ms t', { j: join('Ana'), t: typing })),
      fakeClient(hot('j', { j: join('Bruno') })),
      fakeClient(hot('j', { j: join('Carla') })),
    ]);

    expect(typingNotices(ana!)).toEqual([]);
    expect(typingNotices(bruno!)).toEqual([{ at: 10, name: 'Ana' }]);
    expect(typingNotices(carla!)).toEqual([{ at: 10, name: 'Ana' }]);

    // The notice carries the typist's id, the same id their messages carry.
    const notice = bruno!.received.find(({ event }) => event.type === 'typing')!.event;
    const anaJoined = ana!.received.find(({ event }) => event.type === 'joined')!.event;
    expect(notice).toEqual({ type: 'typing', userId: anaJoined.type === 'joined' ? anaJoined.userId : '', name: 'Ana' });
  });

  it('FR-10: relays at most one typing notice per 500 ms per user', () => {
    const [, bruno] = run((hot) => [
      fakeClient(hot('j t 99ms t 99ms t 99ms t 99ms t 99ms t 99ms t', { j: join('Ana'), t: typing })),
      fakeClient(hot('j', { j: join('Bruno') })),
    ]);

    // keystrokes every 100 ms from 1 to 601 ms -> relayed at 1 and 601 ms
    expect(typingNotices(bruno!)).toEqual([
      { at: 1, name: 'Ana' },
      { at: 601, name: 'Ana' },
    ]);
  });

  it('FR-10: throttles each user separately', () => {
    const [, , carla] = run((hot) => [
      fakeClient(hot('j t 99ms t', { j: join('Ana'), t: typing })),
      fakeClient(hot('j - 49ms t', { j: join('Bruno'), t: typing })),
      fakeClient(hot('j', { j: join('Carla') })),
    ]);

    expect(typingNotices(carla!)).toEqual([
      { at: 1, name: 'Ana' },
      { at: 51, name: 'Bruno' },
    ]);
  });

  it('FR-12: after a message, the next keystroke is relayed at once', () => {
    const [, bruno] = run((hot) => [
      fakeClient(hot('j t 99ms m 99ms t', { j: join('Ana'), t: typing, m: say('oi') })),
      fakeClient(hot('j', { j: join('Bruno') })),
    ]);

    expect(typingNotices(bruno!)).toEqual([
      { at: 1, name: 'Ana' },
      { at: 201, name: 'Ana' },
    ]);
    // The message itself is delivered between the two notices; it is what clears the indicator.
    expect(bruno!.received.map(({ event }) => event.type)).toEqual(['joined', 'typing', 'message', 'typing']);
  });

  it('FR-08: ignores typing before join', () => {
    const [, bruno] = run((hot) => [
      fakeClient(hot('t 9ms j 9ms t', { j: join('Ana'), t: typing })),
      fakeClient(hot('j', { j: join('Bruno') })),
    ]);

    expect(typingNotices(bruno!)).toEqual([{ at: 20, name: 'Ana' }]);
  });

  it('stops relaying typing from a client that disconnected', () => {
    const [, bruno] = run((hot) => [
      fakeClient(hot('j t 999ms t', { j: join('Ana'), t: typing }), hot('-- 99ms c', { c: undefined })),
      fakeClient(hot('j', { j: join('Bruno') })),
    ]);

    expect(typingNotices(bruno!)).toEqual([{ at: 1, name: 'Ana' }]);
  });

  it('FR-03 / FR-07: messages still reach every joined user in order, without history', () => {
    const [ana, bruno, carla] = run((hot) => [
      fakeClient(hot('j 9ms a 9ms c', { j: join('Ana'), a: say('primeira'), c: say('terceira') })),
      fakeClient(hot('j 14ms b', { j: join('Bruno'), b: say('segunda') })),
      fakeClient(hot('- 11ms j', { j: join('Carla') })),
    ]);

    const texts = (client: FakeClient) =>
      client.received.flatMap(({ event }) => (event.type === 'message' ? [event.message.text] : []));

    expect(texts(ana!)).toEqual(['primeira', 'segunda', 'terceira']);
    expect(texts(bruno!)).toEqual(['primeira', 'segunda', 'terceira']);
    expect(texts(carla!)).toEqual(['segunda', 'terceira']);
  });
});
