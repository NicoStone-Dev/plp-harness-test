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

  /** Chat messages sent to the server (typing pings, FR-10, are left out). */
  const sentMessages = () => sent.filter((event) => event.type === 'message');

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

  describe('typing indicator', () => {
    const typing = (userId: string, name: string): ServerEvent => ({ type: 'typing', userId, name });
    const strip = () => el('.strip') as HTMLElement;

    beforeEach(async () => {
      server$.next({ type: 'joined', userId: 'me', name: 'Ana' });
      await fixture.whenStable();
    });

    it('sends one typing event for a burst of keystrokes (FR-10)', async () => {
      const input = el('input') as HTMLInputElement;
      for (const value of ['o', 'oi', 'oi!']) {
        input.value = value;
        input.dispatchEvent(new Event('input'));
      }
      await fixture.whenStable();
      expect(sent).toEqual([{ type: 'typing' }]);
    });

    it('shows who is typing, with names in bold, between the list and the input (FR-11)', async () => {
      server$.next(typing('b', 'Bruno'));
      await fixture.whenStable();
      expect(strip().textContent?.trim()).toBe('Bruno está digitando…');

      server$.next(typing('c', 'Carla'));
      await fixture.whenStable();
      expect(strip().textContent?.trim()).toBe('Bruno e Carla estão digitando…');

      server$.next(typing('d', 'Dani'));
      await fixture.whenStable();
      expect(strip().textContent?.trim()).toBe('Bruno, Carla e Dani estão digitando…');
      expect(Array.from(strip().querySelectorAll('strong')).map((b) => b.textContent)).toEqual([
        'Bruno',
        'Carla',
        'Dani',
      ]);

      // Placed between the message list and the composer.
      expect(strip().previousElementSibling?.classList.contains('list')).toBe(true);
      expect(strip().nextElementSibling?.classList.contains('composer')).toBe(true);
    });

    it('removes a name as soon as that user sends a message (FR-12)', async () => {
      server$.next(typing('b', 'Bruno'));
      await fixture.whenStable();
      server$.next({ type: 'message', message: { id: '1', authorId: 'b', author: 'Bruno', text: 'oi', sentAt: 0 } });
      await fixture.whenStable();
      expect(strip().textContent?.trim()).toBe('');
      expect(strip().querySelector('.dots')).toBeNull();
    });

    it("never shows the user's own name (FR-13)", async () => {
      server$.next(typing('me', 'Ana'));
      await fixture.whenStable();
      expect(strip().textContent?.trim()).toBe('');
    });

    it('keeps the strip in the layout with a fixed height when empty (FR-14)', async () => {
      expect(strip()).not.toBeNull();
      expect(getComputedStyle(strip()).height).toBe('32px');
      expect(getComputedStyle(strip()).flexShrink).toBe('0');

      server$.next(typing('b', 'Bruno'));
      await fixture.whenStable();
      expect(getComputedStyle(strip()).height).toBe('32px');
    });
  });

  describe('unread counter', () => {
    const fromBruno = (id: string): ServerEvent => ({
      type: 'message',
      message: { id, authorId: 'b', author: 'Bruno', text: `m${id}`, sentAt: 0 },
    });
    const fromMe = (id: string): ServerEvent => ({
      type: 'message',
      message: { id, authorId: 'me', author: 'Ana', text: `m${id}`, sentAt: 0 },
    });
    const pill = () => el('.pill') as HTMLButtonElement | null;
    let list: HTMLElement;
    let scrollTo: ReturnType<typeof vi.fn>;

    /** jsdom has no layout: give the list a 1000 px content in a 500 px box. */
    function layout(scrollTop: number): void {
      Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1000 });
      Object.defineProperty(list, 'clientHeight', { configurable: true, value: 500 });
      list.scrollTop = scrollTop;
    }

    beforeEach(async () => {
      server$.next({ type: 'joined', userId: 'me', name: 'Ana' });
      await fixture.whenStable();
      list = el('ol.messages') as HTMLElement;
      scrollTo = vi.fn();
      list.scrollTo = scrollTo as unknown as HTMLElement['scrollTo'];
    });

    async function receive(...events: ServerEvent[]): Promise<void> {
      for (const event of events) server$.next(event);
      await fixture.whenStable();
    }

    it('is hidden at 0 (FR-16)', () => {
      expect(pill()).toBeNull();
    });

    it("counts others' messages while scrolled up and shows the pill (FR-15, FR-16)", async () => {
      layout(0);
      await receive(fromBruno('1'));
      expect(pill()?.textContent?.trim()).toBe('1 nova mensagem');

      layout(0);
      await receive(fromBruno('2'), fromBruno('3'));
      expect(pill()?.textContent?.trim()).toBe('3 novas mensagens');
      expect(pill()?.parentElement?.classList.contains('list')).toBe(true);
    });

    it('does not count while the user is within 40 px of the bottom (FR-15)', async () => {
      layout(460);
      await receive(fromBruno('1'));
      expect(pill()).toBeNull();
    });

    it("never counts the user's own messages (FR-19)", async () => {
      layout(0);
      await receive(fromBruno('1'));
      layout(0);
      await receive(fromMe('2'), fromMe('3'));
      expect(pill()?.textContent?.trim()).toBe('1 nova mensagem');
    });

    it('clicking the pill scrolls smoothly to the bottom and resets the counter (FR-17)', async () => {
      layout(0);
      await receive(fromBruno('1'), fromBruno('2'));
      pill()?.click();
      await fixture.whenStable();

      expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
      expect(pill()).toBeNull();
    });

    it('scrolling down to the bottom resets the counter (FR-18)', async () => {
      layout(0);
      await receive(fromBruno('1'));

      // Scrolling but still far from the bottom keeps the count.
      list.scrollTop = 200;
      list.dispatchEvent(new Event('scroll'));
      await fixture.whenStable();
      expect(pill()?.textContent?.trim()).toBe('1 nova mensagem');

      list.scrollTop = 500;
      list.dispatchEvent(new Event('scroll'));
      await fixture.whenStable();
      expect(pill()).toBeNull();
    });
  });
});
