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

describe('unreadCount$', () => {
  it("counts others' messages while scrolled up (FR-15)", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const message$ = cold('-o-o-o', { o: other });
      expectObservable(unreadCount$(message$, () => false, NEVER, NEVER)).toBe('za-b-c', counts);
    });
  });

  it('does not count when the user is at the bottom (FR-15)', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const nearBottom = [true, false, true];
      const message$ = cold('-o-o-o', { o: other });
      expectObservable(unreadCount$(message$, () => nearBottom.shift() ?? false, NEVER, NEVER)).toBe(
        'z--a--',
        counts,
      );
    });
  });

  it('never counts own messages (FR-19)', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const message$ = cold('-m-o-m', { m: own, o: other });
      expectObservable(unreadCount$(message$, () => false, NEVER, NEVER)).toBe('z--a--', counts);
    });
  });

  it('resets to 0 when the pill is clicked (FR-17)', () => {
    scheduler.run(({ cold, hot, expectObservable }) => {
      const message$ = cold('-o-o---o', { o: other });
      const jump$ = hot('-----j--');
      expectObservable(unreadCount$(message$, () => false, NEVER, jump$)).toBe('za-b-z-a', counts);
    });
  });

  it('resets to 0 when scrolling reaches the bottom, not on other scrolls (FR-18)', () => {
    scheduler.run(({ cold, hot, expectObservable }) => {
      // Messages arrive scrolled up; the 1st scroll stays up, the 2nd reaches the bottom.
      const nearBottom = [false, false, false, true];
      const message$ = cold('-o-o-----', { o: other });
      const scroll$ = hot('-----s-s-');
      expectObservable(unreadCount$(message$, () => nearBottom.shift() ?? true, scroll$, NEVER)).toBe(
        'za-b---z-',
        counts,
      );
    });
  });

  it('does not emit on resets while already at 0 (pill stays hidden, FR-16)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      expectObservable(unreadCount$(NEVER, () => true, hot('-s-s'), hot('--j-'))).toBe('z---', counts);
    });
  });
});
