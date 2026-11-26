/** One piece of the typing indicator line; names are rendered in bold. */
export interface TypingPart {
  readonly text: string;
  readonly name: boolean;
}

/**
 * FR-11: "Ana está digitando…", "Ana e Bruno estão digitando…",
 * "Ana, Bruno e Carla estão digitando…". Empty when nobody is typing.
 */
export function typingParts(names: readonly string[]): readonly TypingPart[] {
  if (names.length === 0) return [];
  const parts: TypingPart[] = [];
  names.forEach((name, index) => {
    if (index > 0) parts.push({ text: index === names.length - 1 ? ' e ' : ', ', name: false });
    parts.push({ text: name, name: true });
  });
  parts.push({ text: names.length === 1 ? ' está digitando…' : ' estão digitando…', name: false });
  return parts;
}

/** The indicator line as plain text. */
export function typingText(names: readonly string[]): string {
  return typingParts(names)
    .map((part) => part.text)
    .join('');
}
