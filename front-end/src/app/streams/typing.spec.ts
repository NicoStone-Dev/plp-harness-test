import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChatMessage, ServerEvent } from '../domain/events';
import { activeTypers$, TYPING_IDLE_MS, TYPING_THROTTLE_MS, typingNames$, typingPings$ } from './typing';

let scheduler: TestScheduler;

beforeEach(() => {
  scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
});

const typing = (userId: string, name: string): ServerEvent => ({ type: 'typing', userId, name });
const said = (authorId: string, author: string): ServerEvent => ({
  type: 'message',
  message: { id: `${authorId}-m`, authorId, author, text: 'oi', sentAt: 0 } satisfies ChatMessage,
});
const ana = typing('a', 'Ana');
const bruno = typing('b', 'Bruno');
const carla = typing('c', 'Carla');

describe('typingPings$ (FR-10)', () => {
  it('uses a 500 ms window', () => {
    expect(TYPING_THROTTLE_MS).toBe(500);
  });

  it('sends at most one ping per 500 ms while the user keeps typing', () => {
    scheduler.run(({ cold, expectObservable }) => {
      // Keystrokes at 0, 1, 2, 300, 499 (one window), 501 (new window), 1200 (new window).
      const keystroke$ = cold('kkk 297ms k 198ms k 1ms k 698ms k');
      expectObservable(typingPings$(keystroke$)).toBe('p 500ms p 698ms p', { p: undefined });
    });
  });

  it('sends nothing without keystrokes', () => {
    scheduler.run(({ cold, expectObservable }) => {
      expectObservable(typingPings$(cold('-----|'))).toBe('-----|');
    });
  });
});

describe('activeTypers$', () => {
  it('uses a 2 s idle timeout', () => {
    expect(TYPING_IDLE_MS).toBe(2000);
  });

  it('shows a user while typing and drops them 2 s after the last keystroke (FR-11, FR-12)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      // Ana types at 1 and 501; her name goes away 2000 ms after 501.
      const event$ = hot('-a 499ms a', { a: ana });
      expectObservable(activeTypers$(event$, 'me')).toBe('ea 1999ms - 499ms e', { e: [], a: ['Ana'] });
    });
  });

  it('drops a user immediately when their message arrives (FR-12)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-a--m--', { a: ana, m: said('a', 'Ana') });
      expectObservable(activeTypers$(event$, 'me')).toBe('ea--e--', { e: [], a: ['Ana'] });
    });
  });

  it('a message from someone not typing changes nothing', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-a--m--', { a: ana, m: said('b', 'Bruno') });
      // Only Ana's own 2 s timeout (at 2001) removes her.
      expectObservable(activeTypers$(event$, 'me')).toBe('ea 1999ms e', { e: [], a: ['Ana'] });
    });
  });

  it('lists several typists in the order they started, each with their own timer (FR-11, FR-12)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      // Ana at 1, Bruno at 2, Carla at 3, Ana again at 4 (keeps her place).
      const event$ = hot('-abca', { a: ana, b: bruno, c: carla });
      expectObservable(activeTypers$(event$, 'me')).toBe('eabc 1998ms dfe', {
        e: [],
        a: ['Ana'],
        b: ['Ana', 'Bruno'],
        c: ['Ana', 'Bruno', 'Carla'],
        // Bruno times out at 2002, Carla at 2003; Ana's timer restarted at 4 -> 2004.
        d: ['Ana', 'Carla'],
        f: ['Ana'],
      });
    });
  });

  it('ignores events that are neither typing nor messages', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot<ServerEvent>('-j-a-', { j: { type: 'joined', userId: 'x', name: 'X' }, a: ana });
      expectObservable(activeTypers$(event$, 'me')).toBe('e--a 1999ms e', { e: [], a: ['Ana'] });
    });
  });

  it('never shows the current user (FR-13)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-s-a-', { s: typing('me', 'Eu'), a: ana });
      expectObservable(activeTypers$(event$, 'me')).toBe('e--a 1999ms e', { e: [], a: ['Ana'] });
    });
  });
});

describe('typingNames$', () => {
  it('waits for the join ack to learn who "me" is (FR-13)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot<ServerEvent>('-x-j-s-a-', {
        x: ana, // before join: ignored
        j: { type: 'joined', userId: 'me', name: 'Eu' },
        s: typing('me', 'Eu'),
        a: bruno,
      });
      expectObservable(typingNames$(event$)).toBe('e------b 1999ms e', { e: [], b: ['Bruno'] });
    });
  });
});
