import { of } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { chatRoom } from '../src/streams/chat-room.js';
import { fakeClient, join, say, typing, typingSeen } from './fake-client.js';

let scheduler: TestScheduler;

beforeEach(() => {
  scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
});

describe('chat room – typing indicator (server)', () => {
  it('FR-11: relays a typing notice with the typist name to the other users', () => {
    scheduler.run(({ hot, flush }) => {
      const ana = fakeClient(scheduler, hot('a 9ms t', { a: join('Ana'), t: typing }));
      const bruno = fakeClient(scheduler, hot('b', { b: join('Bruno') }));
      chatRoom(of(ana, bruno)).subscribe();
      flush();

      expect(typingSeen(bruno)).toEqual(['Ana@10']);
      const notice = bruno.received.find(({ event }) => event.type === 'typing')?.event;
      const anaId = ana.received[0]?.event.type === 'joined' ? ana.received[0].event.userId : undefined;
      expect(notice).toEqual({ type: 'typing', userId: anaId, name: 'Ana' });
    });
  });

  it('FR-13: never sends a typing notice back to the user who typed', () => {
    scheduler.run(({ hot, flush }) => {
      const ana = fakeClient(scheduler, hot('a 9ms t 999ms t', { a: join('Ana'), t: typing }));
      const bruno = fakeClient(scheduler, hot('b 19ms t', { b: join('Bruno'), t: typing }));
      chatRoom(of(ana, bruno)).subscribe();
      flush();

      expect(typingSeen(ana)).toEqual(['Bruno@20']);
      expect(typingSeen(bruno)).toEqual(['Ana@10', 'Ana@1010']);
    });
  });

  it('FR-10: relays at most one typing notice per user every 500 ms', () => {
    scheduler.run(({ hot, flush }) => {
      // Ana's client floods typing events every 100 ms from t=10 to t=1210.
      const flood = 'a 9ms t' + ' 99ms t'.repeat(12);
      const ana = fakeClient(scheduler, hot(flood, { a: join('Ana'), t: typing }));
      const bruno = fakeClient(scheduler, hot('b', { b: join('Bruno') }));
      chatRoom(of(ana, bruno)).subscribe();
      flush();

      expect(typingSeen(bruno)).toEqual(['Ana@10', 'Ana@610', 'Ana@1210']);
    });
  });

  it('FR-10: the 500 ms limit is per user, not shared by the room', () => {
    scheduler.run(({ hot, flush }) => {
      const ana = fakeClient(scheduler, hot('a 9ms t', { a: join('Ana'), t: typing }));
      const bruno = fakeClient(scheduler, hot('b 10ms t', { b: join('Bruno'), t: typing }));
      const carla = fakeClient(scheduler, hot('c', { c: join('Carla') }));
      chatRoom(of(ana, bruno, carla)).subscribe();
      flush();

      expect(typingSeen(carla)).toEqual(['Ana@10', 'Bruno@11']);
    });
  });

  it('ignores typing events sent before joining', () => {
    scheduler.run(({ hot, flush }) => {
      const ana = fakeClient(scheduler, hot('t 9ms a', { a: join('Ana'), t: typing }));
      const bruno = fakeClient(scheduler, hot('b', { b: join('Bruno') }));
      chatRoom(of(ana, bruno)).subscribe();
      flush();

      expect(typingSeen(bruno)).toEqual([]);
    });
  });

  it('stops relaying typing notices once the typist disconnects', () => {
    scheduler.run(({ hot, flush }) => {
      const ana = fakeClient(
        scheduler,
        hot('a 9ms t 999ms t', { a: join('Ana'), t: typing }),
        hot('500ms c', { c: undefined }),
      );
      const bruno = fakeClient(scheduler, hot('b', { b: join('Bruno') }));
      chatRoom(of(ana, bruno)).subscribe();
      flush();

      expect(typingSeen(bruno)).toEqual(['Ana@10']);
    });
  });
});

describe('chat room – messages still work with typing (FR-03 / FR-12 support)', () => {
  it('broadcasts messages to every user, including the sender, in arrival order', () => {
    scheduler.run(({ hot, flush }) => {
      const ana = fakeClient(scheduler, hot('a 9ms t 9ms m', { a: join('Ana'), t: typing, m: say('oi') }));
      const bruno = fakeClient(scheduler, hot('b 29ms m', { b: join('Bruno'), m: say('olá') }));
      chatRoom(of(ana, bruno)).subscribe();
      flush();

      const texts = (client: typeof ana) =>
        client.received.flatMap(({ event }) => (event.type === 'message' ? [event.message.text] : []));
      expect(texts(ana)).toEqual(['oi', 'olá']);
      expect(texts(bruno)).toEqual(['oi', 'olá']);
      // The typing notice reaches Bruno before Ana's message, so the client can clear it (FR-12).
      expect(bruno.received.map(({ event }) => event.type)).toEqual(['joined', 'typing', 'message', 'message']);
    });
  });
});
