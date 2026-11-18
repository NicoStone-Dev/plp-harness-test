import { NEVER, type Observable } from 'rxjs';
import type { ClientEvent, ServerEvent } from '../domain/events';
import { chatSession, typersOf } from './chat-session';
import { joined, said, testScheduler, typing } from './testing.spec-helper';

const ME = 'me';

describe('typersOf: who is typing (FR-11, FR-12, FR-13)', () => {
  it('shows a user on their typing event and hides them 2 s after the last one', () => {
    testScheduler().run(({ cold, expectObservable }) => {
      const event$ = cold('a 999ms b', { a: typing('ana', 'Ana'), b: typing('ana', 'Ana') });
      // Second keystroke at 1000 ms restarts the 2 s timer: gone at 3000 ms, not 2000 ms.
      expectObservable(typersOf(event$, ME)).toBe('a 2999ms b', { a: ['Ana'], b: [] });
    });
  });

  it('hides a user immediately when their message arrives', () => {
    testScheduler().run(({ cold, expectObservable }) => {
      const event$ = cold('a 99ms m', { a: typing('ana', 'Ana'), m: said('ana', 'Ana') });
      expectObservable(typersOf(event$, ME)).toBe('a 99ms b', { a: ['Ana'], b: [] });
    });
  });

  it('keeps several users in the order they started typing', () => {
    testScheduler().run(({ cold, expectObservable }) => {
      const event$ = cold('a 99ms b 99ms c 99ms d', {
        a: typing('ana', 'Ana'),
        b: typing('bruno', 'Bruno'),
        c: typing('carla', 'Carla'),
        d: typing('ana', 'Ana'), // Ana keeps typing; she stays first.
      });
      expectObservable(typersOf(event$, ME), '^ 1000ms !').toBe('a 99ms b 99ms c', {
        a: ['Ana'],
        b: ['Ana', 'Bruno'],
        c: ['Ana', 'Bruno', 'Carla'],
      });
    });
  });

  it('removes each user on their own timer', () => {
    testScheduler().run(({ cold, expectObservable }) => {
      const event$ = cold('a 499ms b', { a: typing('ana', 'Ana'), b: typing('bruno', 'Bruno') });
      expectObservable(typersOf(event$, ME)).toBe('a 499ms b 1499ms c 499ms d', {
        a: ['Ana'],
        b: ['Ana', 'Bruno'],
        c: ['Bruno'],
        d: [],
      });
    });
  });

  it('a message from someone else does not hide another typer', () => {
    testScheduler().run(({ cold, expectObservable }) => {
      const event$ = cold('a 99ms m', { a: typing('ana', 'Ana'), m: said('bruno', 'Bruno') });
      expectObservable(typersOf(event$, ME), '^ 1000ms !').toBe('a', { a: ['Ana'] });
    });
  });

  it('never shows the current user (FR-13)', () => {
    testScheduler().run(({ cold, expectObservable }) => {
      const event$ = cold('a 9ms b', { a: typing(ME, 'Me'), b: typing('ana', 'Ana') });
      expectObservable(typersOf(event$, ME), '^ 1000ms !').toBe('10ms b', { b: ['Ana'] });
    });
  });
});

describe('chatSession', () => {
  function fakeConnection(event$: Observable<ServerEvent> = NEVER) {
    const sent: ClientEvent[] = [];
    return { sent, connection: { event$, send: (event: ClientEvent) => sent.push(event) } };
  }

  it("typers$ starts empty and ignores the user's own id from the join ack", () => {
    testScheduler().run(({ hot, expectObservable }) => {
      const event$ = hot('-j-a-b', {
        j: joined(ME),
        a: typing(ME, 'Me'),
        b: typing('ana', 'Ana'),
      });
      const session = chatSession('Me', fakeConnection(event$).connection);
      expectObservable(session.typers$, '^ 1000ms !').toBe('e----b', { e: [], b: ['Ana'] });
    });
  });

  it('sends at most one typing event per 500 ms (FR-10)', () => {
    testScheduler().run(({ hot, expectObservable, flush }) => {
      const { sent, connection } = fakeConnection();
      const session = chatSession('Me', connection);
      // A keystroke every 150 ms for 1.2 s: typing goes out at 0, 600 and 1200 ms.
      hot('a 149ms a 149ms a 149ms a 149ms a 149ms a 149ms a 149ms a 149ms a', {
        a: 'olá',
      }).subscribe((draft) => session.keystroke.next(draft));

      expectObservable(session.typingSent$, '^ 2000ms !').toBe('a 599ms a 599ms a', {
        a: undefined,
      });
      flush();
      expect(sent).toEqual([{ type: 'typing' }, { type: 'typing' }, { type: 'typing' }]);
    });
  });

  it('does not send typing for blank drafts (e.g. after clearing the box)', () => {
    const { sent, connection } = fakeConnection();
    const session = chatSession('Me', connection);
    session.typingSent$.subscribe();
    session.keystroke.next('');
    session.keystroke.next('   ');
    expect(sent).toEqual([]);
  });

  it('restarts the throttle after sending a message, so the next keystroke shows typing again', () => {
    const { sent, connection } = fakeConnection();
    const session = chatSession('Me', connection);
    session.sent$.subscribe();
    session.typingSent$.subscribe();

    session.keystroke.next('o');
    session.keystroke.next('oi'); // throttled
    session.outgoing.next('oi');
    session.keystroke.next('t'); // new window

    expect(sent).toEqual([{ type: 'typing' }, { type: 'message', text: 'oi' }, { type: 'typing' }]);
  });
});
