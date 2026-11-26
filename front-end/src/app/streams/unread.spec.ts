import { tap } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { unreadCount$ } from './unread';

/** A test message: who sent it, and whether the list was near the bottom when it arrived. */
interface TestMessage {
  readonly own: boolean;
  readonly nearBottom: boolean;
}

const messages: Record<string, TestMessage> = {
  a: { own: false, nearBottom: false }, // someone else, user scrolled up
  b: { own: false, nearBottom: true }, // someone else, user at the bottom
  o: { own: true, nearBottom: false }, // own message, user scrolled up
};

describe('unreadCount$', () => {
  let scheduler: TestScheduler;

  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
  });

  /** Runs `unreadCount$` where `wasNearBottom()` answers what each message says. */
  function count(messageMarbles: string, resetMarbles: string, expected: string, values: Record<string, number>) {
    scheduler.run(({ hot, expectObservable }) => {
      let nearBottom = true;
      const message$ = hot(messageMarbles, messages).pipe(tap((m) => (nearBottom = m.nearBottom)));
      const reset$ = hot(resetMarbles);
      expectObservable(unreadCount$(message$, () => nearBottom, reset$)).toBe(expected, values);
    });
  }

  it('starts at 0 (FR-16: pill hidden)', () => {
    count('-', '-', '0', { 0: 0 });
  });

  it('FR-15: adds 1 per message from others while scrolled up', () => {
    count('10ms a 9ms a 9ms a', '-', '0 9ms 1 9ms 2 9ms 3', { 0: 0, 1: 1, 2: 2, 3: 3 });
  });

  it('FR-15: does not count messages that arrive while at the bottom', () => {
    count('10ms b 9ms a 9ms b', '-', '0 19ms 1', { 0: 0, 1: 1 });
  });

  it('FR-19: own messages never add to the counter', () => {
    count('10ms a 9ms o 9ms o 9ms a', '-', '0 9ms 1 29ms 2', { 0: 0, 1: 1, 2: 2 });
  });

  it('FR-17 / FR-18: a reset sets it back to 0, and counting starts again', () => {
    count('10ms a 9ms a 19ms a', '30ms r', '0 9ms 1 9ms 2 9ms 0 9ms 1', { 0: 0, 1: 1, 2: 2 });
  });

  it('a reset at 0 emits nothing new', () => {
    count('-', '10ms r 9ms r', '0', { 0: 0 });
  });
});
