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
const counts = { a: 0, b: 1, c: 2, d: 3 };

describe('unreadCount$', () => {
  it("adds 1 per message from someone else while scrolled up (FR-15)", () => {
    scheduler.run(({ hot, expectObservable }) => {
      const message$ = hot('-o-o-o', { o: other });
      expectObservable(unreadCount$(message$, () => true, NEVER)).toBe('ab-c-d', counts);
    });
  });

  it('never counts own messages (FR-19)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const message$ = hot('-o-m-m-o', { o: other, m: own });
      expectObservable(unreadCount$(message$, () => true, NEVER)).toBe('ab-----c', counts);
    });
  });

  it('does not count messages that arrive while the user is at the bottom (FR-15)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const away = [false, true, false];
      const message$ = hot('-o-o-o', { o: other });
      expectObservable(unreadCount$(message$, () => away.shift() ?? false, NEVER)).toBe('a--b--', counts);
    });
  });

  it('resets to 0 on reset$ (reaching the bottom, FR-18; clicking the pill, FR-17)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const message$ = hot('-o-o---o', { o: other });
      const reset$ = hot('-----r--', { r: undefined });
      expectObservable(unreadCount$(message$, () => true, reset$)).toBe('ab-c-a-b', counts);
    });
  });

  it('does not emit again when reset while already at 0 (FR-16: pill stays hidden)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const reset$ = hot('-r-r', { r: undefined });
      expectObservable(unreadCount$(NEVER, () => true, reset$)).toBe('a---', counts);
    });
  });
});
