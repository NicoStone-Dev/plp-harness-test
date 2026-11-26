import { describe, expect, it } from 'vitest';
import { typingParts, typingText, unreadLabel } from './indicators';

describe('typingText (FR-11)', () => {
  it('is empty when nobody is typing', () => {
    expect(typingText([])).toBe('');
    expect(typingParts([])).toEqual([]);
  });

  it('one name', () => {
    expect(typingText(['Ana'])).toBe('Ana está digitando…');
  });

  it('two names', () => {
    expect(typingText(['Ana', 'Bruno'])).toBe('Ana e Bruno estão digitando…');
  });

  it('three names', () => {
    expect(typingText(['Ana', 'Bruno', 'Carla'])).toBe('Ana, Bruno e Carla estão digitando…');
  });

  it('marks only the names as bold parts', () => {
    expect(typingParts(['Ana', 'Bruno'])).toEqual([
      { text: 'Ana', name: true },
      { text: ' e ', name: false },
      { text: 'Bruno', name: true },
      { text: ' estão digitando…', name: false },
    ]);
  });
});

describe('unreadLabel (FR-16)', () => {
  it('singular for 1', () => {
    expect(unreadLabel(1)).toBe('1 nova mensagem');
  });

  it('plural for N', () => {
    expect(unreadLabel(2)).toBe('2 novas mensagens');
    expect(unreadLabel(12)).toBe('12 novas mensagens');
  });
});
