import { TestScheduler } from 'rxjs/testing';
import type { ChatMessage, ServerEvent } from '../domain/events';
import { typingSignal$, typists$ } from './typing';

let scheduler: TestScheduler;

beforeEach(() => {
  scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
});

const typing = (userId: string, name: string): ServerEvent => ({ type: 'typing', userId, name });
const message = (authorId: string, author: string): ServerEvent => ({
  type: 'message',
  message: { id: `${authorId}-m`, authorId, author, text: 'oi', sentAt: 0 } satisfies ChatMessage,
});

describe('typingSignal$ (FR-10)', () => {
  it('FR-10: the first keystroke is sent immediately', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const key$ = hot('  k');
      const sent$ = hot(' -');
      expectObservable(typingSignal$(key$, sent$, scheduler)).toBe('x', { x: undefined });
    });
  });

  it('FR-10: continuous typing sends at most one event per 500 ms', () => {
    scheduler.run(({ hot, expectObservable }) => {
      // A keystroke every 100 ms from t=0 to t=1000.
      const key$ = hot('k' + ' 99ms k'.repeat(10));
      const sent$ = hot('-');
      // leading at 0, then one per 500 ms window (trailing keeps the last keystroke).
      expectObservable(typingSignal$(key$, sent$, scheduler)).toBe('x 499ms x 499ms x', {
        x: undefined,
      });
    });
  });

  it('FR-10 / FR-12: the last keystroke of a burst is reported at the end of the window', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const key$ = hot('k 199ms k');
      const sent$ = hot('-');
      expectObservable(typingSignal$(key$, sent$, scheduler)).toBe('x 499ms x', { x: undefined });
    });
  });

  it('FR-12: a pending typing event is dropped when the message is sent first', () => {
    scheduler.run(({ hot, expectObservable }) => {
      // Type at 0 and 200, press Enter at 300: the trailing event due at 500 must not go out.
      const key$ = hot('k 199ms k');
      const sent$ = hot('300ms s');
      expectObservable(typingSignal$(key$, sent$, scheduler)).toBe('x', { x: undefined });
    });
  });

  it('FR-10: typing again after sending still reports typing', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const key$ = hot('k 199ms k 199ms k');
      const sent$ = hot('300ms s');
      // keystroke at 400 is after the send, so the trailing event at 500 is kept.
      expectObservable(typingSignal$(key$, sent$, scheduler)).toBe('x 499ms x', { x: undefined });
    });
  });
});

describe('typists$ (FR-11 to FR-13)', () => {
  it('FR-11: lists other users typing, in the order they started', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-a-b-a', { a: typing('a', 'Ana'), b: typing('b', 'Bruno') });
      expectObservable(typists$(event$, 'me', scheduler), '^ 10ms !').toBe('xa-b', {
        x: [],
        a: ['Ana'],
        b: ['Ana', 'Bruno'],
      });
    });
  });

  it('FR-12: a name disappears 2 s after that user’s last typing event', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-a 999ms a', { a: typing('a', 'Ana') });
      // Typed at 1, refreshed at 1001, so it goes away at 3001, not 2001.
      expectObservable(typists$(event$, 'me', scheduler)).toBe('xa 2999ms x', {
        a: ['Ana'],
        x: [],
      });
    });
  });

  it('FR-12: a name disappears immediately when that user sends a message', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-a-b-m', {
        a: typing('a', 'Ana'),
        b: typing('b', 'Bruno'),
        m: message('a', 'Ana'),
      });
      expectObservable(typists$(event$, 'me', scheduler), '^ 10ms !').toBe('ea-b-x', {
        e: [],
        a: ['Ana'],
        b: ['Ana', 'Bruno'],
        x: ['Bruno'],
      });
    });
  });

  it('FR-12: a message from someone else does not clear the typist', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-a-m', { a: typing('a', 'Ana'), m: message('b', 'Bruno') });
      expectObservable(typists$(event$, 'me', scheduler), '^ 10ms !').toBe('ea', {
        e: [],
        a: ['Ana'],
      });
    });
  });

  it('FR-13: the user never sees their own name', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-s-a', { s: typing('me', 'Carla'), a: typing('a', 'Ana') });
      expectObservable(typists$(event$, 'me', scheduler), '^ 10ms !').toBe('x--a', {
        x: [],
        a: ['Ana'],
      });
    });
  });

  it('FR-11: three typists, then each times out independently', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-a 99ms b 99ms c', {
        a: typing('a', 'Ana'),
        b: typing('b', 'Bruno'),
        c: typing('c', 'Carla'),
      });
      expectObservable(typists$(event$, 'me', scheduler)).toBe(
        'za 99ms b 99ms c 1799ms x 99ms y 99ms z',
        {
          a: ['Ana'],
          b: ['Ana', 'Bruno'],
          c: ['Ana', 'Bruno', 'Carla'],
          x: ['Bruno', 'Carla'],
          y: ['Carla'],
          z: [],
        },
      );
    });
  });

  it('keeps two users with the same name apart (by user id)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-a-b-m', {
        a: typing('a1', 'Ana'),
        b: typing('a2', 'Ana'),
        m: message('a1', 'Ana'),
      });
      expectObservable(typists$(event$, 'me', scheduler), '^ 10ms !').toBe('ea-b-x', {
        e: [],
        a: ['Ana'],
        b: ['Ana', 'Ana'],
        x: ['Ana'],
      });
    });
  });
});
