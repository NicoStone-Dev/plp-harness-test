import { describe, expect, it } from 'vitest';
import { isTypingKey, typingParts, typingText } from './typing';

describe('typingText (FR-11)', () => {
  it('is empty when nobody is typing', () => {
    expect(typingText([])).toBe('');
    expect(typingParts([])).toEqual([]);
  });

  it('formats one, two and three names', () => {
    expect(typingText(['Ana'])).toBe('Ana está digitando…');
    expect(typingText(['Ana', 'Bruno'])).toBe('Ana e Bruno estão digitando…');
    expect(typingText(['Ana', 'Bruno', 'Carla'])).toBe('Ana, Bruno e Carla estão digitando…');
  });

  it('keeps the same pattern for more names', () => {
    expect(typingText(['Ana', 'Bruno', 'Carla', 'Davi'])).toBe('Ana, Bruno, Carla e Davi estão digitando…');
  });
});

describe('typingParts (FR-11)', () => {
  it('marks names so they can be rendered bold', () => {
    expect(typingParts(['Ana', 'Bruno'])).toEqual([
      { text: 'Ana', isName: true },
      { text: ' e ', isName: false },
      { text: 'Bruno', isName: true },
      { text: ' estão digitando…', isName: false },
    ]);
  });
});

describe('isTypingKey (FR-10)', () => {
  it('counts printable characters and editing keys', () => {
    for (const key of ['a', 'Z', ' ', 'ç', '😀', 'Backspace', 'Delete', 'Unidentified', 'Process']) {
      expect(isTypingKey(key, false)).toBe(true);
    }
  });

  it('ignores Enter, navigation, modifiers and shortcuts', () => {
    for (const key of ['Enter', 'Tab', 'ArrowLeft', 'Shift', 'Escape', '', 'F5']) {
      expect(isTypingKey(key, false)).toBe(false);
    }
    expect(isTypingKey('c', true)).toBe(false);
  });
});
