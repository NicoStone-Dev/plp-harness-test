import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Subscription } from 'rxjs';
import { WebSocket, WebSocketServer } from 'ws';
import { parseServerEvent, type ClientEvent, type ServerEvent } from '../domain/events.js';
import { chatRoom } from './chat-room.js';
import { chatClient$ } from './socket.js';

/** A real `ws` client that records every valid server event it receives. */
class TestUser {
  readonly received: ServerEvent[] = [];
  private constructor(readonly socket: WebSocket) {
    socket.on('message', (data) => {
      const event = parseServerEvent(data.toString());
      if (event) this.received.push(event);
    });
  }

  static async join(port: number, name: string): Promise<TestUser> {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    const user = new TestUser(socket);
    await new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    user.send({ type: 'join', name });
    await user.waitFor((event) => event.type === 'joined');
    return user;
  }

  send(event: ClientEvent | string): void {
    this.socket.send(typeof event === 'string' ? event : JSON.stringify(event));
  }

  waitFor(match: (event: ServerEvent) => boolean, timeoutMs = 2000): Promise<ServerEvent> {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const poll = () => {
        const found = this.received.find(match);
        if (found) return resolve(found);
        if (Date.now() - started > timeoutMs) return reject(new Error('timed out waiting for event'));
        setTimeout(poll, 5);
      };
      poll();
    });
  }
}

describe('server over real WebSockets', () => {
  let server: WebSocketServer;
  let room: Subscription;
  let port: number;
  const users: TestUser[] = [];

  beforeEach(async () => {
    server = new WebSocketServer({ port: 0, maxPayload: 64 * 1024 });
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    port = typeof address === 'object' && address !== null ? address.port : 0;
    room = chatRoom(chatClient$(server)).subscribe();
  });

  afterEach(async () => {
    for (const user of users.splice(0)) user.socket.close();
    room.unsubscribe();
    await new Promise((resolve) => server.close(resolve));
  });

  it('FR-11 / FR-13: relays typing to the others, not back to the typist', async () => {
    const ana = await TestUser.join(port, 'Ana');
    const bruno = await TestUser.join(port, 'Bruno');
    users.push(ana, bruno);

    ana.send({ type: 'typing' });
    const typing = await bruno.waitFor((event) => event.type === 'typing');
    expect(typing).toMatchObject({ type: 'typing', name: 'Ana' });

    // A message afterwards proves Ana's socket has processed everything before it.
    ana.send({ type: 'message', text: 'oi' });
    await ana.waitFor((event) => event.type === 'message');
    expect(ana.received.some((event) => event.type === 'typing')).toBe(false);
  });

  it('FR-08: invalid frames are ignored and the server keeps working', async () => {
    const ana = await TestUser.join(port, 'Ana');
    const bruno = await TestUser.join(port, 'Bruno');
    users.push(ana, bruno);

    ana.send('not json');
    ana.send('{"type":"typing","name":"Eve"}');
    ana.socket.send(Buffer.from([1, 2, 3]), { binary: true });
    ana.send({ type: 'message', text: '  oi  ' });

    const message = await bruno.waitFor((event) => event.type === 'message');
    expect(message).toMatchObject({ message: { author: 'Ana', text: 'oi' } });
    const typing = bruno.received.filter((event) => event.type === 'typing');
    expect(typing).toEqual([expect.objectContaining({ name: 'Ana' })]);
  });
});
