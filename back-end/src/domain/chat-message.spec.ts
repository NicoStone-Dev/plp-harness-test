import { describe, expect, it } from 'vitest';
import { createMessage } from './chat-message.js';

describe('createMessage', () => {
  it('stamps the message with a unique id and the server time', () => {
    const before = Date.now();
    const a = createMessage('u1', 'Ana', 'hi');
    const b = createMessage('u1', 'Ana', 'hi');

    expect(a).toMatchObject({ authorId: 'u1', author: 'Ana', text: 'hi' });
    expect(a.id).not.toBe(b.id);
    expect(a.sentAt).toBeGreaterThanOrEqual(before);
    expect(a.sentAt).toBeLessThanOrEqual(Date.now());
  });
});
