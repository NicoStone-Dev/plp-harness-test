import { describe, expect, it } from 'vitest';
import { parseClientEvent, parseServerEvent } from '../src/domain/events.js';

describe('parseClientEvent', () => {
  it('FR-10: accepts a typing event', () => {
    expect(parseClientEvent('{"type":"typing"}')).toEqual({ type: 'typing' });
  });

  it('FR-10: drops extra fields from a typing event', () => {
    expect(parseClientEvent('{"type":"typing","name":"Ana","userId":"x"}')).toEqual({ type: 'typing' });
  });

  it('FR-08: still rejects invalid frames', () => {
    expect(parseClientEvent('not json')).toBeNull();
    expect(parseClientEvent('"typing"')).toBeNull();
    expect(parseClientEvent('["typing"]')).toBeNull();
    expect(parseClientEvent('{"type":"Typing"}')).toBeNull();
    expect(parseClientEvent('{"type":"message","text":"   "}')).toBeNull();
  });

  it('FR-01 / FR-02: still parses join and message', () => {
    expect(parseClientEvent('{"type":"join","name":"  Ana "}')).toEqual({ type: 'join', name: 'Ana' });
    expect(parseClientEvent('{"type":"message","text":" oi "}')).toEqual({ type: 'message', text: 'oi' });
  });
});

describe('parseServerEvent', () => {
  it('FR-11: accepts a typing event with userId and name', () => {
    expect(parseServerEvent('{"type":"typing","userId":"u1","name":"Ana"}')).toEqual({
      type: 'typing',
      userId: 'u1',
      name: 'Ana',
    });
  });

  it('FR-08: rejects a typing event without userId or name', () => {
    expect(parseServerEvent('{"type":"typing","name":"Ana"}')).toBeNull();
    expect(parseServerEvent('{"type":"typing","userId":"u1"}')).toBeNull();
    expect(parseServerEvent('{"type":"typing","userId":1,"name":"Ana"}')).toBeNull();
  });
});
