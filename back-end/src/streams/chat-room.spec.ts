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
const typing: ClientEvent = { type: 'typing' };
const typingOf = (name: string): ServerEvent => ({ type: 'typing', userId: expect.any(String), name });
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
    it('relays typing to the other clients but never back to the typist (FR-11, FR-13)', () => {
      scheduler.run(({ hot, cold, expectObservable }) => {
        const ana = fakeClient(hot('-a---t-', { a: join('Ana'), t: typing }));
        const bruno = fakeClient(hot('--a----', { a: join('Bruno') }));
        const carla = fakeClient(hot('---a---', { a: join('Carla') }));

        expectObservable(ana.sent$).toBe('-a-----', { a: joined('Ana') });
        expectObservable(bruno.sent$).toBe('--a--t-', { a: joined('Bruno'), t: typingOf('Ana') });
        expectObservable(carla.sent$).toBe('---a-t-', { a: joined('Carla'), t: typingOf('Ana') });
        expectObservable(chatRoom(cold('(abc)', { a: ana.client, b: bruno.client, c: carla.client })));
      });
    });

    it('relays at most one typing event per 500 ms per user (FR-10)', () => {
      scheduler.run(({ hot, cold, expectObservable }) => {
        // Ana types at 2, 3, 300 (all in one window) and 503 (next window).
        const ana = fakeClient(hot('-att 296ms t 202ms t', { a: join('Ana'), t: typing }));
        // Bruno's typing is throttled separately from Ana's.
        const bruno = fakeClient(hot('-a--t', { a: join('Bruno'), t: typing }));

        expectObservable(bruno.sent$).toBe('-at 500ms t', { a: joined('Bruno'), t: typingOf('Ana') });
        expectObservable(ana.sent$).toBe('-a--t', { a: joined('Ana'), t: typingOf('Bruno') });
        expectObservable(chatRoom(cold('(ab)', { a: ana.client, b: bruno.client })));
      });
    });

    it('ignores typing before join, and typing carries the joined name (FR-11)', () => {
      scheduler.run(({ hot, cold, expectObservable }) => {
        const ana = fakeClient(hot('-t-a-t-', { t: typing, a: join('Ana') }));
        const bruno = fakeClient(hot('-a-----', { a: join('Bruno') }));

        expectObservable(bruno.sent$).toBe('-a---t-', { a: joined('Bruno'), t: typingOf('Ana') });
        expectObservable(chatRoom(cold('(ab)', { a: ana.client, b: bruno.client })));
      });
    });

    it('a message is still delivered right after a typing ping (FR-12 relies on it)', () => {
      scheduler.run(({ hot, cold, expectObservable }) => {
        const ana = fakeClient(hot('-a-tm-', { a: join('Ana'), t: typing, m: say('oi') }));
        const bruno = fakeClient(hot('-a----', { a: join('Bruno') }));

        expectObservable(bruno.sent$).toBe('-a-tm-', {
          a: joined('Bruno'),
          t: typingOf('Ana'),
          m: heard('Ana', 'oi'),
        });
        expectObservable(chatRoom(cold('(ab)', { a: ana.client, b: bruno.client })));
      });
    });
  });
});
