import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Subject } from 'rxjs';
import type { ClientEvent, ServerEvent } from '../../domain/events';
import { chatSession } from '../../streams/chat-session';
import { ChatRoom } from './chat-room';

/** jsdom has no layout: give the list a controllable scroll geometry. */
interface FakeScroll {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
  scrollTo: ReturnType<typeof vi.fn>;
}

function fakeScroll(element: HTMLElement): FakeScroll {
  const state = { scrollHeight: 1000, clientHeight: 300, scrollTop: 700 };
  for (const key of Object.keys(state) as (keyof typeof state)[]) {
    Object.defineProperty(element, key, {
      configurable: true,
      get: () => state[key],
      set: (value: number) => (state[key] = value),
    });
  }
  const scrollTo = vi.fn();
  element.scrollTo = scrollTo as unknown as typeof element.scrollTo;
  return Object.assign(state, { scrollTo }) as unknown as FakeScroll & typeof state;
}

describe('ChatRoom component – typing indicator and unread counter', () => {
  let fixture: ComponentFixture<ChatRoom>;
  let event$: Subject<ServerEvent>;
  let sent: ClientEvent[];
  let scroll: FakeScroll;
  let seq = 0;

  const el = () => fixture.nativeElement as HTMLElement;
  const list = () => el().querySelector<HTMLElement>('.messages')!;
  const strip = () => el().querySelector<HTMLElement>('.strip')!;
  const pill = () => el().querySelector<HTMLButtonElement>('.pill');
  const input = () => el().querySelector<HTMLInputElement>('input')!;
  const text = (node: Element | null) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

  const emit = (event: ServerEvent) => {
    event$.next(event);
    fixture.detectChanges();
  };
  const messageFrom = (authorId: string, author: string, body = 'oi') =>
    emit({
      type: 'message',
      message: { id: `m${++seq}`, authorId, author, text: body, sentAt: 0 },
    });
  const typingFrom = (userId: string, name: string) => emit({ type: 'typing', userId, name });
  const scrollTo = (top: number) => {
    scroll.scrollTop = top;
    list().dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    event$ = new Subject<ServerEvent>();
    sent = [];
    const session = chatSession('Carla', { event$, send: (event) => sent.push(event) });

    TestBed.configureTestingModule({ imports: [ChatRoom] });
    fixture = TestBed.createComponent(ChatRoom);
    fixture.componentRef.setInput('session', session);
    fixture.detectChanges();
    scroll = fakeScroll(list());
    emit({ type: 'joined', userId: 'me', name: 'Carla' });
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  // ---- Typing indicator ----

  it('FR-10: typing in the message box sends a throttled typing event', () => {
    input().value = 'o';
    input().dispatchEvent(new Event('input'));
    input().value = 'oi';
    input().dispatchEvent(new Event('input'));
    expect(sent).toEqual([{ type: 'typing' }]);
    vi.advanceTimersByTime(500);
    expect(sent).toEqual([{ type: 'typing' }, { type: 'typing' }]);
  });

  it('FR-10: clearing the input after sending is not reported as typing', () => {
    input().value = 'oi';
    input().dispatchEvent(new Event('input'));
    el().querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);
    expect(input().value).toBe('');
    expect(sent).toEqual([{ type: 'typing' }, { type: 'message', text: 'oi' }]);
  });

  it('FR-11: shows one, two and three names in the strip', () => {
    typingFrom('a', 'Ana');
    expect(text(strip())).toBe('Ana está digitando…');
    typingFrom('b', 'Bruno');
    expect(text(strip())).toBe('Ana e Bruno estão digitando…');
    typingFrom('c', 'Carla2');
    expect(text(strip())).toBe('Ana, Bruno e Carla2 estão digitando…');
    expect([...strip().querySelectorAll('strong')].map((s) => s.textContent)).toEqual([
      'Ana',
      'Bruno',
      'Carla2',
    ]);
  });

  it('FR-11: the indicator sits between the message list and the input', () => {
    const card = el().querySelector('.chat')!;
    const order = [...card.children].map((child) => child.className);
    expect(order.indexOf('strip')).toBe(order.indexOf('list-wrap') + 1);
    expect(order.indexOf('composer')).toBe(order.indexOf('strip') + 1);
  });

  it('FR-12: a name disappears 2 s after the last typing event', () => {
    typingFrom('a', 'Ana');
    vi.advanceTimersByTime(1999);
    fixture.detectChanges();
    expect(text(strip())).toBe('Ana está digitando…');
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(text(strip())).toBe('');
  });

  it('FR-12: a name disappears immediately when that user sends a message', () => {
    typingFrom('a', 'Ana');
    typingFrom('b', 'Bruno');
    messageFrom('a', 'Ana');
    expect(text(strip())).toBe('Bruno está digitando…');
  });

  it('FR-13: the user never sees their own name', () => {
    typingFrom('me', 'Carla');
    expect(text(strip())).toBe('');
    expect(strip().querySelector('.typing')).toBeNull();
  });

  it('FR-14: the strip keeps its 32 px height, empty or not', () => {
    expect(strip()).not.toBeNull();
    expect(getComputedStyle(strip()).height).toBe('32px');
    typingFrom('a', 'Ana');
    const sameNode = strip();
    vi.advanceTimersByTime(2000);
    fixture.detectChanges();
    expect(strip()).toBe(sameNode); // never removed, only emptied
    expect(getComputedStyle(strip()).height).toBe('32px');
  });

  // ---- Unread counter ----

  it('FR-15 / FR-16: counts messages from others while scrolled up and shows the pill', () => {
    scrollTo(100); // 600 px from the bottom
    expect(pill()).toBeNull();
    messageFrom('a', 'Ana');
    expect(text(pill())).toBe('1 nova mensagem');
    messageFrom('b', 'Bruno');
    messageFrom('a', 'Ana');
    expect(text(pill())).toBe('3 novas mensagens');
  });

  it('FR-15: does not count when within 40 px of the bottom', () => {
    scrollTo(661); // 39 px from the bottom
    messageFrom('a', 'Ana');
    expect(pill()).toBeNull();
  });

  it('FR-16: the pill is hidden at 0', () => {
    expect(pill()).toBeNull();
  });

  it('FR-17: clicking the pill scrolls smoothly to the bottom and resets the counter', () => {
    scrollTo(100);
    messageFrom('a', 'Ana');
    messageFrom('a', 'Ana');
    pill()!.click();
    fixture.detectChanges();
    expect(scroll.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
    expect(pill()).toBeNull();
  });

  it('FR-18: scrolling to the bottom resets the counter', () => {
    scrollTo(100);
    messageFrom('a', 'Ana');
    scrollTo(400); // still scrolled up
    expect(text(pill())).toBe('1 nova mensagem');
    scrollTo(700); // at the bottom
    expect(pill()).toBeNull();
  });

  it('FR-19: own messages never increase the counter', () => {
    scrollTo(100);
    messageFrom('me', 'Carla');
    expect(pill()).toBeNull();
    scrollTo(100); // FR-06 jumped to the bottom; scroll up again
    messageFrom('a', 'Ana');
    messageFrom('me', 'Carla');
    // jsdom fires no scroll event for the FR-06 auto-scroll, so the count is not reset here:
    // it must still be exactly 1 (only Ana's message counted).
    expect(text(pill())).toBe('1 nova mensagem');
  });
});
