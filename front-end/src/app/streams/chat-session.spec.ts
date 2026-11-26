import { ignoreElements, NEVER, tap, type Observable } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChatMessage, ClientEvent, ServerEvent } from '../domain/events';
import { toMessageView } from '../domain/message-view';
import type { ChatConnection } from './chat-connection';
import { chatSession, messageList$, messageViews$, sentText$ } from './chat-session';

let scheduler: TestScheduler;

beforeEach(() => {
  scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
});

const chat = (id: string, authorId: string, text: string): ChatMessage => ({
  id,
  authorId,
  author: authorId === 'me' ? 'Ana' : 'Bruno',
  text,
  sentAt: 0,
});
const joined: ServerEvent = { type: 'joined', userId: 'me', name: 'Ana' };
const m1 = chat('1', 'other', 'oi');
const m2 = chat('2', 'me', 'olá');
const msg = (message: ChatMessage): ServerEvent => ({ type: 'message', message });

describe('messageViews$', () => {
  it('waits for the join ack, then maps messages to views marked own/other (FR-03, FR-04)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-x-j-a-b-', { x: msg(chat('0', 'other', 'before')), j: joined, a: msg(m1), b: msg(m2) });

      expectObservable(messageViews$(event$)).toBe('-----a-b-', {
        a: toMessageView(m1, 'me'),
        b: toMessageView(m2, 'me'),
      });
    });
  });

  it('ignores later joined acks', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-j-k-a-', { j: joined, k: { ...joined, userId: 'other' }, a: msg(m1) });
      expectObservable(messageViews$(event$)).toBe('-----a-', { a: toMessageView(m1, 'me') });
    });
  });
});

describe('messageList$', () => {
  it('starts empty and accumulates in arrival order (FR-03, FR-07)', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const a = toMessageView(m1, 'me');
      const b = toMessageView(m2, 'me');
      expectObservable(messageList$(cold('-a-b|', { a, b }))).toBe('ea-b|', { e: [], a: [a], b: [a, b] });
    });
  });
});

describe('sentText$ (FR-02)', () => {
  it('trims, drops blank text, and sends only what it emits', () => {
    scheduler.run(({ cold, expectObservable, flush }) => {
      const sent: string[] = [];
      const result$ = sentText$(cold('-a-b-c-|', { a: '  oi ', b: '   ', c: '' }), (t) => sent.push(t));

      expectObservable(result$).toBe('-a-----|', { a: 'oi' });
      flush();
      expect(sent).toEqual(['oi']);
    });
  });
});

describe('chatSession', () => {
  function fakeConnection(event$: Observable<ServerEvent>): ChatConnection & { sent: ClientEvent[] } {
    const sent: ClientEvent[] = [];
    return { event$, sent, send: (event) => sent.push(event) };
  }

  it('shares one subscription between message$ and messages$', () => {
    scheduler.run(({ hot, expectObservable, expectSubscriptions }) => {
      const event$ = hot('-j-a-b-', { j: joined, a: msg(m1), b: msg(m2) });
      const session = chatSession('Ana', fakeConnection(event$));
      const a = toMessageView(m1, 'me');
      const b = toMessageView(m2, 'me');

      expectObservable(session.message$).toBe('---a-b-', { a, b });
      expectObservable(session.messages$).toBe('e--a-b-', { e: [], a: [a], b: [a, b] });
      // One for the join ack, one for the messages after it — not one per consumer.
      expectSubscriptions(event$.subscriptions).toBe(['^!', '-^']);
    });
  });

  it('submit() sends normalized text to the server and reports it on sent$ (FR-02)', () => {
    const connection = fakeConnection(NEVER);
    scheduler.run(({ hot, expectObservable }) => {
      const session = chatSession('Ana', connection);
      const typed$ = hot('-a-b-c-', { a: '   ', b: '  oi  ', c: '' }).pipe(tap((t) => session.submit(t)));

      expectObservable(session.sent$).toBe('---b---', { b: 'oi' });
      expectObservable(typed$.pipe(ignoreElements()));
    });
    expect(connection.sent).toEqual([{ type: 'message', text: 'oi' }]);
  });

  it('typed() sends at most one typing event per 500 ms and reports it on typingSent$ (FR-10)', () => {
    const connection = fakeConnection(NEVER);
    scheduler.run(({ hot, expectObservable }) => {
      const session = chatSession('Ana', connection);
      // Keystrokes at 1, 2, 3 and 600 ms.
      const keys$ = hot('-kkk 596ms k', { k: undefined }).pipe(tap(() => session.typed()));

      expectObservable(session.typingSent$).toBe('-t 598ms t', { t: undefined });
      expectObservable(keys$.pipe(ignoreElements()));
    });
    expect(connection.sent).toEqual([{ type: 'typing' }, { type: 'typing' }]);
  });

  it("typingNames$ lists other users typing, without the user's own name (FR-11, FR-13)", () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot<ServerEvent>('-j-a-s', {
        j: joined,
        a: { type: 'typing', userId: 'other', name: 'Bruno' },
        s: { type: 'typing', userId: 'me', name: 'Ana' },
      });
      const session = chatSession('Ana', fakeConnection(event$));

      expectObservable(session.typingNames$, '^ 100ms !').toBe('e--a', { e: [], a: ['Bruno'] });
    });
  });
});
