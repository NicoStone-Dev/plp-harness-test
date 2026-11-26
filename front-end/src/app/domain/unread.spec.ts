import { describe, expect, it } from 'vitest';
import { unreadLabel } from './unread';

describe('unreadLabel (FR-16)', () => {
  it('is hidden (null) at 0', () => {
    expect(unreadLabel(0)).toBeNull();
  });

  it('uses the singular for 1 and the plural for more', () => {
    expect(unreadLabel(1)).toBe('1 nova mensagem');
    expect(unreadLabel(2)).toBe('2 novas mensagens');
    expect(unreadLabel(13)).toBe('13 novas mensagens');
  });

  it('treats nonsense counts as nothing unread', () => {
    expect(unreadLabel(-1)).toBeNull();
    expect(unreadLabel(Number.NaN)).toBeNull();
  });
});
