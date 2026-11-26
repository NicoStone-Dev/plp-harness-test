/** A piece of the typing sentence; names are rendered in bold (docs/design/typing.png). */
export interface TextPart {
  readonly text: string;
  readonly name: boolean;
}

/**
 * FR-11: "Ana está digitando…", "Ana e Bruno estão digitando…",
 * "Ana, Bruno e Carla estão digitando…". Empty when nobody is typing.
 */
export function typingParts(names: readonly string[]): readonly TextPart[] {
  if (names.length === 0) return [];
  const parts: TextPart[] = [];
  names.forEach((name, index) => {
    if (index > 0) parts.push({ text: index === names.length - 1 ? ' e ' : ', ', name: false });
    parts.push({ text: name, name: true });
  });
  parts.push({ text: names.length === 1 ? ' está digitando…' : ' estão digitando…', name: false });
  return parts;
}

export function typingText(names: readonly string[]): string {
  return typingParts(names)
    .map((part) => part.text)
    .join('');
}

/** FR-16: "1 nova mensagem" / "N novas mensagens". */
export function unreadLabel(count: number): string {
  return count === 1 ? '1 nova mensagem' : `${count} novas mensagens`;
}
