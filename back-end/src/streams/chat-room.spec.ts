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
const keystroke: ClientEvent = { type: 'typing' };
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

  describe('typing indicator', () => {
    it('relays typing to the other clients, never back to the typist (FR-11, FR-13)', () => {
      scheduler.run(({ hot, cold, expectObservable }) => {
        const ana = fakeClient(hot('-a---t----', { a: join('Ana'), t: keystroke }));
        const bruno = fakeClient(hot('--a-------', { a: join('Bruno') }));
        const carla = fakeClient(hot('---a------', { a: join('Carla') }));

        expectObservable(ana.sent$).toBe('-a--------', { a: joined('Ana') });
        expectObservable(bruno.sent$).toBe('--a--t----', { a: joined('Bruno'), t: typing('Ana') });
        expectObservable(carla.sent$).toBe('---a-t----', { a: joined('Carla'), t: typing('Ana') });
        expectObservable(chatRoom(cold('(abc)', { a: ana.client, b: bruno.client, c: carla.client })));
      });
    });

    it('relays at most one typing event per 500 ms per user (FR-10)', () => {
      scheduler.run(({ hot, cold, expectObservable }) => {
        // Ana floods: t at 11, 12, 13, 301, 512. Only 11 and 512 get through.
        const ana = fakeClient(hot('-a 9ms ttt 287ms t 210ms t', { a: join('Ana'), t: keystroke }));
        // Bruno's own throttle window is independent of Ana's.
        const bruno = fakeClient(hot('-a 10ms t', { a: join('Bruno'), t: keystroke }));

        expectObservable(bruno.sent$).toBe('-a 9ms t 500ms t', { a: joined('Bruno'), t: typing('Ana') });
        expectObservable(ana.sent$).toBe('-a 10ms t', { a: joined('Ana'), t: typing('Bruno') });
        expectObservable(chatRoom(cold('(ab)', { a: ana.client, b: bruno.client })));
      });
    });

    it('ignores typing before join', () => {
      scheduler.run(({ hot, cold, expectObservable }) => {
        const ana = fakeClient(hot('-t-a-----', { t: keystroke, a: join('Ana') }));
        const bruno = fakeClient(hot('-a-------', { a: join('Bruno') }));

        expectObservable(bruno.sent$).toBe('-a-------', { a: joined('Bruno') });
        expectObservable(chatRoom(cold('(ab)', { a: ana.client, b: bruno.client })));
      });
    });

    it('keeps typing and messages in server order', () => {
      scheduler.run(({ hot, cold, expectObservable }) => {
        const ana = fakeClient(hot('-a-t-m---', { a: join('Ana'), t: keystroke, m: say('oi') }));
        const bruno = fakeClient(hot('-a-------', { a: join('Bruno') }));

        expectObservable(bruno.sent$).toBe('-a-t-m---', {
          a: joined('Bruno'),
          t: typing('Ana'),
          m: heard('Ana', 'oi'),
        });
        expectObservable(chatRoom(cold('(ab)', { a: ana.client, b: bruno.client })));
      });
    });
  });
});
