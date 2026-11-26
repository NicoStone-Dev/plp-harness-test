import { ignoreElements, NEVER, tap, type Observable } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChatMessage, ClientEvent, ServerEvent } from '../domain/events';
import { toMessageView } from '../domain/message-view';
import type { ChatConnection } from './chat-connection';
import { chatSession, messageList$, messageViews$, sentText$, typingSignals$ } from './chat-session';

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

const typingEvent = (userId: string, name: string): ServerEvent => ({ type: 'typing', userId, name });

describe('typingSignals$ (FR-12, FR-13)', () => {
  it('waits for the join ack, drops own typing, and turns messages into stops', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-x-j-a-s-b-', {
        x: typingEvent('other', 'Bruno'), // before the ack: ignored
        j: joined,
        a: typingEvent('other', 'Bruno'),
        s: typingEvent('me', 'Ana'), // own: never shown (FR-13)
        b: msg(m1), // Bruno sent a message: stop (FR-12)
      });
      expectObservable(typingSignals$(event$)).toBe('-----a---b-', {
        a: { kind: 'typing', userId: 'other', name: 'Bruno' },
        b: { kind: 'stopped', userId: 'other' },
      });
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

  it('typing$ shows other users typing and clears them on their message or after 2 s (FR-11 to FR-13)', () => {
    scheduler.run(({ hot, expectObservable }) => {
      const event$ = hot('-j-a-c-s-b 1990ms -', {
        j: joined,
        a: typingEvent('other', 'Bruno'),
        c: typingEvent('u3', 'Carla'),
        s: typingEvent('me', 'Ana'),
        b: msg(m1), // from Bruno
      });
      const session = chatSession('Ana', fakeConnection(event$));
      // Carla typed at 5, so she disappears at 2005.
      expectObservable(session.typing$).toBe('e--a-c---b 1995ms e', {
        e: [],
        a: ['Bruno'],
        c: ['Bruno', 'Carla'],
        b: ['Carla'],
      });
    });
  });

  it('keystroke() sends at most one typing ping per 500 ms (FR-10)', () => {
    const connection = fakeConnection(NEVER);
    scheduler.run(({ hot, expectObservable }) => {
      const session = chatSession('Ana', connection);
      const keys$ = hot('-kk 300ms k 300ms k', { k: 'k' }).pipe(tap(() => session.keystroke()));

      // keystrokes at 1, 2, 303, 604: pings at 1 and 604.
      expectObservable(session.typingSent$).toBe('-p 602ms p', { p: undefined });
      expectObservable(keys$.pipe(ignoreElements()));
    });
    expect(connection.sent).toEqual([{ type: 'typing' }, { type: 'typing' }]);
  });
});
