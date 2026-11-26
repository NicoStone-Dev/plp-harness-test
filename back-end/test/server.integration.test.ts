import { firstValueFrom, filter, map, take, toArray, timer, type Subscription } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { parseServerEvent, type ClientEvent, type ServerEvent } from '../src/domain/events.js';
import { chatRoom } from '../src/streams/chat-room.js';
import { chatClient$, fromEmitter } from '../src/streams/socket.js';

let server: WebSocketServer;
let room: Subscription;
const sockets: WebSocket[] = [];

beforeEach(async () => {
  server = new WebSocketServer({ port: 0, maxPayload: 64 * 1024 });
  room = chatRoom(chatClient$(server)).subscribe();
  await firstValueFrom(fromEmitter(server, 'listening', () => undefined));
});

afterEach(async () => {
  sockets.splice(0).forEach((socket) => socket.terminate());
  room.unsubscribe();
  await new Promise((resolve) => server.close(resolve));
});

/** Opens a real socket, joins, and resolves once the join is acknowledged. */
async function connect(name: string) {
  const { port } = server.address() as { port: number };
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  sockets.push(socket);
  const event$ = fromEmitter(socket, 'message', (data: Buffer) => parseServerEvent(data.toString('utf8'))).pipe(
    filter((event): event is ServerEvent => event !== null),
  );
  const joined = firstValueFrom(event$.pipe(filter((event) => event.type === 'joined')));
  await firstValueFrom(fromEmitter(socket, 'open', () => undefined));
  const send = (event: ClientEvent | string) => socket.send(typeof event === 'string' ? event : JSON.stringify(event));
  send({ type: 'join', name });
  await joined;
  return { event$, send };
}

describe('server over real WebSockets – typing', () => {
  it('FR-11 / FR-13: relays typing to the others only, and survives invalid typing frames (FR-08)', async () => {
    const ana = await connect('Ana');
    const bruno = await connect('Bruno');

    const anaSaw = firstValueFrom(ana.event$.pipe(map((e) => e.type), take(1), toArray()));
    const brunoSaw = firstValueFrom(bruno.event$.pipe(take(2), toArray()));

    ana.send('{"type":"typing"'); // broken JSON: ignored
    ana.send({ type: 'typing' });
    ana.send({ type: 'message', text: 'oi' });

    const [first, second] = await brunoSaw;
    expect(first).toEqual(expect.objectContaining({ type: 'typing', name: 'Ana' }));
    expect(second).toEqual(expect.objectContaining({ type: 'message' }));
    // Ana only gets her own message back, never her own typing notice.
    expect(await anaSaw).toEqual(['message']);
  });

  it('FR-10: a client flooding typing events is relayed at most once per 500 ms', async () => {
    const ana = await connect('Ana');
    const bruno = await connect('Bruno');

    const seen: number[] = [];
    const sub = bruno.event$.pipe(filter((e) => e.type === 'typing')).subscribe(() => seen.push(Date.now()));
    for (let i = 0; i < 10; i++) {
      ana.send({ type: 'typing' });
      await firstValueFrom(timer(50));
    }
    await firstValueFrom(timer(100));
    sub.unsubscribe();

    // 10 events over ~500 ms: the first is relayed, the rest fall inside the 500 ms window
    // (at most one more if the loop ran slow and crossed into a second window).
    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(seen.length).toBeLessThanOrEqual(2);
    if (seen.length === 2) expect(seen[1]! - seen[0]!).toBeGreaterThanOrEqual(450);
  });
});
