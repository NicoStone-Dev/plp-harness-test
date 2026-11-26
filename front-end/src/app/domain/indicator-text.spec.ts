import { describe, expect, it } from 'vitest';
import { typingLabel, typingParts, unreadLabel } from './indicator-text';

describe('typingLabel (FR-11)', () => {
  it('is empty when nobody is typing', () => {
    expect(typingLabel([])).toBe('');
    expect(typingParts([])).toEqual([]);
  });

  it('formats one, two and three names', () => {
    expect(typingLabel(['Ana'])).toBe('Ana está digitando…');
    expect(typingLabel(['Ana', 'Bruno'])).toBe('Ana e Bruno estão digitando…');
    expect(typingLabel(['Ana', 'Bruno', 'Carla'])).toBe('Ana, Bruno e Carla estão digitando…');
  });

  it('keeps going for more names', () => {
    expect(typingLabel(['Ana', 'Bruno', 'Carla', 'Davi'])).toBe('Ana, Bruno, Carla e Davi estão digitando…');
  });

  it('marks only the names as strong', () => {
    expect(typingParts(['Ana', 'Bruno'])).toEqual([
      { text: 'Ana', strong: true },
      { text: ' e ', strong: false },
      { text: 'Bruno', strong: true },
      { text: ' estão digitando…', strong: false },
    ]);
  });
});

describe('unreadLabel (FR-16)', () => {
  it('is empty at 0 (pill hidden)', () => {
    expect(unreadLabel(0)).toBe('');
    expect(unreadLabel(-1)).toBe('');
  });

  it('uses singular for 1 and plural otherwise', () => {
    expect(unreadLabel(1)).toBe('1 nova mensagem');
    expect(unreadLabel(2)).toBe('2 novas mensagens');
    expect(unreadLabel(12)).toBe('12 novas mensagens');
  });
});
