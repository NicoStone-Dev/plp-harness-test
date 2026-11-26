import { describe, expect, it } from 'vitest';
import {
  MESSAGE_MAX_LENGTH,
  NAME_MAX_LENGTH,
  normalizeName,
  normalizeText,
  parseClientEvent,
  parseServerEvent,
} from './events.js';

describe('normalizeName (FR-01)', () => {
  it('trims and accepts 1 to 20 characters', () => {
    expect(normalizeName('  Ana  ')).toBe('Ana');
    expect(normalizeName('x'.repeat(NAME_MAX_LENGTH))).toBe('x'.repeat(NAME_MAX_LENGTH));
  });

  it('rejects blank and too-long names', () => {
    expect(normalizeName('')).toBeNull();
    expect(normalizeName('   ')).toBeNull();
    expect(normalizeName('x'.repeat(NAME_MAX_LENGTH + 1))).toBeNull();
  });

  it('counts code points, not UTF-16 units', () => {
    expect(normalizeName('😀'.repeat(NAME_MAX_LENGTH))).not.toBeNull();
  });
});

describe('normalizeText (FR-02)', () => {
  it('trims and rejects blank or too-long text', () => {
    expect(normalizeText('  hi ')).toBe('hi');
    expect(normalizeText(' \n\t ')).toBeNull();
    expect(normalizeText('x'.repeat(MESSAGE_MAX_LENGTH))).not.toBeNull();
    expect(normalizeText('x'.repeat(MESSAGE_MAX_LENGTH + 1))).toBeNull();
  });
});

describe('parseClientEvent', () => {
  it('parses a typing event and ignores extra fields (FR-10)', () => {
    expect(parseClientEvent('{"type":"typing"}')).toEqual({ type: 'typing' });
    expect(parseClientEvent('{"type":"typing","name":"Mallory","userId":"x"}')).toEqual({ type: 'typing' });
  });

  it('parses valid join and message events, normalized', () => {
    expect(parseClientEvent('{"type":"join","name":" Ana "}')).toEqual({ type: 'join', name: 'Ana' });
    expect(parseClientEvent('{"type":"message","text":" hi "}')).toEqual({
      type: 'message',
      text: 'hi',
    });
  });

  // R8: bad input is parsed to null, never thrown.
  it.each([
    ['not json', '{oops'],
    ['empty string', ''],
    ['null', 'null'],
    ['array', '[1,2]'],
    ['number', '42'],
    ['unknown type', '{"type":"hack"}'],
    ['missing name', '{"type":"join"}'],
    ['non-string name', '{"type":"join","name":7}'],
    ['blank name', '{"type":"join","name":"   "}'],
    ['blank text', '{"type":"message","text":"  "}'],
    ['too-long text', JSON.stringify({ type: 'message', text: 'x'.repeat(1001) })],
    ['typing with wrong case', '{"type":"Typing"}'],
    ['typing as a bare string', '"typing"'],
  ])('returns null for %s (R8)', (_label, raw) => {
    expect(() => parseClientEvent(raw)).not.toThrow();
    expect(parseClientEvent(raw)).toBeNull();
  });
});

describe('parseServerEvent', () => {
  const message = { id: 'm1', authorId: 'u1', author: 'Ana', text: 'hi', sentAt: 1 };

  it('parses a valid typing event (FR-11)', () => {
    expect(parseServerEvent('{"type":"typing","userId":"u2","name":"Bruno"}')).toEqual({
      type: 'typing',
      userId: 'u2',
      name: 'Bruno',
    });
  });

  it('parses valid joined and message events', () => {
    expect(parseServerEvent('{"type":"joined","userId":"u1","name":"Ana"}')).toEqual({
      type: 'joined',
      userId: 'u1',
      name: 'Ana',
    });
    expect(parseServerEvent(JSON.stringify({ type: 'message', message }))).toEqual({
      type: 'message',
      message,
    });
  });

  it.each([
    ['not json', '<html>'],
    ['joined without userId', '{"type":"joined","name":"Ana"}'],
    ['message without body', '{"type":"message"}'],
    ['unknown type', '{"type":"kick","userId":"u1"}'],
    ['typing without userId', '{"type":"typing","name":"Ana"}'],
    ['typing without name', '{"type":"typing","userId":"u1"}'],
    ['typing with non-string name', '{"type":"typing","userId":"u1","name":5}'],
    ['non-finite sentAt', JSON.stringify({ type: 'message', message: { ...message, sentAt: 'x' } })],
  ])('returns null for %s (R8)', (_label, raw) => {
    expect(parseServerEvent(raw)).toBeNull();
  });
});
