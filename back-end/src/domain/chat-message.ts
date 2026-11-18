import { randomUUID } from 'node:crypto';
import type { ChatMessage } from './events.js';

/** Stamps a validated message with an id and the server time. */
export function createMessage(authorId: string, author: string, text: string): ChatMessage {
  return { id: randomUUID(), authorId, author, text, sentAt: Date.now() };
}
