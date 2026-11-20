import { describe, expect, it } from 'vitest';
import type { ChatMessage } from './events';
import { initialOf, toMessageView, toneOf } from './message-view';

const message: ChatMessage = { id: 'm1', authorId: 'u1', author: 'ana', text: 'oi', sentAt: 5 };

describe('toMessageView (FR-04)', () => {
  it('marks own messages by comparing the author id with the current user id', () => {
    expect(toMessageView(message, 'u1').own).toBe(true);
    expect(toMessageView(message, 'u2').own).toBe(false);
  });

  it('copies the message fields and adds avatar data', () => {
    expect(toMessageView(message, 'u2')).toEqual({
      id: 'm1',
      author: 'ana',
      text: 'oi',
      sentAt: 5,
      own: false,
      initial: 'A',
      tone: toneOf('ana'),
    });
  });
});

describe('initialOf', () => {
  it('upper-cases the first code point', () => {
    expect(initialOf('bruno')).toBe('B');
    expect(initialOf('😀x')).toBe('😀');
    expect(initialOf('')).toBe('?');
  });
});

describe('toneOf', () => {
  it('is stable per name (pinned to current values)', () => {
    expect(toneOf('Ana')).toBe(toneOf('Ana'));
    expect([toneOf('Ana'), toneOf('Bruno'), toneOf('Carla')]).toEqual(['blue', 'pink', 'green']);
  });
});
