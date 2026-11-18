import type { ChatMessage } from './events';

/** A chat message as the UI renders it. */
export interface MessageView {
  readonly id: string;
  readonly author: string;
  readonly text: string;
  readonly sentAt: number;
  /** Sent by the current user: right side, accent bubble (FR-04). */
  readonly own: boolean;
  readonly initial: string;
  readonly tone: AvatarTone;
}

export type AvatarTone = 'blue' | 'pink' | 'green' | 'amber' | 'violet' | 'teal' | 'orange';

// Order chosen so the names in docs/design get their mockup colors (Ana, Bruno, Carla).
const TONES: readonly AvatarTone[] = ['amber', 'green', 'violet', 'teal', 'blue', 'orange', 'pink'];

export function toMessageView(message: ChatMessage, selfId: string): MessageView {
  return {
    id: message.id,
    author: message.author,
    text: message.text,
    sentAt: message.sentAt,
    own: message.authorId === selfId,
    initial: initialOf(message.author),
    tone: toneOf(message.author),
  };
}

export function initialOf(name: string): string {
  return (Array.from(name)[0] ?? '?').toUpperCase();
}

/** Stable color per name, so a user keeps the same avatar color everywhere. */
export function toneOf(name: string): AvatarTone {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return TONES[hash % TONES.length] ?? 'blue';
}
