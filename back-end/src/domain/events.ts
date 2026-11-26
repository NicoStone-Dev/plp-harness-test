// Wire protocol shared by back-end and front-end.
// This file exists twice and the copies must stay identical:
//   back-end/src/domain/events.ts
//   front-end/src/app/domain/events.ts

export const NAME_MAX_LENGTH = 20;
export const MESSAGE_MAX_LENGTH = 1000;

export interface ChatMessage {
  readonly id: string;
  readonly authorId: string;
  readonly author: string;
  readonly text: string;
  /** Server clock, epoch milliseconds. */
  readonly sentAt: number;
}

/** Client -> server. */
export type ClientEvent =
  | { readonly type: 'join'; readonly name: string }
  | { readonly type: 'message'; readonly text: string }
  /** The user typed in the message box (FR-10). Carries no data. */
  | { readonly type: 'typing' };

/** Server -> client. */
export type ServerEvent =
  | { readonly type: 'joined'; readonly userId: string; readonly name: string }
  | { readonly type: 'message'; readonly message: ChatMessage }
  /** Another user is typing (FR-11). Never sent back to the typist (FR-13). */
  | { readonly type: 'typing'; readonly userId: string; readonly name: string };

/** Trimmed name if it has 1–20 characters, otherwise null. */
export function normalizeName(raw: string): string | null {
  const name = raw.trim();
  const length = Array.from(name).length;
  return length >= 1 && length <= NAME_MAX_LENGTH ? name : null;
}

/** Trimmed message text if it is not blank and not too long, otherwise null. */
export function normalizeText(raw: string): string | null {
  const text = raw.trim();
  const length = Array.from(text).length;
  return length >= 1 && length <= MESSAGE_MAX_LENGTH ? text : null;
}

/** Decodes a raw frame into a valid ClientEvent, or null if it is invalid. */
export function parseClientEvent(raw: string): ClientEvent | null {
  const data = decodeJson(raw);
  if (!isRecord(data)) return null;

  switch (data['type']) {
    case 'join': {
      const name = asString(data['name']);
      const normalized = name === null ? null : normalizeName(name);
      return normalized === null ? null : { type: 'join', name: normalized };
    }
    case 'message': {
      const text = asString(data['text']);
      const normalized = text === null ? null : normalizeText(text);
      return normalized === null ? null : { type: 'message', text: normalized };
    }
    case 'typing':
      return { type: 'typing' };
    default:
      return null;
  }
}

/** Decodes a raw frame into a valid ServerEvent, or null if it is invalid. */
export function parseServerEvent(raw: string): ServerEvent | null {
  const data = decodeJson(raw);
  if (!isRecord(data)) return null;

  switch (data['type']) {
    case 'joined': {
      const userId = asString(data['userId']);
      const name = asString(data['name']);
      return userId === null || name === null ? null : { type: 'joined', userId, name };
    }
    case 'message': {
      const message = asChatMessage(data['message']);
      return message === null ? null : { type: 'message', message };
    }
    case 'typing': {
      const userId = asString(data['userId']);
      const name = asString(data['name']);
      return userId === null || name === null ? null : { type: 'typing', userId, name };
    }
    default:
      return null;
  }
}

function asChatMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) return null;
  const id = asString(value['id']);
  const authorId = asString(value['authorId']);
  const author = asString(value['author']);
  const text = asString(value['text']);
  const sentAt = value['sentAt'];
  if (id === null || authorId === null || author === null || text === null) return null;
  if (typeof sentAt !== 'number' || !Number.isFinite(sentAt)) return null;
  return { id, authorId, author, text, sentAt };
}

function decodeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
