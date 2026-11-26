/**
 * FR-11: "Ana está digitando…", "Ana e Bruno estão digitando…",
 * "Ana, Bruno e Carla estão digitando…". Empty string when nobody is typing.
 */
export function typingText(names: readonly string[]): string {
  if (names.length === 0) return '';
  return `${joinNames(names)} ${typingVerb(names.length)}`;
}

/** Separator to render after the name at `index` in a list of `count` names. */
export function nameSeparator(index: number, count: number): string {
  if (index >= count - 1) return '';
  return index === count - 2 ? ' e ' : ', ';
}

export function typingVerb(count: number): string {
  return count === 1 ? 'está digitando…' : 'estão digitando…';
}

/** FR-16: "1 nova mensagem" / "N novas mensagens". */
export function unreadText(count: number): string {
  return count === 1 ? '1 nova mensagem' : `${count} novas mensagens`;
}

function joinNames(names: readonly string[]): string {
  return names.map((name, i) => name + nameSeparator(i, names.length)).join('');
}
