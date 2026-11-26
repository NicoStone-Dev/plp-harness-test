/** A piece of the typing indicator text; names are rendered bold (docs/design/typing.png). */
export interface TypingSegment {
  readonly text: string;
  readonly name: boolean;
}

/**
 * FR-11: "Ana está digitando…", "Ana e Bruno estão digitando…",
 * "Ana, Bruno e Carla estão digitando…". Empty when nobody is typing.
 */
export function typingSegments(names: readonly string[]): readonly TypingSegment[] {
  if (names.length === 0) return [];

  const segments: TypingSegment[] = [];
  names.forEach((name, index) => {
    if (index > 0) segments.push({ text: index === names.length - 1 ? ' e ' : ', ', name: false });
    segments.push({ text: name, name: true });
  });
  segments.push({ text: names.length === 1 ? ' está digitando…' : ' estão digitando…', name: false });
  return segments;
}

/** The indicator as plain text. */
export function typingLabel(names: readonly string[]): string {
  return typingSegments(names)
    .map((segment) => segment.text)
    .join('');
}
