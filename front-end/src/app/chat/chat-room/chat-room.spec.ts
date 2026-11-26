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

  describe('typing indicator', () => {
    const typingOf = (userId: string, name: string): ServerEvent => ({ type: 'typing', userId, name });
    const messageFrom = (id: string, authorId: string, author: string): ServerEvent => ({
      type: 'message',
      message: { id, authorId, author, text: 'oi', sentAt: 0 },
    });

    function press(key: string, init: KeyboardEventInit = {}): void {
      (el('input') as HTMLInputElement).dispatchEvent(new KeyboardEvent('keydown', { key, ...init }));
    }

    const strip = () => el('.strip') as HTMLElement;

    it('sends one typing event for a burst of keystrokes, ignoring Enter/Tab/shortcuts (FR-10)', async () => {
      press('Tab');
      press('Enter');
      press('c', { ctrlKey: true });
      expect(sent).toEqual([]);

      press('o');
      press('i');
      press('Backspace');
      await fixture.whenStable();
      expect(sent).toEqual([{ type: 'typing' }]);
    });

    it('shows who is typing between the list and the input, with names in bold (FR-11)', async () => {
      server$.next({ type: 'joined', userId: 'me', name: 'Ana' });
      server$.next(typingOf('b', 'Bruno'));
      await fixture.whenStable();
      expect(strip().textContent?.replace(/\s+/g, ' ').trim()).toBe('Bruno está digitando…');

      server$.next(typingOf('c', 'Carla'));
      server$.next(typingOf('d', 'Davi'));
      await fixture.whenStable();
      expect(strip().textContent?.replace(/\s+/g, ' ').trim()).toBe('Bruno, Carla e Davi estão digitando…');
      expect(Array.from(strip().querySelectorAll('strong')).map((b) => b.textContent)).toEqual([
        'Bruno',
        'Carla',
        'Davi',
      ]);

      // Placed after the message list and before the composer.
      const order = Array.from(el('.chat').children as HTMLCollection).map((c) => (c as HTMLElement).className);
      expect(order.indexOf('strip typing')).toBe(order.indexOf('viewport') + 1);
      expect(order.indexOf('composer')).toBe(order.indexOf('strip typing') + 1);
    });

    it('removes a name immediately when that user sends a message (FR-12)', async () => {
      server$.next({ type: 'joined', userId: 'me', name: 'Ana' });
      server$.next(typingOf('b', 'Bruno'));
      server$.next(typingOf('c', 'Carla'));
      server$.next(messageFrom('m1', 'b', 'Bruno'));
      await fixture.whenStable();
      expect(strip().textContent?.replace(/\s+/g, ' ').trim()).toBe('Carla está digitando…');
    });

    it('never shows the current user (FR-13)', async () => {
      server$.next({ type: 'joined', userId: 'me', name: 'Ana' });
      server$.next(typingOf('me', 'Ana'));
      await fixture.whenStable();
      expect(strip().textContent?.trim()).toBe('');
    });

    it('keeps the same strip element, empty, when nobody is typing (FR-14)', async () => {
      const before = strip();
      expect(before.children.length).toBe(0);
      server$.next({ type: 'joined', userId: 'me', name: 'Ana' });
      server$.next(typingOf('b', 'Bruno'));
      await fixture.whenStable();
      expect(strip()).toBe(before);
      server$.next(messageFrom('m1', 'b', 'Bruno'));
      await fixture.whenStable();
      expect(strip()).toBe(before);
      expect(before.children.length).toBe(0);
    });
  });

  describe('unread counter', () => {
    const other = (id: string): ServerEvent => ({
      type: 'message',
      message: { id, authorId: 'x', author: 'Bruno', text: 'oi', sentAt: 0 },
    });
    const mine = (id: string): ServerEvent => ({
      type: 'message',
      message: { id, authorId: 'me', author: 'Ana', text: 'olá', sentAt: 0 },
    });

    /** jsdom has no layout: give the list a fixed geometry and a settable scroll position. */
    function fakeGeometry(): { list: HTMLElement; scrollTo: ReturnType<typeof vi.fn> } {
      const list = el('ol.messages') as HTMLElement;
      let top = 0;
      Object.defineProperty(list, 'scrollHeight', { configurable: true, get: () => 1000 });
      Object.defineProperty(list, 'clientHeight', { configurable: true, get: () => 300 });
      Object.defineProperty(list, 'scrollTop', { configurable: true, get: () => top, set: (v: number) => (top = v) });
      const scrollTo = vi.fn();
      Object.defineProperty(list, 'scrollTo', { configurable: true, value: scrollTo });
      return { list, scrollTo };
    }

    const pill = () => el('.unread-pill') as HTMLButtonElement | null;

    beforeEach(async () => {
      server$.next({ type: 'joined', userId: 'me', name: 'Ana' });
      await fixture.whenStable();
    });

    it('is hidden at 0 (FR-16)', () => {
      expect(pill()).toBeNull();
    });

    it("counts others' messages while scrolled up and shows singular/plural (FR-15, FR-16)", async () => {
      const { list } = fakeGeometry();
      list.scrollTop = 100; // 600 px from the bottom
      server$.next(other('1'));
      await fixture.whenStable();
      expect(pill()?.textContent?.trim()).toBe('1 nova mensagem');

      server$.next(other('2'));
      server$.next(other('3'));
      await fixture.whenStable();
      expect(pill()?.textContent?.trim()).toBe('3 novas mensagens');
    });

    it('does not count while at the bottom (FR-15)', async () => {
      const { list } = fakeGeometry();
      list.scrollTop = 680; // 20 px from the bottom
      server$.next(other('1'));
      await fixture.whenStable();
      expect(pill()).toBeNull();
    });

    it('never counts own messages (FR-19)', async () => {
      const { list } = fakeGeometry();
      list.scrollTop = 100;
      server$.next(mine('1'));
      await fixture.whenStable();
      expect(pill()).toBeNull();
    });

    it('clicking the pill scrolls smoothly to the bottom and resets to 0 (FR-17)', async () => {
      const { list, scrollTo } = fakeGeometry();
      list.scrollTop = 100;
      server$.next(other('1'));
      server$.next(other('2'));
      await fixture.whenStable();

      pill()?.click();
      await fixture.whenStable();
      expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
      expect(pill()).toBeNull();
    });

    it('reaching the bottom by scrolling resets to 0 (FR-18)', async () => {
      const { list } = fakeGeometry();
      list.scrollTop = 100;
      server$.next(other('1'));
      await fixture.whenStable();

      list.scrollTop = 400; // still scrolled up: keeps the count
      list.dispatchEvent(new Event('scroll'));
      await fixture.whenStable();
      expect(pill()?.textContent?.trim()).toBe('1 nova mensagem');

      list.scrollTop = 700;
      list.dispatchEvent(new Event('scroll'));
      await fixture.whenStable();
      expect(pill()).toBeNull();
    });
  });
});
