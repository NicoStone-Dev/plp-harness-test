import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ServerEvent } from '../domain/events';
import { typingNames$, typingSignal$ } from './typing';

const SELF = 'u-carla';

const typing = (userId: string, name: string): ServerEvent => ({ type: 'typing', userId, name });
const messageFrom = (authorId: string, author: string): ServerEvent => ({
  type: 'message',
  message: { id: `m-${author}`, authorId, author, text: 'oi', sentAt: 0 },
});

const events = {
  a: typing('u-ana', 'Ana'),
  b: typing('u-bruno', 'Bruno'),
  c: typing('u-davi', 'Davi'),
  s: typing(SELF, 'Carla'),
  m: messageFrom('u-ana', 'Ana'),
};

describe('typingNames$', () => {
  let scheduler: TestScheduler;

  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
  });

  it('FR-11: shows a typist, and FR-12: hides them 2 s after their last typing event', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('10ms a', events);
      expectObservable(typingNames$(event$, SELF)).toBe('e 9ms a 1999ms e', { e: [], a: ['Ana'] });
    });
  });

  it('FR-11: lists several typists in the order they started', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('10ms a 9ms b 9ms c', events);
      expectObservable(typingNames$(event$, SELF)).toBe('e 9ms a 9ms b 9ms c 1979ms x 9ms y 9ms e', {
        e: [],
        a: ['Ana'],
        b: ['Ana', 'Bruno'],
        c: ['Ana', 'Bruno', 'Davi'],
        x: ['Bruno', 'Davi'],
        y: ['Davi'],
      });
    });
  });

  it('FR-12: each typing event restarts that user’s 2 s countdown', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('10ms a 999ms a', events);
      // second event at 1010 ms -> hidden at 3010 ms, not 2010 ms
      expectObservable(typingNames$(event$, SELF)).toBe('e 9ms a 2999ms e', { e: [], a: ['Ana'] });
    });
  });

  it('FR-12: a message from the typist hides them at once, others stay', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('10ms a 9ms b 9ms m', events);
      expectObservable(typingNames$(event$, SELF)).toBe('e 9ms a 9ms b 9ms x 1989ms e', {
        e: [],
        a: ['Ana'],
        b: ['Ana', 'Bruno'],
        x: ['Bruno'],
      });
    });
  });

  it('FR-13: never lists the own user', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('10ms s 9ms a', events);
      expectObservable(typingNames$(event$, SELF)).toBe('e 19ms a 1999ms e', { e: [], a: ['Ana'] });
    });
  });
});

describe('typingSignal$ (FR-10)', () => {
  let scheduler: TestScheduler;

  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
  });

  it('sends the first keystroke at once and the last one at the end of the 500 ms window', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const keystroke$ = hot('k 99ms k 99ms k');
      const sent$ = hot('-');
      expectObservable(typingSignal$(keystroke$, sent$)).toBe('k 499ms k');
    });
  });

  it('never sends more than one event per 500 ms while the user keeps typing', () => {
    scheduler.run(({ hot, expectObservable }) => {
      // a keystroke every 50 ms from 0 to 1450 ms
      const keystroke$ = hot('k 49ms '.repeat(29) + 'k');
      const sent$ = hot('-');
      expectObservable(typingSignal$(keystroke$, sent$)).toBe('k 499ms k 499ms k 499ms k');
    });
  });

  it('a sent message drops the pending event and restarts the window', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const keystroke$ = hot('k 99ms k 199ms k');
      const sent$ = hot('200ms s');
      // 100 ms keystroke is never sent (no trailing after the message); 300 ms goes out at once
      expectObservable(typingSignal$(keystroke$, sent$)).toBe('k 299ms k');
    });
  });
});
