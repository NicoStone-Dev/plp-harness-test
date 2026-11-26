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

  // Typing also sends a typing ping now (FR-10), so FR-02 checks look at message events only.
  const messagesSent = () => sent.filter((event) => event.type === 'message');

  it('sends trimmed text and clears the input (FR-02)', async () => {
    await typeAndSend('  oi  ');
    expect(messagesSent()).toEqual([{ type: 'message', text: 'oi' }]);
    expect((el('input') as HTMLInputElement).value).toBe('');
  });

  it('does not send blank text and keeps the input (FR-02)', async () => {
    await typeAndSend('   ');
    expect(messagesSent()).toEqual([]);
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
    const typingEvent = (userId: string, name: string): ServerEvent => ({ type: 'typing', userId, name });
    const strip = () => el('.strip') as HTMLElement;

    async function keystroke(value: string): Promise<void> {
      const input = el('input') as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    }

    it('sends one typing event for a burst of keystrokes (FR-10)', async () => {
      await keystroke('o');
      await keystroke('oi');
      await keystroke('oi!');
      expect(sent).toEqual([{ type: 'typing' }]);
    });

    it('does not send typing when the input is cleared after sending (FR-10)', async () => {
      await typeAndSend('oi');
      expect(sent.filter((event) => event.type === 'typing')).toHaveLength(1);
    });

    it('shows who is typing, in the design wording (FR-11)', async () => {
      server$.next({ type: 'joined', userId: 'me', name: 'Ana' });
      server$.next(typingEvent('u2', 'Bruno'));
      await fixture.whenStable();
      expect(strip().textContent?.trim()).toBe('Bruno está digitando…');
      expect(all('.strip strong').map((b) => b.textContent)).toEqual(['Bruno']);

      server$.next(typingEvent('u3', 'Carla'));
      await fixture.whenStable();
      expect(strip().textContent?.trim()).toBe('Bruno e Carla estão digitando…');

      server$.next(typingEvent('u4', 'Davi'));
      await fixture.whenStable();
      expect(strip().textContent?.trim()).toBe('Bruno, Carla e Davi estão digitando…');
    });

    it('removes a name as soon as that user sends a message (FR-12)', async () => {
      server$.next({ type: 'joined', userId: 'me', name: 'Ana' });
      server$.next(typingEvent('u2', 'Bruno'));
      server$.next(typingEvent('u3', 'Carla'));
      server$.next({ type: 'message', message: { id: '1', authorId: 'u2', author: 'Bruno', text: 'oi', sentAt: 0 } });
      await fixture.whenStable();
      expect(strip().textContent?.trim()).toBe('Carla está digitando…');
    });

    it('never shows the own name (FR-13)', async () => {
      server$.next({ type: 'joined', userId: 'me', name: 'Ana' });
      server$.next(typingEvent('me', 'Ana'));
      await fixture.whenStable();
      expect(strip().textContent?.trim()).toBe('');
    });

    it('keeps the strip in the layout while empty (FR-14)', async () => {
      server$.next({ type: 'joined', userId: 'me', name: 'Ana' });
      await fixture.whenStable();
      expect(strip()).not.toBeNull();
      expect(strip().children).toHaveLength(0);
    });
  });

  describe('unread counter', () => {
    const other = (id: string): ServerEvent => ({
      type: 'message',
      message: { id, authorId: 'u2', author: 'Bruno', text: `m${id}`, sentAt: 0 },
    });
    const mine = (id: string): ServerEvent => ({
      type: 'message',
      message: { id, authorId: 'me', author: 'Ana', text: `m${id}`, sentAt: 0 },
    });
    const pill = () => el('.unread-pill') as HTMLButtonElement | null;
    let list: HTMLElement;

    /** jsdom has no layout: give the list a scrollable size, scrolled to the top. */
    beforeEach(async () => {
      list = el('ol.messages') as HTMLElement;
      Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1000 });
      Object.defineProperty(list, 'clientHeight', { configurable: true, value: 300 });
      list.scrollTop = 0;
      server$.next({ type: 'joined', userId: 'me', name: 'Ana' });
      await fixture.whenStable();
    });

    async function receive(...events: ServerEvent[]): Promise<void> {
      for (const event of events) server$.next(event);
      await fixture.whenStable();
    }

    it('is hidden at 0 (FR-16)', () => {
      expect(pill()).toBeNull();
    });

    it("counts others' messages while scrolled up, with singular/plural text (FR-15, FR-16)", async () => {
      await receive(other('1'));
      expect(pill()?.textContent?.trim()).toBe('1 nova mensagem');
      await receive(other('2'), other('3'));
      expect(pill()?.textContent?.trim()).toBe('3 novas mensagens');
    });

    it('does not count when the user is at the bottom (FR-15)', async () => {
      list.scrollTop = 700; // 1000 - 300 - 700 = 0 px from the bottom
      await receive(other('1'));
      expect(pill()).toBeNull();
    });

    it('never counts own messages (FR-19)', async () => {
      await receive(mine('1'));
      expect(pill()).toBeNull();
      list.scrollTop = 0;
      await receive(other('2'));
      await receive(mine('3'));
      expect(pill()?.textContent?.trim()).toBe('1 nova mensagem');
    });

    it('clicking the pill scrolls smoothly to the bottom and resets the counter (FR-17)', async () => {
      const scrollTo = vi.fn();
      list.scrollTo = scrollTo;
      await receive(other('1'), other('2'));
      pill()?.click();
      await fixture.whenStable();
      expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
      expect(pill()).toBeNull();
    });

    it('scrolling to the bottom resets the counter; scrolling elsewhere does not (FR-18)', async () => {
      await receive(other('1'), other('2'));
      list.scrollTop = 200;
      list.dispatchEvent(new Event('scroll'));
      await fixture.whenStable();
      expect(pill()?.textContent?.trim()).toBe('2 novas mensagens');

      list.scrollTop = 665; // 35 px from the bottom: within 40 px
      list.dispatchEvent(new Event('scroll'));
      await fixture.whenStable();
      expect(pill()).toBeNull();
    });
  });
});
