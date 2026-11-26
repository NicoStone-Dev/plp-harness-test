import { nameSeparator, typingText, unreadText } from './indicator-text';

describe('typingText (FR-11)', () => {
  it('is empty when nobody is typing', () => {
    expect(typingText([])).toBe('');
  });

  it('FR-11: one name', () => {
    expect(typingText(['Ana'])).toBe('Ana está digitando…');
  });

  it('FR-11: two names', () => {
    expect(typingText(['Ana', 'Bruno'])).toBe('Ana e Bruno estão digitando…');
  });

  it('FR-11: three names', () => {
    expect(typingText(['Ana', 'Bruno', 'Carla'])).toBe('Ana, Bruno e Carla estão digitando…');
  });

  it('FR-11: more than three names keeps the same pattern', () => {
    expect(typingText(['Ana', 'Bruno', 'Carla', 'Davi'])).toBe(
      'Ana, Bruno, Carla e Davi estão digitando…',
    );
  });

  it('nameSeparator puts " e " before the last name and ", " elsewhere', () => {
    expect([0, 1, 2].map((i) => nameSeparator(i, 3))).toEqual([', ', ' e ', '']);
  });
});

describe('unreadText (FR-16)', () => {
  it('FR-16: singular', () => {
    expect(unreadText(1)).toBe('1 nova mensagem');
  });

  it('FR-16: plural', () => {
    expect(unreadText(2)).toBe('2 novas mensagens');
    expect(unreadText(12)).toBe('12 novas mensagens');
  });
});
