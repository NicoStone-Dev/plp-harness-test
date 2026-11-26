import { NEVER } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { unreadCount$ } from './unread';

let scheduler: TestScheduler;

beforeEach(() => {
  scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
});

const own = { own: true };
const other = { own: false };
const counts = { z: 0, a: 1, b: 2, c: 3 };

/** Answers isNearBottom() calls in order; `false` once the list runs out. */
const answers = (...values: boolean[]) => () => values.shift() ?? false;

describe('unreadCount$', () => {
  it('counts messages from others while scrolled up (FR-15)', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const message$ = cold('-a-b-c', { a: other, b: other, c: other });
      expectObservable(unreadCount$(message$, () => false, NEVER, NEVER)).toBe('za-b-c', counts);
    });
  });

  it('does not count messages that arrive while at the bottom (FR-15)', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const message$ = cold('-a-b-c', { a: other, b: other, c: other });
      // Near the bottom for a and c; scrolled up only for b.
      expectObservable(unreadCount$(message$, answers(true, false, true), NEVER, NEVER)).toBe(
        'z--a--',
        counts,
      );
    });
  });

  it("never counts the user's own messages (FR-19)", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const message$ = cold('-a-b-c', { a: own, b: other, c: own });
      expectObservable(unreadCount$(message$, () => false, NEVER, NEVER)).toBe('z--a--', counts);
    });
  });

  it('resets when a scroll reaches the bottom, not on other scrolls (FR-18)', () => {
    scheduler.run(({ cold, hot, expectObservable }) => {
      const message$ = cold('-a-b-----', { a: other, b: other });
      const scroll$ = hot('-----s-s-');
      // Calls: message a, message b, scroll at 5 (still up), scroll at 7 (bottom).
      expectObservable(unreadCount$(message$, answers(false, false, false, true), scroll$, NEVER)).toBe(
        'za-b---z-',
        counts,
      );
    });
  });

  it('resets when the pill is clicked, and counts again afterwards (FR-17)', () => {
    scheduler.run(({ cold, hot, expectObservable }) => {
      const message$ = cold('-a-b---c', { a: other, b: other, c: other });
      const jump$ = hot('-----j--');
      expectObservable(unreadCount$(message$, () => false, NEVER, jump$)).toBe('za-b-z-a', counts);
    });
  });

  it('starts at 0 so the pill is hidden (FR-16)', () => {
    scheduler.run(({ expectObservable }) => {
      expectObservable(unreadCount$(NEVER, () => false, NEVER, NEVER)).toBe('z', counts);
    });
  });
});
