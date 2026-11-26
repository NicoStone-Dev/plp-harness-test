/** One piece of the typing indicator text; names are rendered bold (docs/design/typing.png). */
export interface TypingPart {
  readonly text: string;
  readonly isName: boolean;
}

/**
 * FR-11: "Ana está digitando…", "Ana e Bruno estão digitando…",
 * "Ana, Bruno e Carla estão digitando…". Empty when nobody is typing.
 */
export function typingParts(names: readonly string[]): readonly TypingPart[] {
  if (names.length === 0) return [];
  const parts: TypingPart[] = [];
  names.forEach((name, index) => {
    if (index > 0) parts.push({ text: index === names.length - 1 ? ' e ' : ', ', isName: false });
    parts.push({ text: name, isName: true });
  });
  parts.push({ text: names.length === 1 ? ' está digitando…' : ' estão digitando…', isName: false });
  return parts;
}

/** The indicator as plain text. */
export function typingText(names: readonly string[]): string {
  return typingParts(names)
    .map((part) => part.text)
    .join('');
}

/**
 * FR-10: does this keydown edit the message text? Printable characters, Backspace
 * and Delete do; Enter (send), Tab, arrows and Ctrl/Cmd shortcuts do not.
 * 'Unidentified' / 'Process' come from mobile and IME keyboards while composing.
 */
export function isTypingKey(key: string, withShortcutModifier: boolean): boolean {
  if (withShortcutModifier) return false;
  return Array.from(key).length === 1 || EDITING_KEYS.has(key);
}

const EDITING_KEYS: ReadonlySet<string> = new Set(['Backspace', 'Delete', 'Unidentified', 'Process']);
