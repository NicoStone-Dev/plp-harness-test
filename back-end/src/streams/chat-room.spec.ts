import { NEVER, Subject, throwError, type Observable } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientEvent, ServerEvent } from '../domain/events.js';
import type { ChatClient } from './chat-client.js';
import { chatRoom } from './chat-room.js';

let scheduler: TestScheduler;

beforeEach(() => {
  // toEqual lets expected values use asymmetric matchers (ids and times are generated).
  scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
});

const join = (name: string): ClientEvent => ({ type: 'join', name });
const say = (text: string): ClientEvent => ({ type: 'message', text });
const type: ClientEvent = { type: 'typing' };
const typing = (name: string): ServerEvent => ({ type: 'typing', userId: expect.any(String), name });
const joined = (name: string): ServerEvent => ({ type: 'joined', userId: expect.any(String), name });
const heard = (author: string, text: string): ServerEvent => ({
  type: 'message',
  message: {
    id: expect.any(String),
    authorId: expect.any(String),
    author,
    text,
    sentAt: expect.any(Number),
  },
});

/** A fake client whose outbound frames become a hot observable we can marble-assert. */
function fakeClient(
  event$: Observable<ClientEvent>,
  closed$: Observable<void> = NEVER,
  error$: Observable<Error> = NEVER,
): { client: ChatClient; sent$: Observable<ServerEvent> } {
  const outbox$ = new Subject<ServerEvent>();
  return {
    client: { event$, closed$, error$, send: (event) => outbox$.next(event) },
    sent$: outbox$.asObservable(),
  };
}

describe('chatRoom', () => {
  it('acks the join and broadcasts every message to every joined client in order (FR-03)', () => {
    scheduler.run(({ hot, cold, expectObservable }) => {
      const ana = fakeClient(hot('-a--b-----', { a: join('Ana'), b: say('oi') }));
      const bruno = fakeClient(hot('--a----b--', { a: join('Bruno'), b: say('olá') }));

      expectObservable(ana.sent$).toBe('-a--b--c--', {
        a: joined('Ana'),
        b: heard('Ana', 'oi'),
        c: heard('Bruno', 'olá'),
      });
      expectObservable(bruno.sent$).toBe('--a-b--c--', {
        a: joined('Bruno'),
        b: heard('Ana', 'oi'),
        c: heard('Bruno', 'olá'),
      });
      expectObservable(chatRoom(cold('(ab)', { a: ana.client, b: bruno.client }))).toBe('----------');
    });
  });

  it('sends no history to late joiners (FR-07)', () => {
    scheduler.run(({ hot, cold, expectObservable }) => {
      const ana = fakeClient(hot('-a-b---c-', { a: join('Ana'), b: say('1'), c: say('2') }));
      const carla = fakeClient(hot('-----a---', { a: join('Carla') }));

      expectObservable(carla.sent$).toBe('-----a-b-', { a: joined('Carla'), b: heard('Ana', '2') });
      expectObservable(chatRoom(cold('(ab)', { a: ana.client, b: carla.client })));
    });
  });

  it('ignores messages before join and repeated joins', () => {
    scheduler.run(({ hot, cold, expectObservable }) => {
      const ana = fakeClient(
        hot('-a-b-c-d-', { a: say('early'), b: join('Ana'), c: join('Eve'), d: say('ok') }),
      );

      expectObservable(ana.sent$).toBe('---a---b-', { a: joined('Ana'), b: heard('Ana', 'ok') });
      expectObservable(chatRoom(cold('a', { a: ana.client })));
    });
  });

  it('stops serving a client once it closes', () => {
    scheduler.run(({ hot, cold, expectObservable }) => {
      const ana = fakeClient(hot('-a---b-', { a: join('Ana'), b: say('later') }));
      const bruno = fakeClient(hot('-a-b---', { a: join('Bruno'), b: say('bye') }), hot('----c'));

      expectObservable(bruno.sent$).toBe('-a-b---', { a: joined('Bruno'), b: heard('Bruno', 'bye') });
      expectObservable(ana.sent$).toBe('-a-b-c-', {
        a: joined('Ana'),
        b: heard('Bruno', 'bye'),
        c: heard('Ana', 'later'),
      });
      expectObservable(chatRoom(cold('(ab)', { a: ana.client, b: bruno.client })));
    });
  });

  it('survives a client whose stream errors; other clients keep chatting (R8, FR-08)', () => {
    scheduler.run(({ hot, cold, expectObservable }) => {
      const broken = fakeClient(cold('a-#', { a: join('Mallory') }, new Error('boom')));
      const ana = fakeClient(hot('-a---b-', { a: join('Ana'), b: say('still here') }));

      expectObservable(ana.sent$).toBe('-a---b-', { a: joined('Ana'), b: heard('Ana', 'still here') });
      // The room itself never errors or completes.
      expectObservable(chatRoom(cold('(ab)', { a: broken.client, b: ana.client }))).toBe('------');
    });
  });

  it('consumes socket errors without ending the session (FR-08)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    scheduler.run(({ hot, cold, expectObservable }) => {
      const ana = fakeClient(
        hot('-a---b-', { a: join('Ana'), b: say('ok') }),
        NEVER,
        hot('---e---', { e: new Error('bad frame') }),
      );

      expectObservable(ana.sent$).toBe('-a---b-', { a: joined('Ana'), b: heard('Ana', 'ok') });
      expectObservable(chatRoom(cold('a', { a: ana.client })));
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('bad frame'));
    warn.mockRestore();
  });

  it('a client error stream that errors is contained too (R8)', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const broken = fakeClient(NEVER, NEVER, throwError(() => new Error('x')));
      expectObservable(chatRoom(cold('a', { a: broken.client }))).toBe('---');
    });
  });

  it('relays typing to the other joined users, never back to the typer (FR-11, FR-13)', () => {
    scheduler.run(({ hot, cold, expectObservable }) => {
      const ana = fakeClient(hot('-a--t-----', { a: join('Ana'), t: type }));
      const bruno = fakeClient(hot('--a----t--', { a: join('Bruno'), t: type }));
      const carla = fakeClient(hot('---a------', { a: join('Carla') }));

      expectObservable(ana.sent$).toBe('-a-----b--', { a: joined('Ana'), b: typing('Bruno') });
      expectObservable(bruno.sent$).toBe('--a-b-----', { a: joined('Bruno'), b: typing('Ana') });
      expectObservable(carla.sent$).toBe('---ab--c--', {
        a: joined('Carla'),
        b: typing('Ana'),
        c: typing('Bruno'),
      });
      expectObservable(chatRoom(cold('(abc)', { a: ana.client, b: bruno.client, c: carla.client })));
    });
  });

  it('relays at most one typing event per user per 500 ms (FR-10)', () => {
    scheduler.run(({ hot, cold, expectObservable }) => {
      // Ana types at 3, 4, 5, 302 and 602 ms: only 3 and 602 get through.
      const ana = fakeClient(hot('-a-ttt 296ms t 299ms t', { a: join('Ana'), t: type }));
      const bruno = fakeClient(hot('-a', { a: join('Bruno') }));

      expectObservable(bruno.sent$).toBe('-a-b 598ms b', { a: joined('Bruno'), b: typing('Ana') });
      expectObservable(chatRoom(cold('(ab)', { a: ana.client, b: bruno.client })));
    });
  });

  it('throttles each user separately (FR-10)', () => {
    scheduler.run(({ hot, cold, expectObservable }) => {
      // Ana at 3 and 5 (5 is throttled), Bruno at 4: Bruno is not throttled by Ana.
      const ana = fakeClient(hot('-a-t-t', { a: join('Ana'), t: type }));
      const bruno = fakeClient(hot('-a--t-', { a: join('Bruno'), t: type }));
      const carla = fakeClient(hot('-a----', { a: join('Carla') }));

      expectObservable(carla.sent$).toBe('-a-bc-', { a: joined('Carla'), b: typing('Ana'), c: typing('Bruno') });
      expectObservable(chatRoom(cold('(abc)', { a: ana.client, b: bruno.client, c: carla.client })));
    });
  });

  it('ignores typing before join (FR-11)', () => {
    scheduler.run(({ hot, cold, expectObservable }) => {
      const ana = fakeClient(hot('-t-a----', { a: join('Ana'), t: type }));
      const bruno = fakeClient(hot('-a------', { a: join('Bruno') }));

      expectObservable(bruno.sent$).toBe('-a------', { a: joined('Bruno') });
      expectObservable(chatRoom(cold('(ab)', { a: ana.client, b: bruno.client })));
    });
  });

  it('still delivers own messages to the sender after typing (FR-03, FR-12)', () => {
    scheduler.run(({ hot, cold, expectObservable }) => {
      const ana = fakeClient(hot('-a-t-m-', { a: join('Ana'), t: type, m: say('oi') }));
      const bruno = fakeClient(hot('-a-----', { a: join('Bruno') }));

      expectObservable(ana.sent$).toBe('-a---b-', { a: joined('Ana'), b: heard('Ana', 'oi') });
      expectObservable(bruno.sent$).toBe('-a-b-c-', { a: joined('Bruno'), b: typing('Ana'), c: heard('Ana', 'oi') });
      expectObservable(chatRoom(cold('(ab)', { a: ana.client, b: bruno.client })));
    });
  });
});
