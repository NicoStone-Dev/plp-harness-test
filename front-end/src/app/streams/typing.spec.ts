import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ServerEvent } from '../domain/events';
import { typingNames$, typingPings$ } from './typing';

let scheduler: TestScheduler;

beforeEach(() => {
  scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
});

const joined: ServerEvent = { type: 'joined', userId: 'me', name: 'Carla' };
const typing = (userId: string, name: string): ServerEvent => ({ type: 'typing', userId, name });
const said = (authorId: string, author: string): ServerEvent => ({
  type: 'message',
  message: { id: `${authorId}-msg`, authorId, author, text: 'oi', sentAt: 0 },
});

describe('typingPings$ (FR-10)', () => {
  it('sends on the first keystroke, then at most once per 500 ms', () => {
    scheduler.run(({ cold, expectObservable }) => {
      // Keystrokes at 0, 1, 2, 300, 501, 502, 1100.
      const keystroke$ = cold('abc 297ms d 200ms ef 597ms g');
      expectObservable(typingPings$(keystroke$)).toBe('a 500ms e 598ms g', {
        a: undefined,
        e: undefined,
        g: undefined,
      });
    });
  });

  it('sends nothing while the user does not type', () => {
    scheduler.run(({ cold, expectObservable }) => {
      expectObservable(typingPings$(cold('------|'))).toBe('------|');
    });
  });
});

describe('typingNames$', () => {
  it('shows a name 2 s after the last ping, then removes it (FR-11, FR-12)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-j-b', { j: joined, b: typing('u2', 'Bruno') });
      expectObservable(typingNames$(event$)).toBe('e--b 1999ms e', { e: [], b: ['Bruno'] });
    });
  });

  it('every new ping restarts that user\'s 2 s timer (FR-12)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-j-b 999ms b', { j: joined, b: typing('u2', 'Bruno') });
      expectObservable(typingNames$(event$)).toBe('e--b 2999ms e', { e: [], b: ['Bruno'] });
    });
  });

  it('removes a name immediately when that user sends a message (FR-12)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-j-b-m 3000ms -', { j: joined, b: typing('u2', 'Bruno'), m: said('u2', 'Bruno') });
      expectObservable(typingNames$(event$)).toBe('e--b-e', { e: [], b: ['Bruno'] });
    });
  });

  it('a message from someone else does not remove a typist', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-j-b-m', { j: joined, b: typing('u2', 'Bruno'), m: said('u3', 'Ana') });
      expectObservable(typingNames$(event$, 10)).toBe('e--b 9ms e', { e: [], b: ['Bruno'] });
    });
  });

  it('lists several users in the order they started, each with its own timer (FR-11)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-j-a-b-a', { j: joined, a: typing('u1', 'Ana'), b: typing('u2', 'Bruno') });
      // ttl 10: Bruno expires at 15, Ana (re-pinged at 7) at 17.
      expectObservable(typingNames$(event$, 10)).toBe('e--a-b---------c-e', {
        e: [],
        a: ['Ana'],
        b: ['Ana', 'Bruno'],
        c: ['Ana'],
      });
    });
  });

  it('never lists the current user, even if the server echoed it (FR-13)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-j-s-b', { j: joined, s: typing('me', 'Carla'), b: typing('u2', 'Bruno') });
      expectObservable(typingNames$(event$, 10)).toBe('e----b 9ms e', { e: [], b: ['Bruno'] });
    });
  });

  it('ignores events that are neither typing nor messages (R8)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-j-b-k', { j: joined, b: typing('u2', 'Bruno'), k: { ...joined, userId: 'u9' } });
      expectObservable(typingNames$(event$, 10)).toBe('e--b 9ms e', { e: [], b: ['Bruno'] });
    });
  });

  it('ignores typing before the join is acknowledged', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-b-j-', { j: joined, b: typing('u2', 'Bruno') });
      expectObservable(typingNames$(event$, 10)).toBe('e----', { e: [] });
    });
  });
});
