import { TestScheduler } from 'rxjs/testing';
import { reachedBottom$, unreadCount$ } from './unread';

let scheduler: TestScheduler;

beforeEach(() => {
  scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
});

const msgs = { o: { own: false }, m: { own: true } };

describe('unreadCount$ (FR-15 to FR-19)', () => {
  it('FR-15: counts messages from others while scrolled up', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const message$ = hot('-o-o-o', msgs);
      expectObservable(unreadCount$(message$, () => false, hot('-'))).toBe('ab-c-d', {
        a: 0,
        b: 1,
        c: 2,
        d: 3,
      });
    });
  });

  it('FR-15: does not count while at the bottom', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const message$ = hot('-o-o', msgs);
      expectObservable(unreadCount$(message$, () => true, hot('-'))).toBe('a', { a: 0 });
    });
  });

  it('FR-15: uses the scroll position measured when each message arrives', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const positions = [false, true, false]; // up, bottom, up
      const message$ = hot('-o-o-o', msgs);
      expectObservable(unreadCount$(message$, () => positions.shift() ?? true, hot('-'))).toBe(
        'ab---c',
        {
          a: 0,
          b: 1,
          c: 2,
        },
      );
    });
  });

  it('FR-19: own messages never increase the counter', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const message$ = hot('-m-o-m', msgs);
      expectObservable(unreadCount$(message$, () => false, hot('-'))).toBe('a--b', { a: 0, b: 1 });
    });
  });

  it('FR-17 / FR-18: a reset sets it back to 0, and counting starts again', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const message$ = hot('-o-o---o', msgs);
      const reset$ = hot('  -----r', { r: undefined });
      expectObservable(unreadCount$(message$, () => false, reset$)).toBe('ab-c-a-b', {
        a: 0,
        b: 1,
        c: 2,
      });
    });
  });

  it('a reset at 0 emits nothing new', () => {
    scheduler.run(({ hot, expectObservable }) => {
      expectObservable(unreadCount$(hot('-'), () => false, hot('-r-r'))).toBe('a', { a: 0 });
    });
  });
});

describe('reachedBottom$ (FR-18)', () => {
  it('FR-18: passes only the scroll events that end at the bottom', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const atBottom = [false, false, true];
      const scroll$ = hot('-s-s-s');
      expectObservable(reachedBottom$(scroll$, () => atBottom.shift() ?? false)).toBe('-----x', {
        x: undefined,
      });
    });
  });
});
