import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TYPING_THROTTLE_MS, TYPING_TIMEOUT_MS, type ServerEvent } from '../domain/events';
import { othersTyping$, typingPings$, whoIsTyping$ } from './typing';

let scheduler: TestScheduler;

beforeEach(() => {
  scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
});

const typing = (userId: string, name: string): ServerEvent => ({ type: 'typing', userId, name });
const said = (authorId: string): ServerEvent => ({
  type: 'message',
  message: { id: `m-${authorId}`, authorId, author: authorId, text: 'oi', sentAt: 0 },
});
const joined: ServerEvent = { type: 'joined', userId: 'me', name: 'Carla' };

describe('typingPings$ (FR-10)', () => {
  it('uses a 500 ms window by default', () => {
    expect(TYPING_THROTTLE_MS).toBe(500);
  });

  it('sends the first keystroke at once and at most one ping per 500 ms', () => {
    scheduler.run(({ cold, expectObservable }) => {
      // Keystrokes at 0, 1, 499, 502, 503: pings at 0 and 502.
      const keystroke$ = cold('ab 497ms c 2ms d e');
      expectObservable(typingPings$(keystroke$)).toBe('a 501ms d', { a: undefined, d: undefined });
    });
  });

  it('keeps pinging every 500 ms while the user keeps typing', () => {
    scheduler.run(({ cold, expectObservable }) => {
      // A keystroke every 120 ms (0 .. 1200): pings at 0, 600 and 1200.
      const keystroke$ = cold('a 119ms a 119ms a 119ms a 119ms a 119ms a 119ms a 119ms a 119ms a 119ms a 119ms a');
      expectObservable(typingPings$(keystroke$)).toBe('a 599ms a 599ms a', { a: undefined });
    });
  });
});

describe('whoIsTyping$', () => {
  it('uses a 2 s timeout by default', () => {
    expect(TYPING_TIMEOUT_MS).toBe(2000);
  });

  it('shows a name and removes it 2 s after the last typing event (FR-11, FR-12)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-a', { a: typing('u1', 'Ana') });
      expectObservable(whoIsTyping$(event$, 'me')).toBe('e a 1999ms e', { e: [], a: ['Ana'] });
    });
  });

  it('restarts the 2 s countdown on every new typing event (FR-12)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-a 999ms a', { a: typing('u1', 'Ana') });
      expectObservable(whoIsTyping$(event$, 'me')).toBe('e a 2999ms e', { e: [], a: ['Ana'] });
    });
  });

  it('lists several typers in the order they started, each with its own countdown (FR-11, FR-12)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-a-b-c', { a: typing('u1', 'Ana'), b: typing('u2', 'Bruno'), c: typing('u3', 'Carla') });
      expectObservable(whoIsTyping$(event$, 'me')).toBe('e a-b-c 1995ms x-y-e', {
        e: [],
        a: ['Ana'],
        b: ['Ana', 'Bruno'],
        c: ['Ana', 'Bruno', 'Carla'],
        x: ['Bruno', 'Carla'],
        y: ['Carla'],
      });
    });
  });

  it('removes a name immediately when that user sends a message (FR-12)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-a-m', { a: typing('u1', 'Ana'), m: said('u1') });
      expectObservable(whoIsTyping$(event$, 'me')).toBe('e a-e', { e: [], a: ['Ana'] });
    });
  });

  it("keeps a name when someone else's message arrives (FR-12)", () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-a-m', { a: typing('u1', 'Ana'), m: said('u2') });
      expectObservable(whoIsTyping$(event$, 'me')).toBe('e a 1999ms e', { e: [], a: ['Ana'] });
    });
  });

  it('never shows the current user (FR-13)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-s-a-s', { s: typing('me', 'Carla'), a: typing('u1', 'Ana') });
      expectObservable(whoIsTyping$(event$, 'me')).toBe('e--a 1999ms e', { e: [], a: ['Ana'] });
    });
  });

  it('does not emit again while the list is unchanged', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-aa', { a: typing('u1', 'Ana') });
      expectObservable(whoIsTyping$(event$, 'me'), '^ 100ms !').toBe('ea', { e: [], a: ['Ana'] });
    });
  });
});

describe('othersTyping$ (FR-13)', () => {
  it('waits for the join ack and filters out the id it carries', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-a-j-s-a', { a: typing('u2', 'Bruno'), j: joined, s: typing('me', 'Carla') });
      expectObservable(othersTyping$(event$)).toBe('e------a 1999ms e', { e: [], a: ['Bruno'] });
    });
  });

  it('honours a custom timeout', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-j-a', { j: joined, a: typing('u2', 'Bruno') });
      expectObservable(othersTyping$(event$, 10)).toBe('e--a 9ms e', { e: [], a: ['Bruno'] });
    });
  });
});
