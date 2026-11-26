import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { reachedBottom$, unreadCount$ } from './unread';

let scheduler: TestScheduler;

beforeEach(() => {
  scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
});

const own = { own: true };
const other = { own: false };

describe('unreadCount$', () => {
  it("counts others' messages while scrolled up (FR-15)", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const message$ = cold('-a-b-c-', { a: other, b: other, c: other });
      expectObservable(unreadCount$(message$, () => false, cold('-'))).toBe('0a-b-c-', { 0: 0, a: 1, b: 2, c: 3 });
    });
  });

  it("does not count others' messages while at the bottom (FR-15)", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const nearBottom = [true, false, true];
      const message$ = cold('-a-b-c-', { a: other, b: other, c: other });
      expectObservable(unreadCount$(message$, () => nearBottom.shift() ?? true, cold('-'))).toBe('0--a---', {
        0: 0,
        a: 1,
      });
    });
  });

  it('never counts own messages (FR-19)', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const message$ = cold('-a-b-c-', { a: own, b: other, c: own });
      expectObservable(unreadCount$(message$, () => false, cold('-'))).toBe('0--b---', { 0: 0, b: 1 });
    });
  });

  it('resets to 0 on reset$ and counts again afterwards (FR-17, FR-18)', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const message$ = cold('-aa---a-', { a: other });
      const reset$ = cold('    ---r-r--');
      expectObservable(unreadCount$(message$, () => false, reset$)).toBe('012r--1-', { 0: 0, 1: 1, 2: 2, r: 0 });
    });
  });
});

describe('reachedBottom$ (FR-18)', () => {
  it('emits only for scroll events that end at the bottom', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const atBottom = [false, false, true, false, true];
      const scroll$ = cold('-sssss-');
      expectObservable(reachedBottom$(scroll$, () => atBottom.shift() ?? false)).toBe('---b-b-', { b: undefined });
    });
  });
});
