import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TYPING_EXPIRE_MS, TYPING_THROTTLE_MS, typingPings$, typingUsers$, type TypingSignal } from './typing';

let scheduler: TestScheduler;

beforeEach(() => {
  scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
});

const typing = (userId: string, name: string): TypingSignal => ({ kind: 'typing', userId, name });
const stopped = (userId: string): TypingSignal => ({ kind: 'stopped', userId });
const ana = typing('u1', 'Ana');
const bruno = typing('u2', 'Bruno');
const carla = typing('u3', 'Carla');

describe('typingPings$ (FR-10)', () => {
  it('uses a 500 ms window', () => {
    expect(TYPING_THROTTLE_MS).toBe(500);
  });

  it('sends the first keystroke at once, then at most one per 500 ms', () => {
    scheduler.run(({ cold, expectObservable }) => {
      // a at 0 passes; b at 1 and x at 500 (window boundary) are dropped;
      // c at 501 passes; d at 1002 passes.
      const keystroke$ = cold('ab 498ms xc 500ms d', { a: 'a', b: 'b', x: 'x', c: 'c', d: 'd' });
      expectObservable(typingPings$(keystroke$)).toBe('a 500ms c 500ms d', {
        a: undefined,
        c: undefined,
        d: undefined,
      });
    });
  });

  it('a steady stream of keystrokes (every 100 ms) sends one ping per 500 ms', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const keystroke$ = cold('k 99ms k 99ms k 99ms k 99ms k 99ms k 99ms k', { k: 'k' });
      // keystrokes at 0,100,...,600: pings at 0 and 600 (500 is the window boundary).
      expectObservable(typingPings$(keystroke$)).toBe('p 599ms p', { p: undefined });
    });
  });
});

describe('typingUsers$ (FR-11, FR-12)', () => {
  it('uses a 2 s expiry', () => {
    expect(TYPING_EXPIRE_MS).toBe(2000);
  });

  it('starts empty, shows a name, and removes it 2 s after the last keystroke', () => {
    scheduler.run(({ cold, expectObservable }) => {
      expectObservable(typingUsers$(cold('-a', { a: ana }))).toBe('ea 1999ms e', { e: [], a: ['Ana'] });
    });
  });

  it('restarts the 2 s timer on every new typing event from that user', () => {
    scheduler.run(({ cold, expectObservable }) => {
      expectObservable(typingUsers$(cold('-a 999ms a', { a: ana }))).toBe('ea 2999ms e', {
        e: [],
        a: ['Ana'],
      });
    });
  });

  it('removes a name immediately when that user sends a message (FR-12)', () => {
    scheduler.run(({ cold, expectObservable }) => {
      expectObservable(typingUsers$(cold('-a 99ms s', { a: ana, s: stopped('u1') }))).toBe('ea 99ms e', {
        e: [],
        a: ['Ana'],
      });
    });
  });

  it('keeps several users in the order they started, each with its own timer', () => {
    scheduler.run(({ cold, expectObservable }) => {
      expectObservable(typingUsers$(cold('-abc', { a: ana, b: bruno, c: carla }))).toBe('eabc 1997ms xyz', {
        e: [],
        a: ['Ana'],
        b: ['Ana', 'Bruno'],
        c: ['Ana', 'Bruno', 'Carla'],
        x: ['Bruno', 'Carla'],
        y: ['Carla'],
        z: [],
      });
    });
  });

  it("one user's message does not clear another user's name", () => {
    scheduler.run(({ cold, expectObservable }) => {
      expectObservable(typingUsers$(cold('-ab-s', { a: ana, b: bruno, s: stopped('u1') }))).toBe(
        'eab-s 1997ms e',
        { e: [], a: ['Ana'], b: ['Ana', 'Bruno'], s: ['Bruno'] },
      );
    });
  });

  it('ignores a stop for someone who was not typing', () => {
    scheduler.run(({ cold, expectObservable }) => {
      expectObservable(typingUsers$(cold('-s-', { s: stopped('u9') }))).toBe('e--', { e: [] });
    });
  });

  it('can be shown again after expiring', () => {
    scheduler.run(({ cold, expectObservable }) => {
      expectObservable(typingUsers$(cold('-a 2999ms a', { a: ana }))).toBe('ea 1999ms e 999ms a 1999ms e', {
        e: [],
        a: ['Ana'],
      });
    });
  });
});
