import { describe, expect, it } from 'vitest';
import { parseClientEvent, parseServerEvent } from '../src/domain/events.js';

describe('protocol – typing events', () => {
  it('FR-10: parses a client typing event', () => {
    expect(parseClientEvent('{"type":"typing"}')).toEqual({ type: 'typing' });
  });

  it('FR-10: drops extra fields a client puts on a typing event (the server sets the name)', () => {
    expect(parseClientEvent('{"type":"typing","name":"Mallory","userId":"x"}')).toEqual({ type: 'typing' });
  });

  it('FR-11: parses a server typing event', () => {
    expect(parseServerEvent('{"type":"typing","userId":"u1","name":"Ana"}')).toEqual({
      type: 'typing',
      userId: 'u1',
      name: 'Ana',
    });
  });

  it('FR-08: rejects malformed server typing events', () => {
    expect(parseServerEvent('{"type":"typing","name":"Ana"}')).toBeNull();
    expect(parseServerEvent('{"type":"typing","userId":1,"name":"Ana"}')).toBeNull();
    expect(parseServerEvent('{"type":"typing","userId":"u1"}')).toBeNull();
  });

  it('FR-08: still rejects invalid frames and unknown types', () => {
    expect(parseClientEvent('not json')).toBeNull();
    expect(parseClientEvent('["typing"]')).toBeNull();
    expect(parseClientEvent('{"type":"typin"}')).toBeNull();
    expect(parseClientEvent('{"type":"message","text":"   "}')).toBeNull();
  });
});
