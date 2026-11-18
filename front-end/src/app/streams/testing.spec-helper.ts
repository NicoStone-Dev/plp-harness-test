import { TestScheduler } from 'rxjs/testing';
import type { ChatMessage, ServerEvent } from '../domain/events';

/** A TestScheduler whose assertions go through vitest. */
export function testScheduler(): TestScheduler {
  return new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
}

export const joined = (userId: string, name = 'Me'): ServerEvent => ({ type: 'joined', userId, name });

export const typing = (userId: string, name: string): ServerEvent => ({ type: 'typing', userId, name });

export function chatMessage(authorId: string, author: string, text = 'oi'): ChatMessage {
  return { id: `${authorId}-${text}`, authorId, author, text, sentAt: 0 };
}

export const said = (authorId: string, author: string, text = 'oi'): ServerEvent => ({
  type: 'message',
  message: chatMessage(authorId, author, text),
});
