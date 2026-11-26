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

  it('lets one ping through per 500 ms', () => {
    scheduler.run(({ cold, expectObservable }) => {
      // a at 0 passes; b at 1, c at 499 and the boundary 500 are inside the window;
      // d at 501 passes and opens a new window, so e at 700 is dropped.
      const ping$ = cold('ab 497ms cx d 198ms e', { a: 1, b: 2, c: 3, x: 0, d: 4, e: 5 });
      expectObservable(throttleTyping(ping$)).toBe('a 500ms d', { a: 1, d: 4 });
    });
  });

  it('passes isolated pings unchanged', () => {
    scheduler.run(({ cold, expectObservable }) => {
      expectObservable(throttleTyping(cold('a 999ms b|', { a: 1, b: 2 }))).toBe('a 999ms b|', { a: 1, b: 2 });
    });
  });
});
