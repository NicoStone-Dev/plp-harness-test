import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { WebSocket, WebSocketServer } from 'ws';
import type { Subscription } from 'rxjs';
import { parseClientEvent, parseServerEvent, type ServerEvent } from '../src/domain/events.js';
import { chatRoom, TYPING_THROTTLE_MS } from '../src/streams/chat-room.js';
import { connection$ } from '../src/streams/socket.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A test client that records every server event it receives. */
interface Client {
  readonly socket: WebSocket;
  readonly events: ServerEvent[];
  readonly userId: string;
  send(raw: unknown): void;
  typingFrom(): string[];
}

let server: WebSocketServer;
let room: Subscription;
let url: string;
const clients: WebSocket[] = [];

before(async () => {
  server = new WebSocketServer({ port: 0 });
  room = chatRoom(connection$(server)).subscribe();
  await new Promise<void>((resolve) => server.once('listening', resolve));
  url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  for (const socket of clients) socket.terminate();
  room.unsubscribe();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function join(name: string): Promise<Client> {
  const socket = new WebSocket(url);
  clients.push(socket);
  const events: ServerEvent[] = [];
  socket.on('message', (data) => {
    const event = parseServerEvent(data.toString());
    if (event) events.push(event);
  });
  await new Promise((resolve) => socket.once('open', resolve));
  socket.send(JSON.stringify({ type: 'join', name }));
  while (!events.some((e) => e.type === 'joined')) await sleep(5);
  const joined = events.find((e) => e.type === 'joined');
  assert.ok(joined && joined.type === 'joined');
  return {
    socket,
    events,
    userId: joined.userId,
    send: (raw) => socket.send(typeof raw === 'string' ? raw : JSON.stringify(raw)),
    typingFrom: () => events.flatMap((e) => (e.type === 'typing' ? [e.name] : [])),
  };
}

describe('protocol: typing event', () => {
  it('parses a client typing event', () => {
    assert.deepEqual(parseClientEvent('{"type":"typing"}'), { type: 'typing' });
  });

  it('parses a server typing event and rejects malformed ones', () => {
    assert.deepEqual(parseServerEvent('{"type":"typing","userId":"u1","name":"Ana"}'), {
      type: 'typing',
      userId: 'u1',
      name: 'Ana',
    });
    assert.equal(parseServerEvent('{"type":"typing","userId":"u1"}'), null);
    assert.equal(parseServerEvent('{"type":"typing","userId":1,"name":"Ana"}'), null);
  });
});

describe('chat room: typing', () => {
  it('relays typing to the other users with the sender name and id (FR-10, FR-11)', async () => {
    const ana = await join('Ana');
    const bruno = await join('Bruno');

    ana.send({ type: 'typing' });
    await sleep(50);

    const typing = bruno.events.filter((e) => e.type === 'typing');
    assert.deepEqual(typing, [{ type: 'typing', userId: ana.userId, name: 'Ana' }]);
  });

  it('never sends a user their own typing event (FR-13)', async () => {
    const ana = await join('Ana');
    await join('Bruno');

    ana.send({ type: 'typing' });
    await sleep(50);

    assert.deepEqual(ana.typingFrom(), []);
  });

  it('forwards at most one typing event per 500 ms per user, even when flooded (FR-10)', async () => {
    const carla = await join('Carla');
    const dani = await join('Dani');

    for (let i = 0; i < 20; i++) carla.send({ type: 'typing' });
    await sleep(50);
    assert.deepEqual(dani.typingFrom(), ['Carla']);

    await sleep(TYPING_THROTTLE_MS);
    carla.send({ type: 'typing' });
    await sleep(50);
    assert.deepEqual(dani.typingFrom(), ['Carla', 'Carla']);
  });

  it('throttles each user independently', async () => {
    const eva = await join('Eva');
    const fabio = await join('Fabio');
    const gil = await join('Gil');

    eva.send({ type: 'typing' });
    fabio.send({ type: 'typing' });
    await sleep(50);

    assert.deepEqual(gil.typingFrom().filter((n) => n === 'Eva' || n === 'Fabio').sort(), [
      'Eva',
      'Fabio',
    ]);
  });

  it('ignores typing before joining and keeps working after invalid frames (FR-08)', async () => {
    const watcher = await join('Hugo');

    const socket = new WebSocket(url);
    clients.push(socket);
    await new Promise((resolve) => socket.once('open', resolve));
    socket.send(JSON.stringify({ type: 'typing' }));
    socket.send('not json');
    socket.send(JSON.stringify({ type: 'typing', extra: { nested: true } }));
    await sleep(50);
    assert.deepEqual(watcher.typingFrom(), []);

    // The room still works.
    const ivo = await join('Ivo');
    ivo.send({ type: 'typing' });
    ivo.send({ type: 'message', text: 'oi' });
    await sleep(50);
    assert.deepEqual(watcher.typingFrom(), ['Ivo']);
    assert.ok(watcher.events.some((e) => e.type === 'message' && e.message.text === 'oi'));
  });
});
