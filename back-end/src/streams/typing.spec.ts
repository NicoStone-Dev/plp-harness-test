import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TYPING_THROTTLE_MS } from '../domain/events.js';
import { throttleTyping } from './typing.js';

let scheduler: TestScheduler;

beforeEach(() => {
  scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
});

describe('throttleTyping (FR-10)', () => {
  it('uses a 500 ms window by default', () => {
    expect(TYPING_THROTTLE_MS).toBe(500);
  });

  it('lets the first keystroke through and drops the rest of the 500 ms window', () => {
    scheduler.run(({ cold, expectObservable }) => {
      // a at 0 opens the window; b (1), c (499) and d (500, still inside) are dropped;
      // e at 501 is the first keystroke after the window and opens the next one.
      const typing$ = cold('ab 497ms c d e', { a: 1, b: 2, c: 3, d: 4, e: 5 });
      expectObservable(throttleTyping(typing$)).toBe('a 500ms e', { a: 1, e: 5 });
    });
  });

  it('passes every keystroke that is more than 500 ms apart', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const typing$ = cold('a 500ms b 599ms c', { a: 1, b: 2, c: 3 });
      expectObservable(throttleTyping(typing$)).toBe('a 500ms b 599ms c', { a: 1, b: 2, c: 3 });
    });
  });
});
