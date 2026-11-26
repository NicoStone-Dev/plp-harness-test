import { describe, expect, it } from 'vitest';
import { unreadLabel } from './unread';

describe('unreadLabel (FR-16)', () => {
  it('is empty at 0', () => {
    expect(unreadLabel(0)).toBe('');
  });

  it('uses the singular for 1 and the plural for more', () => {
    expect(unreadLabel(1)).toBe('1 nova mensagem');
    expect(unreadLabel(2)).toBe('2 novas mensagens');
    expect(unreadLabel(12)).toBe('12 novas mensagens');
  });
});
