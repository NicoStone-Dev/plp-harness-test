import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ClientEvent, ServerEvent } from '../../domain/events';
import { chatSession, type ChatSession } from '../../streams/chat-session';
import { ChatRoom } from './chat-room';

describe('ChatRoom', () => {
  let fixture: ComponentFixture<ChatRoom>;
  let server$: Subject<ServerEvent>;
  let sent: ClientEvent[];
  let session: ChatSession;

  beforeEach(async () => {
    server$ = new Subject<ServerEvent>();
    sent = [];
    session = chatSession('Ana', { event$: server$.asObservable(), send: (e) => sent.push(e) });
    fixture = TestBed.createComponent(ChatRoom);
    fixture.componentRef.setInput('session', session);
    await fixture.whenStable();
  });

  const el = (selector: string) => fixture.nativeElement.querySelector(selector);
  const all = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));

  async function typeAndSend(text: string): Promise<void> {
    const input = el('input') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    (el('button[type=submit]') as HTMLButtonElement).click();
    await fixture.whenStable();
  }

  it('sends trimmed text and clears the input (FR-02)', async () => {
    await typeAndSend('  oi  ');
    expect(sent).toEqual([{ type: 'message', text: 'oi' }]);
    expect((el('input') as HTMLInputElement).value).toBe('');
  });

  it('does not send blank text and keeps the input (FR-02)', async () => {
    await typeAndSend('   ');
    expect(sent).toEqual([]);
    expect((el('input') as HTMLInputElement).value).toBe('   ');
  });

  it('renders own messages on the right and others with their name (FR-03, FR-04)', async () => {
    server$.next({ type: 'joined', userId: 'me', name: 'Ana' });
    server$.next({ type: 'message', message: { id: '1', authorId: 'x', author: 'Bruno', text: 'oi', sentAt: 0 } });
    server$.next({ type: 'message', message: { id: '2', authorId: 'me', author: 'Ana', text: 'olá', sentAt: 0 } });
    await fixture.whenStable();

    const items = all('li.message');
    expect(items.map((li) => li.classList.contains('own'))).toEqual([false, true]);
    expect(items[0]?.querySelector('.author')?.textContent).toBe('Bruno');
    expect(items[1]?.querySelector('.author')).toBeNull();
    expect(items.map((li) => li.querySelector('.bubble')?.textContent)).toEqual(['oi', 'olá']);
  });

  it('keeps the reserved indicator strip', () => {
    expect(el('.strip')).not.toBeNull();
  });
});
