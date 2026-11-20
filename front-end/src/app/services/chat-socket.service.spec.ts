import { TestBed } from '@angular/core/testing';
import { firstValueFrom, take, toArray } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSocketService } from './chat-socket.service';

/** Minimal browser WebSocket stand-in used by rxjs/webSocket. */
class FakeWebSocket {
  static last: FakeWebSocket | undefined;
  static readonly OPEN = 1;
  readonly sent: string[] = [];
  readyState = 0;
  binaryType = 'blob';
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.last = this;
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.readyState = 3;
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }
  receive(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe('ChatSocketService', () => {
  beforeEach(() => {
    FakeWebSocket.last = undefined;
    vi.stubGlobal('WebSocket', FakeWebSocket);
    TestBed.configureTestingModule({});
  });

  afterEach(() => vi.unstubAllGlobals());

  it('opens lazily and sends join as the first frame', async () => {
    const connection = TestBed.inject(ChatSocketService).connect('Ana');
    expect(FakeWebSocket.last).toBeUndefined();

    const first = firstValueFrom(connection.event$);
    const socket = FakeWebSocket.last as unknown as FakeWebSocket;
    socket.open();
    connection.send({ type: 'message', text: 'oi' });
    socket.receive('{"type":"joined","userId":"u1","name":"Ana"}');

    expect(await first).toEqual({ type: 'joined', userId: 'u1', name: 'Ana' });
    expect(socket.sent.map((f) => JSON.parse(f))).toEqual([
      { type: 'join', name: 'Ana' },
      { type: 'message', text: 'oi' },
    ]);
  });

  it('drops invalid frames without ending the stream (R8, FR-08)', async () => {
    const connection = TestBed.inject(ChatSocketService).connect('Ana');
    const events = firstValueFrom(connection.event$.pipe(take(2), toArray()));
    const socket = FakeWebSocket.last as unknown as FakeWebSocket;
    socket.open();

    socket.receive('{not json');
    socket.receive(new ArrayBuffer(4));
    socket.receive('{"type":"unknown"}');
    socket.receive('{"type":"message","message":{"id":1}}');
    socket.receive('{"type":"joined","userId":"u1","name":"Ana"}');
    socket.receive('null');
    socket.receive(
      JSON.stringify({ type: 'message', message: { id: 'm', authorId: 'u2', author: 'Bia', text: 'oi', sentAt: 1 } }),
    );

    expect(await events).toEqual([
      { type: 'joined', userId: 'u1', name: 'Ana' },
      { type: 'message', message: { id: 'm', authorId: 'u2', author: 'Bia', text: 'oi', sentAt: 1 } },
    ]);
  });

  it('ends the stream quietly when the connection fails', async () => {
    const connection = TestBed.inject(ChatSocketService).connect('Ana');
    const all = firstValueFrom(connection.event$.pipe(toArray()));
    const socket = FakeWebSocket.last as unknown as FakeWebSocket;
    socket.onerror?.(new Event('error'));
    expect(await all).toEqual([]);
  });
});
