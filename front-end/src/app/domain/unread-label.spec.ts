import { describe, expect, it } from 'vitest';
import { unreadLabel } from './unread-label';

describe('unreadLabel (FR-16)', () => {
  it('is empty at 0 so the pill can be hidden', () => {
    expect(unreadLabel(0)).toBe('');
    expect(unreadLabel(-1)).toBe('');
  });

  it('uses the singular for one message', () => {
    expect(unreadLabel(1)).toBe('1 nova mensagem');
  });

  it('uses the plural for more than one', () => {
    expect(unreadLabel(2)).toBe('2 novas mensagens');
    expect(unreadLabel(12)).toBe('12 novas mensagens');
  });
});
