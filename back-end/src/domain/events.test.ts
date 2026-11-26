import { describe, expect, it } from 'vitest';
import { parseClientEvent, parseServerEvent } from './events.js';

describe('parseClientEvent – typing (FR-10)', () => {
  it('accepts a typing event', () => {
    expect(parseClientEvent('{"type":"typing"}')).toEqual({ type: 'typing' });
  });

  it('drops extra fields a client tries to smuggle in (FR-08)', () => {
    expect(parseClientEvent('{"type":"typing","userId":"x","name":"Eve"}')).toEqual({ type: 'typing' });
  });

  it('still rejects non-objects and unknown types (FR-08)', () => {
    expect(parseClientEvent('"typing"')).toBeNull();
    expect(parseClientEvent('{"type":"typin"}')).toBeNull();
    expect(parseClientEvent('not json')).toBeNull();
  });
});

describe('parseServerEvent – typing (FR-11)', () => {
  it('accepts a typing event with userId and name', () => {
    expect(parseServerEvent('{"type":"typing","userId":"u1","name":"Ana"}')).toEqual({
      type: 'typing',
      userId: 'u1',
      name: 'Ana',
    });
  });

  it('rejects a typing event without userId or name', () => {
    expect(parseServerEvent('{"type":"typing","name":"Ana"}')).toBeNull();
    expect(parseServerEvent('{"type":"typing","userId":"u1"}')).toBeNull();
    expect(parseServerEvent('{"type":"typing","userId":1,"name":"Ana"}')).toBeNull();
  });
});
