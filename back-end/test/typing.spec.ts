import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { throttleTyping } from '../src/streams/typing.js';

describe('throttleTyping (FR-10)', () => {
  let scheduler: TestScheduler;

  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
  });

  it('relays the first keystroke at once and at most one per 500 ms', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const typing = hot('t 99ms t 99ms t 99ms t 99ms t 99ms t 99ms t');
      const reset = hot('-');
      // keystrokes every 100 ms from 0 to 600 ms -> relayed at 0 and 600 ms
      // (the one at exactly 500 ms still falls inside the first window)
      expectObservable(throttleTyping(typing, reset)).toBe('t 599ms t');
    });
  });

  it('relays a keystroke again after a 500 ms window has passed', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const typing = hot('t 599ms t 599ms t');
      const reset = hot('-');
      expectObservable(throttleTyping(typing, reset)).toBe('t 599ms t 599ms t');
    });
  });

  it('a sent message restarts the window, so the next keystroke is relayed at once', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const typing = hot('t 199ms - 99ms t');
      const reset = hot(' - 199ms m');
      // without the reset, the keystroke at 300 ms would fall in the 0–500 ms window
      expectObservable(throttleTyping(typing, reset)).toBe('t 299ms t');
    });
  });
});
