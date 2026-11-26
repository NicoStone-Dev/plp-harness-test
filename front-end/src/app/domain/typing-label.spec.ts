import { describe, expect, it } from 'vitest';
import { typingLabel, typingSegments } from './typing-label';

describe('typingLabel (FR-11)', () => {
  it('is empty when nobody is typing', () => {
    expect(typingLabel([])).toBe('');
    expect(typingSegments([])).toEqual([]);
  });

  it('uses the singular for one name', () => {
    expect(typingLabel(['Ana'])).toBe('Ana está digitando…');
  });

  it('joins two names with "e"', () => {
    expect(typingLabel(['Ana', 'Bruno'])).toBe('Ana e Bruno estão digitando…');
  });

  it('joins three or more names with commas and a final "e"', () => {
    expect(typingLabel(['Ana', 'Bruno', 'Carla'])).toBe('Ana, Bruno e Carla estão digitando…');
    expect(typingLabel(['Ana', 'Bruno', 'Carla', 'Dani'])).toBe('Ana, Bruno, Carla e Dani estão digitando…');
  });
});

describe('typingSegments (FR-11)', () => {
  it('marks exactly the names so they can be rendered bold', () => {
    expect(typingSegments(['Ana', 'Bruno'])).toEqual([
      { text: 'Ana', name: true },
      { text: ' e ', name: false },
      { text: 'Bruno', name: true },
      { text: ' estão digitando…', name: false },
    ]);
  });
});
