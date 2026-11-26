/** A piece of indicator text; names are rendered bold (see docs/design/typing.png). */
export interface TextPart {
  readonly text: string;
  readonly strong: boolean;
}

/**
 * FR-11: "Ana está digitando…", "Ana e Bruno estão digitando…",
 * "Ana, Bruno e Carla estão digitando…". Empty when nobody is typing.
 */
export function typingParts(names: readonly string[]): readonly TextPart[] {
  if (names.length === 0) return [];
  const parts: TextPart[] = [];
  names.forEach((name, index) => {
    if (index > 0) parts.push({ text: index === names.length - 1 ? ' e ' : ', ', strong: false });
    parts.push({ text: name, strong: true });
  });
  parts.push({ text: names.length === 1 ? ' está digitando…' : ' estão digitando…', strong: false });
  return parts;
}

/** The indicator as plain text. */
export function typingLabel(names: readonly string[]): string {
  return typingParts(names)
    .map((part) => part.text)
    .join('');
}

/** FR-16: "1 nova mensagem" / "N novas mensagens"; empty at 0 (the pill is hidden). */
export function unreadLabel(count: number): string {
  if (count <= 0) return '';
  return count === 1 ? '1 nova mensagem' : `${count} novas mensagens`;
}
