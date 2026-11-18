import { Subject } from 'rxjs';
import type { MessageView } from '../domain/message-view';
import { unreadCount } from './unread';

function view(own: boolean, id = String(Math.random())): MessageView {
  return { id, author: own ? 'Me' : 'Ana', text: 'oi', sentAt: 0, own, initial: 'A', tone: 'blue' };
}

describe('unreadCount (FR-15–19)', () => {
  function setup() {
    const message$ = new Subject<MessageView>();
    const reset$ = new Subject<void>();
    let scrolledUp = false;
    const counts: number[] = [];
    unreadCount(message$, () => scrolledUp, reset$).subscribe((n) => counts.push(n));
    return {
      counts,
      receive: (own = false) => message$.next(view(own)),
      reset: () => reset$.next(),
      scrollUp: () => (scrolledUp = true),
      scrollDown: () => (scrolledUp = false),
      last: () => counts.at(-1),
    };
  }

  it('starts at 0', () => {
    expect(setup().counts).toEqual([0]);
  });

  it('does not count messages while at the bottom', () => {
    const t = setup();
    t.receive();
    t.receive();
    expect(t.last()).toBe(0);
  });

  it('counts each message from others while scrolled up (FR-15)', () => {
    const t = setup();
    t.scrollUp();
    t.receive();
    t.receive();
    t.receive();
    expect(t.counts).toEqual([0, 1, 2, 3]);
  });

  it('never counts own messages (FR-19)', () => {
    const t = setup();
    t.scrollUp();
    t.receive(true);
    t.receive();
    t.receive(true);
    expect(t.counts).toEqual([0, 1]);
  });

  it('resets to 0 when the user reaches the bottom (FR-17, FR-18)', () => {
    const t = setup();
    t.scrollUp();
    t.receive();
    t.receive();
    t.scrollDown();
    t.reset();
    expect(t.last()).toBe(0);

    t.scrollUp();
    t.receive();
    expect(t.last()).toBe(1);
  });

  it('does not re-emit when nothing changes', () => {
    const t = setup();
    t.reset();
    t.reset();
    t.receive();
    expect(t.counts).toEqual([0]);
  });
});
