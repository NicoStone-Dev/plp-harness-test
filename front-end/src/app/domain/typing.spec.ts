import { describe, expect, it } from 'vitest';
import { typingParts, typingText } from './typing';

describe('typingText (FR-11)', () => {
  it('is empty when nobody is typing', () => {
    expect(typingText([])).toBe('');
    expect(typingParts([])).toEqual([]);
  });

  it('uses the singular for one name', () => {
    expect(typingText(['Ana'])).toBe('Ana está digitando…');
  });

  it('joins two names with "e"', () => {
    expect(typingText(['Ana', 'Bruno'])).toBe('Ana e Bruno estão digitando…');
  });

  it('joins three or more names with commas and a final "e"', () => {
    expect(typingText(['Ana', 'Bruno', 'Carla'])).toBe('Ana, Bruno e Carla estão digitando…');
    expect(typingText(['Ana', 'Bruno', 'Carla', 'Davi'])).toBe('Ana, Bruno, Carla e Davi estão digitando…');
  });
});

describe('typingParts (FR-11)', () => {
  it('marks only the names, so they can be rendered in bold', () => {
    expect(typingParts(['Ana', 'Bruno'])).toEqual([
      { text: 'Ana', name: true },
      { text: ' e ', name: false },
      { text: 'Bruno', name: true },
      { text: ' estão digitando…', name: false },
    ]);
  });
});
