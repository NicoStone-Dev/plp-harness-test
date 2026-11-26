import { TestScheduler } from 'rxjs/testing';
import type { ServerEvent } from '../domain/events';
import { typingLabel, typingNames$, typingNotices$, typingSegments } from './typing';

const newScheduler = () => new TestScheduler((actual, expected) => expect(actual).toEqual(expected));

const joined: ServerEvent = { type: 'joined', userId: 'me', name: 'Carla' };
const typing = (userId: string, name: string): ServerEvent => ({ type: 'typing', userId, name });
const messageFrom = (authorId: string, author: string): ServerEvent => ({
  type: 'message',
  message: { id: `${authorId}-msg`, authorId, author, text: 'oi', sentAt: 0 },
});

const ev = {
  j: joined,
  a: typing('ana', 'Ana'),
  b: typing('bruno', 'Bruno'),
  c: typing('carla', 'Carla'),
  s: typing('me', 'Carla'),
  A: messageFrom('ana', 'Ana'),
  M: messageFrom('me', 'Carla'),
};

describe('typingNotices$ (FR-10)', () => {
  it('sends at most one typing notice per 500 ms, the first one immediately', () => {
    newScheduler().run(({ hot, expectObservable }) => {
      const send = vi.fn();
      // keystrokes at 0, 100, 200, 499, 650, 1100, 1200 ms -> notices at 0, 650, 1200 ms
      const keys$ = hot('k 99ms k 99ms k 298ms k 150ms k 449ms k 99ms k');
      expectObservable(typingNotices$(keys$, send)).toBe('k 649ms k 549ms k');
    });
  });

  it('calls send once per notice', () => {
    newScheduler().run(({ hot, flush }) => {
      const send = vi.fn();
      typingNotices$(hot('k k k 600ms k'), send).subscribe();
      flush();
      expect(send).toHaveBeenCalledTimes(2);
    });
  });
});

describe('typingNames$', () => {
  it('FR-11: lists other typists in the order they started typing', () => {
    newScheduler().run(({ hot, expectObservable }) => {
      const event$ = hot<ServerEvent>('j a b a', ev);
      expectObservable(typingNames$(event$), '^ 1s !').toBe('x y z', {
        x: [],
        y: ['Ana'],
        z: ['Ana', 'Bruno'],
      });
    });
  });

  it('FR-12: removes a name 2 s after that user\'s last typing event', () => {
    newScheduler().run(({ hot, expectObservable }) => {
      // Ana types at 1 ms and 1001 ms: she disappears at 3001 ms, not 2001 ms.
      const event$ = hot<ServerEvent>('j a 999ms a', ev);
      expectObservable(typingNames$(event$)).toBe('x y 2999ms z', { x: [], y: ['Ana'], z: [] });
    });
  });

  it('FR-12: removes a name immediately when that user sends a message', () => {
    newScheduler().run(({ hot, expectObservable }) => {
      const event$ = hot<ServerEvent>('j a b 99ms A', ev);
      expectObservable(typingNames$(event$), '^ 1s !').toBe('x y z 99ms w', {
        x: [],
        y: ['Ana'],
        z: ['Ana', 'Bruno'],
        w: ['Bruno'],
      });
    });
  });

  it('FR-12: a message from someone else does not remove a typist', () => {
    newScheduler().run(({ hot, expectObservable }) => {
      const event$ = hot<ServerEvent>('j a M', ev);
      expectObservable(typingNames$(event$), '^ 1s !').toBe('x y', { x: [], y: ['Ana'] });
    });
  });

  it('FR-13: never includes the user\'s own name, even if the server echoes it', () => {
    newScheduler().run(({ hot, expectObservable }) => {
      const event$ = hot<ServerEvent>('j s a s', ev);
      expectObservable(typingNames$(event$), '^ 1s !').toBe('x - y', { x: [], y: ['Ana'] });
    });
  });

  it('FR-11: three typists', () => {
    newScheduler().run(({ hot, expectObservable }) => {
      const event$ = hot<ServerEvent>('j a b c', ev);
      expectObservable(typingNames$(event$), '^ 1s !').toBe('w x y z', {
        w: [],
        x: ['Ana'],
        y: ['Ana', 'Bruno'],
        z: ['Ana', 'Bruno', 'Carla'],
      });
    });
  });

  it('waits for the join acknowledgement before showing anyone', () => {
    newScheduler().run(({ hot, expectObservable }) => {
      const event$ = hot<ServerEvent>('a j b', ev);
      expectObservable(typingNames$(event$), '^ 1s !').toBe('- x y', { x: [], y: ['Bruno'] });
    });
  });
});

describe('typingLabel / typingSegments (FR-11)', () => {
  it('formats one, two and three names', () => {
    expect(typingLabel(['Ana'])).toBe('Ana está digitando…');
    expect(typingLabel(['Ana', 'Bruno'])).toBe('Ana e Bruno estão digitando…');
    expect(typingLabel(['Ana', 'Bruno', 'Carla'])).toBe('Ana, Bruno e Carla estão digitando…');
  });

  it('is empty when nobody is typing', () => {
    expect(typingLabel([])).toBe('');
    expect(typingSegments([])).toEqual([]);
  });

  it('marks the names (rendered in bold) apart from the connecting words', () => {
    expect(typingSegments(['Ana', 'Bruno'])).toEqual([
      { text: 'Ana', name: true },
      { text: ' e ', name: false },
      { text: 'Bruno', name: true },
      { text: ' estão digitando…', name: false },
    ]);
  });
});
