import { NEVER, type Observable } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { describe, expect, it } from 'vitest';
import type { ClientEvent, ServerEvent } from '../domain/events.js';
import type { ChatClient } from './chat-client.js';
import { chatRoom } from './chat-room.js';

interface FakeClient {
  readonly client: ChatClient;
  readonly sent: ServerEvent[];
}

function fakeClient(event$: Observable<ClientEvent>, closed$: Observable<void> = NEVER): FakeClient {
  const sent: ServerEvent[] = [];
  return { client: { event$, closed$, error$: NEVER, send: (event) => sent.push(event) }, sent };
}

const typingIn = (sent: ServerEvent[]) => sent.filter((event) => event.type === 'typing');
const messagesIn = (sent: ServerEvent[]) => sent.filter((event) => event.type === 'message');

function newScheduler(): TestScheduler {
  return new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
}

const ev = {
  ana: { type: 'join', name: 'Ana' },
  bruno: { type: 'join', name: 'Bruno' },
  carla: { type: 'join', name: 'Carla' },
  t: { type: 'typing' },
  m: { type: 'message', text: 'oi' },
} satisfies Record<string, ClientEvent>;

describe('chatRoom – typing indicator', () => {
  it('FR-10: relays at most one typing event per 500 ms per user', () => {
    const scheduler = newScheduler();
    scheduler.run(({ hot, cold, flush }) => {
      // Ana types on frames 1, 2, 3 (one window) and again at 504 ms (a new window).
      const ana = fakeClient(hot('a t t t 500ms t', { a: ev.ana, t: ev.t }));
      const bruno = fakeClient(hot('b', { b: ev.bruno }));
      chatRoom(cold('(xy)', { x: ana.client, y: bruno.client })).subscribe();
      flush();

      expect(typingIn(bruno.sent)).toHaveLength(2);
    });
  });

  it('FR-10: throttles each user independently', () => {
    const scheduler = newScheduler();
    scheduler.run(({ hot, cold, flush }) => {
      const ana = fakeClient(hot('a t t', { a: ev.ana, t: ev.t }));
      const bruno = fakeClient(hot('b t t', { b: ev.bruno, t: ev.t }));
      const carla = fakeClient(hot('c', { c: ev.carla }));
      chatRoom(cold('(xyz)', { x: ana.client, y: bruno.client, z: carla.client })).subscribe();
      flush();

      expect(typingIn(carla.sent).map((event) => event.type === 'typing' && event.name)).toEqual(['Ana', 'Bruno']);
    });
  });

  it('FR-11: typing events carry the typist id and name to the other users', () => {
    const scheduler = newScheduler();
    scheduler.run(({ hot, cold, flush }) => {
      const ana = fakeClient(hot('a t', { a: ev.ana, t: ev.t }));
      const bruno = fakeClient(hot('b', { b: ev.bruno }));
      chatRoom(cold('(xy)', { x: ana.client, y: bruno.client })).subscribe();
      flush();

      const anaJoined = ana.sent[0];
      expect(anaJoined?.type).toBe('joined');
      const anaId = anaJoined?.type === 'joined' ? anaJoined.userId : '';
      expect(typingIn(bruno.sent)).toEqual([{ type: 'typing', userId: anaId, name: 'Ana' }]);
    });
  });

  it('FR-13: never echoes typing events back to the typist', () => {
    const scheduler = newScheduler();
    scheduler.run(({ hot, cold, flush }) => {
      const ana = fakeClient(hot('a t 600ms t', { a: ev.ana, t: ev.t }));
      const bruno = fakeClient(hot('b', { b: ev.bruno }));
      chatRoom(cold('(xy)', { x: ana.client, y: bruno.client })).subscribe();
      flush();

      expect(typingIn(ana.sent)).toEqual([]);
      expect(typingIn(bruno.sent)).toHaveLength(2);
    });
  });

  it('ignores typing events sent before joining (FR-08)', () => {
    const scheduler = newScheduler();
    scheduler.run(({ hot, cold, flush }) => {
      const ana = fakeClient(hot('t a', { a: ev.ana, t: ev.t }));
      const bruno = fakeClient(hot('b', { b: ev.bruno }));
      chatRoom(cold('(xy)', { x: ana.client, y: bruno.client })).subscribe();
      flush();

      expect(typingIn(bruno.sent)).toEqual([]);
    });
  });

  it('FR-12: a message after typing is still delivered to everyone, in order', () => {
    const scheduler = newScheduler();
    scheduler.run(({ hot, cold, flush }) => {
      const ana = fakeClient(hot('a t m', { a: ev.ana, t: ev.t, m: ev.m }));
      const bruno = fakeClient(hot('b', { b: ev.bruno }));
      chatRoom(cold('(xy)', { x: ana.client, y: bruno.client })).subscribe();
      flush();

      expect(bruno.sent.map((event) => event.type)).toEqual(['joined', 'typing', 'message']);
      expect(messagesIn(ana.sent)).toHaveLength(1);
    });
  });

  it('stops relaying a user typing once their connection closes', () => {
    const scheduler = newScheduler();
    scheduler.run(({ hot, cold, flush }) => {
      const ana = fakeClient(hot('a - - 600ms t', { a: ev.ana, t: ev.t }), hot('- c', { c: undefined }));
      const bruno = fakeClient(hot('b', { b: ev.bruno }));
      chatRoom(cold('(xy)', { x: ana.client, y: bruno.client })).subscribe();
      flush();

      expect(typingIn(bruno.sent)).toEqual([]);
    });
  });
});

describe('chatRoom – base app still works', () => {
  it('FR-03: broadcasts each message to every user, including the sender', () => {
    const scheduler = newScheduler();
    scheduler.run(({ hot, cold, flush }) => {
      const ana = fakeClient(hot('a m', { a: ev.ana, m: ev.m }));
      const bruno = fakeClient(hot('b', { b: ev.bruno }));
      chatRoom(cold('(xy)', { x: ana.client, y: bruno.client })).subscribe();
      flush();

      for (const { sent } of [ana, bruno]) {
        expect(messagesIn(sent)).toHaveLength(1);
        expect(messagesIn(sent)[0]).toMatchObject({ message: { author: 'Ana', text: 'oi' } });
      }
    });
  });

  it('FR-07: a late joiner gets no history', () => {
    const scheduler = newScheduler();
    scheduler.run(({ hot, cold, flush }) => {
      const ana = fakeClient(hot('a m', { a: ev.ana, m: ev.m }));
      const bruno = fakeClient(hot('- - - b', { b: ev.bruno }));
      chatRoom(cold('(xy)', { x: ana.client, y: bruno.client })).subscribe();
      flush();

      expect(bruno.sent.map((event) => event.type)).toEqual(['joined']);
    });
  });
});
