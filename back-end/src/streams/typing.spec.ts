import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TYPING_THROTTLE_MS } from '../domain/events.js';
import { throttleTyping$ } from './typing.js';

let scheduler: TestScheduler;

beforeEach(() => {
  scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
});

describe('throttleTyping$ (FR-10)', () => {
  it('uses a 500 ms window by default', () => {
    expect(TYPING_THROTTLE_MS).toBe(500);
  });

  it('relays the first keystroke at once and drops the rest of the 500 ms window', () => {
    scheduler.run(({ cold, expectObservable }) => {
      // a at 0, b at 1, c at 499 (inside the window), d at 502 (new window), e at 503.
      const typing$ = cold('ab 497ms c 2ms d e', { a: 1, b: 2, c: 3, d: 4, e: 5 });
      expectObservable(throttleTyping$(typing$)).toBe('a 501ms d', { a: 1, d: 4 });
    });
  });

  it('relays one event per window during continuous typing', () => {
    scheduler.run(({ cold, expectObservable }) => {
      // A keystroke every 120 ms (0, 120, ..., 1200): relayed at 0, 600 and 1200.
      const typing$ = cold('a 119ms a 119ms a 119ms a 119ms a 119ms a 119ms a 119ms a 119ms a 119ms a 119ms a', {
        a: 't',
      });
      expectObservable(throttleTyping$(typing$)).toBe('a 599ms a 599ms a', { a: 't' });
    });
  });

  it('honours a custom window', () => {
    scheduler.run(({ cold, expectObservable }) => {
      expectObservable(throttleTyping$(cold('a 10ms b c', { a: 1, b: 2, c: 3 }), 10)).toBe('a 10ms b', {
        a: 1,
        b: 2,
      });
    });
  });
});
