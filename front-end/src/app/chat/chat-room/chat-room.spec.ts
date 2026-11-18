import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { BehaviorSubject, NEVER, scan, startWith, Subject } from 'rxjs';
import type { MessageView } from '../../domain/message-view';
import type { ChatSession } from '../../streams/chat-session';
import { ChatRoom } from './chat-room';

let nextId = 0;
function view(own: boolean): MessageView {
  const author = own ? 'Me' : 'Ana';
  return { id: String(nextId++), author, text: 'oi', sentAt: 0, own, initial: author[0]!, tone: 'blue' };
}

function fakeSession() {
  const message$ = new Subject<MessageView>();
  const typers$ = new BehaviorSubject<readonly string[]>([]);
  const keystroke = new Subject<string>();
  const session: ChatSession = {
    name: 'Me',
    message$,
    messages$: message$.pipe(
      scan((all: readonly MessageView[], m) => [...all, m], []),
      startWith([] as readonly MessageView[]),
    ),
    outgoing: new Subject<string>(),
    sent$: NEVER,
    keystroke,
    typingSent$: NEVER,
    typers$,
  };
  return { session, message$, typers$, keystroke };
}

/** jsdom has no layout, so the list's scroll geometry is faked: 1000 px of content in a 300 px box. */
function fakeGeometry(list: HTMLElement) {
  Object.defineProperty(list, 'scrollHeight', { configurable: true, get: () => 1000 });
  Object.defineProperty(list, 'clientHeight', { configurable: true, get: () => 300 });
  list.scrollTop = 0;
  const scrollTo = vi.fn((options: ScrollToOptions) => (list.scrollTop = (options.top ?? 0) - 300));
  list.scrollTo = scrollTo as unknown as HTMLElement['scrollTo'];
  return { scrollTo };
}

describe('ChatRoom', () => {
  let fixture: ComponentFixture<ChatRoom>;
  let fake: ReturnType<typeof fakeSession>;
  let el: HTMLElement;

  beforeEach(async () => {
    fake = fakeSession();
    fixture = TestBed.createComponent(ChatRoom);
    fixture.componentRef.setInput('session', fake.session);
    await fixture.whenStable();
    el = fixture.nativeElement as HTMLElement;
  });

  const render = () => fixture.whenStable();
  const strip = () => el.querySelector<HTMLElement>('.strip')!;
  const pill = () => el.querySelector<HTMLButtonElement>('.pill');
  const list = () => el.querySelector<HTMLElement>('.messages')!;

  describe('typing indicator', () => {
    it('keeps an empty strip in place when nobody is typing (FR-14)', () => {
      expect(strip()).not.toBeNull();
      expect(strip().textContent?.trim()).toBe('');
      // The strip sits between the list and the composer.
      expect(strip().previousElementSibling?.classList.contains('list')).toBe(true);
      expect(strip().nextElementSibling?.classList.contains('composer')).toBe(true);
    });

    it('shows the names with bold names (FR-11)', async () => {
      fake.typers$.next(['Ana', 'Bruno']);
      await render();
      expect(strip().textContent?.replace(/\s+/g, ' ').trim()).toBe('Ana e Bruno estão digitando…');
      expect([...strip().querySelectorAll('strong')].map((s) => s.textContent)).toEqual(['Ana', 'Bruno']);

      fake.typers$.next([]);
      await render();
      expect(strip().textContent?.trim()).toBe('');
    });

    it('reports every keystroke in the message box (FR-10)', () => {
      const typed: string[] = [];
      fake.keystroke.subscribe((draft) => typed.push(draft));
      const input = el.querySelector<HTMLInputElement>('.composer input')!;
      input.value = 'o';
      input.dispatchEvent(new Event('input'));
      input.value = 'oi';
      input.dispatchEvent(new Event('input'));
      expect(typed).toEqual(['o', 'oi']);
    });
  });

  describe('unread pill', () => {
    it('is hidden at 0 and counts messages from others while scrolled up (FR-15, FR-16)', async () => {
      fakeGeometry(list());
      expect(pill()).toBeNull();

      fake.message$.next(view(false));
      await render();
      expect(pill()?.textContent?.trim()).toBe('1 nova mensagem');

      fake.message$.next(view(false));
      await render();
      expect(pill()?.textContent?.trim()).toBe('2 novas mensagens');
    });

    it('does not count own messages (FR-19)', async () => {
      fakeGeometry(list());
      fake.message$.next(view(true));
      await render();
      expect(pill()).toBeNull();
    });

    it('does not count messages while at the bottom', async () => {
      fakeGeometry(list());
      list().scrollTop = 700;
      fake.message$.next(view(false));
      await render();
      expect(pill()).toBeNull();
    });

    it('scrolls smoothly to the bottom and resets when clicked (FR-17)', async () => {
      const { scrollTo } = fakeGeometry(list());
      fake.message$.next(view(false));
      await render();

      pill()!.click();
      await render();

      expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
      expect(pill()).toBeNull();
    });

    it('resets when the user scrolls to the bottom (FR-18)', async () => {
      fakeGeometry(list());
      fake.message$.next(view(false));
      fake.message$.next(view(false));
      await render();
      expect(pill()).not.toBeNull();

      // Scrolling but still far from the bottom keeps the count.
      list().scrollTop = 500;
      list().dispatchEvent(new Event('scroll'));
      await render();
      expect(pill()?.textContent?.trim()).toBe('2 novas mensagens');

      list().scrollTop = 680; // within 40 px of the bottom
      list().dispatchEvent(new Event('scroll'));
      await render();
      expect(pill()).toBeNull();
    });
  });
});
