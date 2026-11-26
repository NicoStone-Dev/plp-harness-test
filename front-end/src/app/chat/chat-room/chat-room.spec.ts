import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import type { ClientEvent, ServerEvent } from '../../domain/events';
import { chatSession } from '../../streams/chat-session';
import { ChatRoom } from './chat-room';

const SELF = 'me';

/** jsdom has no layout: give the list fixed scroll metrics we can move around. */
function fakeScrollMetrics(list: HTMLElement, { scrollHeight = 1000, clientHeight = 300, scrollTop = 0 } = {}) {
  Object.defineProperty(list, 'scrollHeight', { configurable: true, get: () => scrollHeight });
  Object.defineProperty(list, 'clientHeight', { configurable: true, get: () => clientHeight });
  Object.defineProperty(list, 'scrollTop', { configurable: true, writable: true, value: scrollTop });
  const scrollTo = vi.fn();
  Object.defineProperty(list, 'scrollTo', { configurable: true, value: scrollTo });
  return { scrollTo };
}

describe('ChatRoom', () => {
  let fixture: ComponentFixture<ChatRoom>;
  let event$: Subject<ServerEvent>;
  let sent: ClientEvent[];
  let list: HTMLElement;
  let n = 0;

  const el = () => fixture.nativeElement as HTMLElement;
  const typingStrip = () => el().querySelector<HTMLElement>('.typing');
  const pill = () => el().querySelector<HTMLButtonElement>('.unread');
  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const messageFrom = (authorId: string, author: string): ServerEvent => ({
    type: 'message',
    message: { id: `m${++n}`, authorId, author, text: 'oi', sentAt: 0 },
  });

  beforeEach(async () => {
    event$ = new Subject<ServerEvent>();
    sent = [];
    const session = chatSession('Carla', { event$, send: (event) => sent.push(event) });

    await TestBed.configureTestingModule({ imports: [ChatRoom] }).compileComponents();
    fixture = TestBed.createComponent(ChatRoom);
    fixture.componentRef.setInput('session', session);
    await render();

    list = el().querySelector<HTMLElement>('.messages')!;
    event$.next({ type: 'joined', userId: SELF, name: 'Carla' });
    await render();
  });

  afterEach(() => vi.useRealTimers());

  describe('typing indicator', () => {
    it('FR-10: typing in the message box sends a typing event', async () => {
      const input = el().querySelector<HTMLInputElement>('input.input')!;
      input.value = 'o';
      input.dispatchEvent(new Event('input'));
      input.value = 'oi';
      input.dispatchEvent(new Event('input'));
      await render();

      expect(sent).toEqual([{ type: 'typing' }]);
    });

    it('FR-11: shows other typists between the list and the input, names in bold', async () => {
      event$.next({ type: 'typing', userId: 'ana', name: 'Ana' });
      event$.next({ type: 'typing', userId: 'bruno', name: 'Bruno' });
      await render();

      const strip = typingStrip()!;
      expect(strip.textContent?.replace(/\s+/g, ' ').trim()).toBe('Ana e Bruno estão digitando…');
      expect([...strip.querySelectorAll('strong')].map((b) => b.textContent)).toEqual(['Ana', 'Bruno']);
      // Placed after the list area and before the composer.
      expect(strip.previousElementSibling?.classList).toContain('list-area');
      expect(strip.nextElementSibling?.classList).toContain('composer');
    });

    it('FR-11: three typists', async () => {
      for (const [userId, name] of [['ana', 'Ana'], ['bruno', 'Bruno'], ['carla2', 'Carla']]) {
        event$.next({ type: 'typing', userId: userId!, name: name! });
      }
      await render();
      expect(typingStrip()!.textContent?.replace(/\s+/g, ' ').trim()).toBe('Ana, Bruno e Carla estão digitando…');
    });

    it('FR-12: a name disappears when that user sends a message', async () => {
      event$.next({ type: 'typing', userId: 'ana', name: 'Ana' });
      await render();
      expect(typingStrip()!.textContent).toContain('Ana');

      event$.next(messageFrom('ana', 'Ana'));
      await render();
      expect(typingStrip()!.textContent?.trim()).toBe('');
    });

    it('FR-12: a name disappears 2 s after the last typing event', async () => {
      vi.useFakeTimers();
      event$.next({ type: 'typing', userId: 'ana', name: 'Ana' });
      fixture.detectChanges();
      expect(typingStrip()!.textContent).toContain('Ana');

      vi.advanceTimersByTime(1999);
      fixture.detectChanges();
      expect(typingStrip()!.textContent).toContain('Ana');

      vi.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(typingStrip()!.textContent?.trim()).toBe('');
    });

    it('FR-13: never shows the user\'s own name', async () => {
      event$.next({ type: 'typing', userId: SELF, name: 'Carla' });
      await render();
      expect(typingStrip()!.textContent?.trim()).toBe('');
    });

    it('FR-14: the indicator strip is always rendered, even when empty', async () => {
      expect(typingStrip()).not.toBeNull();
      expect(typingStrip()!.children).toHaveLength(0);
    });
  });

  describe('unread counter', () => {
    it('FR-15 / FR-16: counts others\' messages while scrolled up and shows the pill', async () => {
      fakeScrollMetrics(list, { scrollTop: 0 }); // 700 px from the bottom
      expect(pill()).toBeNull(); // FR-16: hidden at 0

      event$.next(messageFrom('ana', 'Ana'));
      await render();
      expect(pill()!.textContent?.trim()).toBe('1 nova mensagem');

      event$.next(messageFrom('bruno', 'Bruno'));
      event$.next(messageFrom('ana', 'Ana'));
      await render();
      expect(pill()!.textContent?.trim()).toBe('3 novas mensagens');
    });

    it('FR-15: does not count when the user is at the bottom', async () => {
      fakeScrollMetrics(list, { scrollTop: 680 }); // 20 px from the bottom
      event$.next(messageFrom('ana', 'Ana'));
      await render();
      expect(pill()).toBeNull();
    });

    it('FR-17: clicking the pill scrolls smoothly to the bottom and resets the counter', async () => {
      const { scrollTo } = fakeScrollMetrics(list, { scrollTop: 0 });
      event$.next(messageFrom('ana', 'Ana'));
      await render();

      pill()!.click();
      await render();

      expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
      expect(pill()).toBeNull();
    });

    it('FR-18: reaching the bottom by scrolling resets the counter', async () => {
      fakeScrollMetrics(list, { scrollTop: 0 });
      event$.next(messageFrom('ana', 'Ana'));
      event$.next(messageFrom('ana', 'Ana'));
      await render();
      expect(pill()).not.toBeNull();

      // Scrolling but still far from the bottom keeps the count.
      list.scrollTop = 300;
      list.dispatchEvent(new Event('scroll'));
      await render();
      expect(pill()!.textContent?.trim()).toBe('2 novas mensagens');

      list.scrollTop = 700;
      list.dispatchEvent(new Event('scroll'));
      await render();
      expect(pill()).toBeNull();
    });

    it('FR-19: own messages never increase the counter', async () => {
      fakeScrollMetrics(list, { scrollTop: 0 });
      event$.next(messageFrom(SELF, 'Carla'));
      await render();
      expect(pill()).toBeNull();
    });
  });

  describe('base app still works', () => {
    it('FR-02: Enviar sends the trimmed text and clears the input', async () => {
      const input = el().querySelector<HTMLInputElement>('input.input')!;
      input.value = '  olá  ';
      input.dispatchEvent(new Event('input'));
      el().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
      await render();

      expect(sent.filter((event) => event.type === 'message')).toEqual([{ type: 'message', text: 'olá' }]);
      expect(input.value).toBe('');
    });

    it('FR-04: own messages are marked own, others show the author', async () => {
      event$.next(messageFrom(SELF, 'Carla'));
      event$.next(messageFrom('ana', 'Ana'));
      await render();

      const items = el().querySelectorAll('li.message');
      expect(items[0]!.classList).toContain('own');
      expect(items[0]!.querySelector('.author')).toBeNull();
      expect(items[1]!.querySelector('.author')!.textContent).toBe('Ana');
    });
  });
});
