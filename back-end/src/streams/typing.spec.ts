import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { throttleTyping, TYPING_THROTTLE_MS } from './typing.js';

let scheduler: TestScheduler;

beforeEach(() => {
  scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
});

describe('throttleTyping (FR-10)', () => {
  it('uses a 500 ms window', () => {
    expect(TYPING_THROTTLE_MS).toBe(500);
  });

  it('relays the first keystroke and drops the rest of the 500 ms window', () => {
    scheduler.run(({ cold, expectObservable }) => {
      // a at 0, b at 1, c at 499 (dropped: same window), d at 501 (new window), e at 1100 (new window).
      const typing$ = cold('ab 497ms c 1ms d 598ms e', { a: 1, b: 2, c: 3, d: 4, e: 5 });
      expectObservable(throttleTyping(typing$)).toBe('a 500ms d 598ms e', { a: 1, d: 4, e: 5 });
    });
  });

  it('honours a custom window', () => {
    scheduler.run(({ cold, expectObservable }) => {
      expectObservable(throttleTyping(cold('aaaa-a', { a: 1 }), 4)).toBe('a----a', { a: 1 });
    });
  });
});
