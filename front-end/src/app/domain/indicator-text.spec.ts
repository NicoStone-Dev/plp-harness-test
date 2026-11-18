import { typingParts, typingText, unreadLabel } from './indicator-text';

describe('typing indicator text (FR-11)', () => {
  it('is empty when nobody is typing', () => {
    expect(typingText([])).toBe('');
    expect(typingParts([])).toEqual([]);
  });

  it('formats one, two and three names', () => {
    expect(typingText(['Ana'])).toBe('Ana está digitando…');
    expect(typingText(['Ana', 'Bruno'])).toBe('Ana e Bruno estão digitando…');
    expect(typingText(['Ana', 'Bruno', 'Carla'])).toBe('Ana, Bruno e Carla estão digitando…');
  });

  it('marks the names so they can be bold', () => {
    expect(typingParts(['Ana', 'Bruno'])).toEqual([
      { text: 'Ana', name: true },
      { text: ' e ', name: false },
      { text: 'Bruno', name: true },
      { text: ' estão digitando…', name: false },
    ]);
  });
});

describe('unread pill label (FR-16)', () => {
  it('uses singular and plural', () => {
    expect(unreadLabel(1)).toBe('1 nova mensagem');
    expect(unreadLabel(2)).toBe('2 novas mensagens');
    expect(unreadLabel(12)).toBe('12 novas mensagens');
  });
});
