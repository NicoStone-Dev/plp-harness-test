import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientEvent, ServerEvent } from '../../domain/events';
import { chatSession } from '../../streams/chat-session';
import { ChatRoom } from './chat-room';

const SELF = { userId: 'u-carla', name: 'Carla' };

describe('ChatRoom', () => {
  let fixture: ComponentFixture<ChatRoom>;
  let event$: Subject<ServerEvent>;
  let sent: ClientEvent[];
  let nextId: number;

  beforeEach(async () => {
    event$ = new Subject<ServerEvent>();
    sent = [];
    nextId = 0;

    await TestBed.configureTestingModule({ imports: [ChatRoom] }).compileComponents();
    fixture = TestBed.createComponent(ChatRoom);
    fixture.componentRef.setInput('session', chatSession(SELF.name, { event$, send: (event) => sent.push(event) }));
    fixture.detectChanges();
    event$.next({ type: 'joined', ...SELF });
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const query = <T extends Element = HTMLElement>(selector: string) => el().querySelector<T>(selector);
  const text = (element: Element | null) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function receive(author: string, authorId: string, body = 'oi') {
    event$.next({
      type: 'message',
      message: { id: `m${nextId++}`, authorId, author, text: body, sentAt: Date.now() },
    });
    fixture.detectChanges();
  }

  function typing(name: string, userId: string) {
    event$.next({ type: 'typing', userId, name });
    fixture.detectChanges();
  }

  describe('typing indicator', () => {
    const strip = () => query('.strip')!;

    it('FR-10: typing in the message box sends one typing event per 500 ms', () => {
      vi.useFakeTimers();
      const input = query<HTMLInputElement>('.composer .input')!;
      for (let i = 0; i < 5; i++) {
        input.value += 'a';
        input.dispatchEvent(new Event('input'));
      }
      expect(sent.filter((event) => event.type === 'typing')).toHaveLength(1);

      vi.advanceTimersByTime(500);
      expect(sent.filter((event) => event.type === 'typing')).toHaveLength(2);
    });

    it('FR-10: clearing the input after sending is not reported as typing', () => {
      const input = query<HTMLInputElement>('.composer .input')!;
      input.value = 'oi';
      input.dispatchEvent(new Event('input'));
      query<HTMLButtonElement>('.composer button')!.click();
      fixture.detectChanges();

      expect(input.value).toBe('');
      expect(sent).toEqual([{ type: 'typing' }, { type: 'message', text: 'oi' }]);
    });

    it('FR-11: shows one, two and three names between the list and the input', () => {
      typing('Ana', 'u-ana');
      expect(text(strip())).toBe('Ana está digitando…');

      typing('Bruno', 'u-bruno');
      expect(text(strip())).toBe('Ana e Bruno estão digitando…');

      typing('Davi', 'u-davi');
      expect(text(strip())).toBe('Ana, Bruno e Davi estão digitando…');

      // names in bold, as in docs/design/typing.png
      expect([...strip().querySelectorAll('strong')].map(text)).toEqual(['Ana', 'Bruno', 'Davi']);

      // placed between the message list and the composer
      const chat = query('.chat')!;
      const children = [...chat.children];
      expect(children.indexOf(strip())).toBe(children.indexOf(query('.list-area')!) + 1);
      expect(children.indexOf(query('.composer')!)).toBe(children.indexOf(strip()) + 1);
    });

    it('FR-12: a name disappears 2 s after the last typing event', () => {
      vi.useFakeTimers();
      typing('Ana', 'u-ana');
      vi.advanceTimersByTime(1999);
      fixture.detectChanges();
      expect(text(strip())).toBe('Ana está digitando…');

      vi.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(text(strip())).toBe('');
    });

    it('FR-12: a name disappears at once when that user sends a message', () => {
      typing('Ana', 'u-ana');
      typing('Bruno', 'u-bruno');
      receive('Ana', 'u-ana');
      expect(text(strip())).toBe('Bruno está digitando…');
    });

    it('FR-13: never shows the own name', () => {
      typing(SELF.name, SELF.userId);
      expect(text(strip())).toBe('');

      typing('Ana', 'u-ana');
      expect(text(strip())).toBe('Ana está digitando…');
    });

    it('FR-14: the strip is always in the layout, with a fixed 32 px height', () => {
      expect(strip()).not.toBeNull();
      expect(getComputedStyle(strip()).height).toBe('32px');
      expect(getComputedStyle(strip()).flexShrink).toBe('0');

      typing('Ana', 'u-ana');
      expect(getComputedStyle(strip()).height).toBe('32px');
    });
  });

  describe('unread counter', () => {
    let list: HTMLElement;
    let scrollTop: number;
    let scrollTo: ReturnType<typeof vi.fn>;

    /** jsdom has no layout: give the list a 1000 px tall content in a 300 px viewport. */
    beforeEach(() => {
      list = query('.messages')!;
      scrollTop = 0;
      Object.defineProperty(list, 'scrollHeight', { configurable: true, get: () => 1000 });
      Object.defineProperty(list, 'clientHeight', { configurable: true, get: () => 300 });
      Object.defineProperty(list, 'scrollTop', {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => (scrollTop = Math.min(value, 700)),
      });
      scrollTo = vi.fn();
      list.scrollTo = scrollTo as unknown as HTMLElement['scrollTo'];
    });

    const pill = () => query<HTMLButtonElement>('.pill');

    function scrollListTo(top: number) {
      scrollTop = top;
      list.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();
    }

    it('FR-16: the pill is hidden at 0', () => {
      expect(pill()).toBeNull();
    });

    it('FR-15 / FR-16: counts messages from others while scrolled up', () => {
      receive('Ana', 'u-ana');
      expect(text(pill())).toBe('1 nova mensagem');

      receive('Bruno', 'u-bruno');
      receive('Ana', 'u-ana');
      expect(text(pill())).toBe('3 novas mensagens');
      // bottom center of the list: inside the list area, outside the scrolling list
      expect(pill()!.parentElement).toBe(query('.list-area'));
    });

    it('FR-15: does not count when the user is within 40 px of the bottom', () => {
      scrollListTo(660); // 1000 - 660 - 300 = 40 px from the bottom
      receive('Ana', 'u-ana');
      expect(pill()).toBeNull();
    });

    it('FR-15: counts when the user is more than 40 px from the bottom', () => {
      scrollListTo(659); // 41 px from the bottom
      receive('Ana', 'u-ana');
      expect(text(pill())).toBe('1 nova mensagem');
    });

    it('FR-17: clicking the pill scrolls smoothly to the bottom and resets the counter', () => {
      receive('Ana', 'u-ana');
      receive('Bruno', 'u-bruno');
      pill()!.click();
      fixture.detectChanges();

      expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
      expect(pill()).toBeNull();
    });

    it('FR-18: reaching the bottom by scrolling resets the counter', () => {
      receive('Ana', 'u-ana');
      receive('Bruno', 'u-bruno');

      scrollListTo(400); // still scrolled up
      expect(text(pill())).toBe('2 novas mensagens');

      scrollListTo(700); // at the bottom
      expect(pill()).toBeNull();
    });

    it('FR-19: own messages never increase the counter', () => {
      receive('Ana', 'u-ana');
      // An own message also scrolls to the bottom (FR-06), so look at the count right away.
      event$.next({
        type: 'message',
        message: { id: 'own', authorId: SELF.userId, author: SELF.name, text: 'eu', sentAt: Date.now() },
      });
      expect(text(pill())).toBe('1 nova mensagem');
    });

    it('FR-06: an own message still scrolls to the bottom, which then clears the counter (FR-18)', async () => {
      receive('Ana', 'u-ana');
      receive(SELF.name, SELF.userId, 'eu');
      await fixture.whenStable();
      expect(scrollTop).toBe(700);

      list.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();
      expect(pill()).toBeNull();
    });

    it('FR-05: a message from others while scrolled up does not move the list', async () => {
      scrollListTo(200);
      receive('Ana', 'u-ana');
      await fixture.whenStable();
      expect(scrollTop).toBe(200);
    });
  });
});
