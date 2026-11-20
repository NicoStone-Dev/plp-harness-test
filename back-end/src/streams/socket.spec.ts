import { EventEmitter } from 'node:events';
import { firstValueFrom, lastValueFrom, take, toArray } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { clientEvent$, closed$, fromEmitter, toChatClient } from './socket.js';

/** Just enough of a `ws` socket for the adapters. */
class FakeSocket extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  readonly frames: string[] = [];
  send(frame: string): void {
    this.frames.push(frame);
  }
}

const asSocket = (fake: FakeSocket) => fake as unknown as WebSocket;
const frame = (value: unknown) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));

describe('fromEmitter', () => {
  it('maps listener arguments and removes the listener on unsubscribe', async () => {
    const emitter = new EventEmitter();
    const result = firstValueFrom(fromEmitter(emitter, 'x', (a: number, b: number) => a + b));
    expect(emitter.listenerCount('x')).toBe(1);
    emitter.emit('x', 2, 3);
    expect(await result).toBe(5);
    expect(emitter.listenerCount('x')).toBe(0);
  });
});

describe('clientEvent$ (R8, FR-08)', () => {
  it('drops binary frames, non-JSON and invalid events without ending the stream', async () => {
    const socket = new FakeSocket();
    const events = firstValueFrom(clientEvent$(asSocket(socket)).pipe(take(2), toArray()));

    socket.emit('message', frame('{not json'), false);
    socket.emit('message', frame({ type: 'join', name: 'Ana' }), true); // binary
    socket.emit('message', frame({ type: 'nope' }), false);
    socket.emit('message', frame({ type: 'message', text: '   ' }), false);
    socket.emit('message', frame({ type: 'join', name: ' Ana ' }), false);
    socket.emit('message', [frame('{"type":"mess'), frame('age","text":"hi"}')], false); // fragmented

    expect(await events).toEqual([
      { type: 'join', name: 'Ana' },
      { type: 'message', text: 'hi' },
    ]);
  });
});

describe('closed$', () => {
  it('emits once and completes', async () => {
    const socket = new FakeSocket();
    const closes = lastValueFrom(closed$(asSocket(socket)).pipe(toArray()));
    socket.emit('close');
    socket.emit('close');
    expect(await closes).toHaveLength(1);
  });
});

describe('toChatClient', () => {
  it('sends JSON only while the socket is open', () => {
    const socket = new FakeSocket();
    const client = toChatClient(asSocket(socket));

    client.send({ type: 'joined', userId: 'u1', name: 'Ana' });
    socket.readyState = WebSocket.CLOSED;
    client.send({ type: 'joined', userId: 'u1', name: 'Ana' });

    expect(socket.frames).toEqual(['{"type":"joined","userId":"u1","name":"Ana"}']);
  });
});
