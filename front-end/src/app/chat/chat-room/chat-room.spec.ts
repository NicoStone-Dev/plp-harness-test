import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  /** Only chat messages; typing pings (FR-10) are checked separately. */
  const sentMessages = () => sent.filter((e) => e.type === 'message');
  const sentTyping = () => sent.filter((e) => e.type === 'typing');
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
    expect(sentMessages()).toEqual([{ type: 'message', text: 'oi' }]);
    expect((el('input') as HTMLInputElement).value).toBe('');
  });

  it('does not send blank text and keeps the input (FR-02)', async () => {
    await typeAndSend('   ');
    expect(sentMessages()).toEqual([]);
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

  const joinedAs = (userId: string, name: string) => server$.next({ type: 'joined', userId, name });
  const typingFrom = (userId: string, name: string) => server$.next({ type: 'typing', userId, name });
  const messageFrom = (id: string, authorId: string, author: string) =>
    server$.next({ type: 'message', message: { id, authorId, author, text: `msg ${id}`, sentAt: 0 } });

  async function keystroke(value: string): Promise<void> {
    const input = el('input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  describe('typing indicator', () => {
    it('sends one typing event for a burst of keystrokes (FR-10)', async () => {
      await keystroke('o');
      await keystroke('oi');
      await keystroke('oi!');
      expect(sentTyping()).toEqual([{ type: 'typing' }]);
    });

    it('clearing the input after sending is not a keystroke (FR-10)', async () => {
      await typeAndSend('oi');
      expect(sent).toEqual([{ type: 'typing' }, { type: 'message', text: 'oi' }]);
    });

    it('shows who is typing, with bold names, between the list and the input (FR-11)', async () => {
      joinedAs('me', 'Carla');
      typingFrom('u1', 'Ana');
      await fixture.whenStable();
      expect(el('.strip').textContent.trim()).toBe('Ana está digitando…');

      typingFrom('u2', 'Bruno');
      await fixture.whenStable();
      expect(el('.strip').textContent.trim()).toBe('Ana e Bruno estão digitando…');
      expect(all('.strip strong').map((s) => s.textContent)).toEqual(['Ana', 'Bruno']);

      // The strip sits after the message list and before the composer.
      expect(el('.list-area').nextElementSibling).toBe(el('.strip'));
      expect(el('.strip').nextElementSibling).toBe(el('form.composer'));
    });

    it('lists three typists as "Ana, Bruno e Carla" (FR-11)', async () => {
      joinedAs('me', 'Davi');
      typingFrom('u1', 'Ana');
      typingFrom('u2', 'Bruno');
      typingFrom('u3', 'Carla');
      await fixture.whenStable();
      expect(el('.strip').textContent.trim()).toBe('Ana, Bruno e Carla estão digitando…');
    });

    it('removes a name as soon as that user sends a message (FR-12)', async () => {
      joinedAs('me', 'Carla');
      typingFrom('u1', 'Ana');
      typingFrom('u2', 'Bruno');
      messageFrom('m1', 'u1', 'Ana');
      await fixture.whenStable();
      expect(el('.strip').textContent.trim()).toBe('Bruno está digitando…');
    });

    it('never shows the current user (FR-13)', async () => {
      joinedAs('me', 'Ana');
      typingFrom('me', 'Ana');
      await fixture.whenStable();
      expect(el('.strip').textContent.trim()).toBe('');
    });

    it('keeps the strip in the layout while empty (FR-14)', async () => {
      const strip = el('.strip') as HTMLElement;
      expect(strip.textContent.trim()).toBe('');
      joinedAs('me', 'Carla');
      typingFrom('u1', 'Ana');
      await fixture.whenStable();
      messageFrom('m1', 'u1', 'Ana');
      await fixture.whenStable();
      // Same element, still rendered, just empty again.
      expect(el('.strip')).toBe(strip);
      expect(strip.textContent.trim()).toBe('');
    });
  });

  describe('unread counter', () => {
    let list: HTMLElement;
    let scrollTo: ReturnType<typeof vi.fn>;

    /** jsdom has no layout: give the list a 1000 px content in a 500 px box, scrolled to `top`. */
    function layout(top: number): void {
      Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1000 });
      Object.defineProperty(list, 'clientHeight', { configurable: true, value: 500 });
      Object.defineProperty(list, 'scrollTop', { configurable: true, writable: true, value: top });
    }

    const pill = () => el('.unread-pill') as HTMLButtonElement | null;

    beforeEach(async () => {
      list = el('.messages');
      scrollTo = vi.fn();
      list.scrollTo = scrollTo as unknown as HTMLElement['scrollTo'];
      layout(0); // scrolled up: 500 px from the bottom
      joinedAs('me', 'Bruno');
      await fixture.whenStable();
    });

    it('is hidden at 0 (FR-16)', () => {
      expect(pill()).toBeNull();
    });

    it('counts messages from others while scrolled up (FR-15, FR-16)', async () => {
      messageFrom('1', 'u1', 'Ana');
      await fixture.whenStable();
      expect(pill()?.textContent.trim()).toBe('1 nova mensagem');

      messageFrom('2', 'u3', 'Carla');
      messageFrom('3', 'u1', 'Ana');
      await fixture.whenStable();
      expect(pill()?.textContent.trim()).toBe('3 novas mensagens');
    });

    it('does not count while the user is at the bottom (FR-15)', async () => {
      layout(480); // 20 px from the bottom
      messageFrom('1', 'u1', 'Ana');
      await fixture.whenStable();
      expect(pill()).toBeNull();
    });

    it("never counts the user's own messages (FR-19)", async () => {
      messageFrom('1', 'me', 'Bruno');
      await fixture.whenStable();
      layout(0); // own message scrolled down (FR-06); scroll back up
      messageFrom('2', 'me', 'Bruno');
      await fixture.whenStable();
      expect(pill()).toBeNull();
    });

    it('clicking the pill scrolls smoothly to the bottom and resets the counter (FR-17)', async () => {
      messageFrom('1', 'u1', 'Ana');
      messageFrom('2', 'u1', 'Ana');
      await fixture.whenStable();

      pill()?.click();
      await fixture.whenStable();

      expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
      expect(pill()).toBeNull();
    });

    it('scrolling to the bottom resets the counter; scrolling elsewhere does not (FR-18)', async () => {
      messageFrom('1', 'u1', 'Ana');
      await fixture.whenStable();

      layout(200);
      list.dispatchEvent(new Event('scroll'));
      await fixture.whenStable();
      expect(pill()?.textContent.trim()).toBe('1 nova mensagem');

      layout(500);
      list.dispatchEvent(new Event('scroll'));
      await fixture.whenStable();
      expect(pill()).toBeNull();
    });
  });
});
