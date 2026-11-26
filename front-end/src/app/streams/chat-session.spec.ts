import { Subject, type Subscription } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientEvent, ServerEvent } from '../domain/events';
import { chatSession, type ChatSession } from './chat-session';

describe('chatSession: typing', () => {
  let event$: Subject<ServerEvent>;
  let sent: ClientEvent[];
  let session: ChatSession;
  let subscriptions: Subscription[];

  beforeEach(() => {
    vi.useFakeTimers();
    event$ = new Subject<ServerEvent>();
    sent = [];
    session = chatSession('Carla', { event$, send: (event) => sent.push(event) });
    subscriptions = [session.sent$.subscribe(), session.typingSent$.subscribe()];
  });

  afterEach(() => {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
    vi.useRealTimers();
  });

  const typingEvents = () => sent.filter((event) => event.type === 'typing');

  it('FR-10: sends one typing event at once, then at most one per 500 ms', () => {
    session.keystroke();
    session.keystroke();
    session.keystroke();
    expect(typingEvents()).toEqual([{ type: 'typing' }]);

    vi.advanceTimersByTime(499);
    session.keystroke();
    expect(typingEvents()).toHaveLength(1);

    vi.advanceTimersByTime(1); // end of the window: the last keystroke goes out
    expect(typingEvents()).toHaveLength(2);
  });

  it('FR-12: sending a message cancels the pending typing event', () => {
    session.keystroke();
    session.keystroke();
    session.submit('oi');
    vi.advanceTimersByTime(2000);

    expect(sent).toEqual([{ type: 'typing' }, { type: 'message', text: 'oi' }]);
  });

  it('FR-02: blank text is still not sent and does not cancel the pending typing event', () => {
    session.keystroke();
    session.keystroke();
    session.submit('   ');
    vi.advanceTimersByTime(500);

    expect(sent).toEqual([{ type: 'typing' }, { type: 'typing' }]);
  });

  it('FR-11 / FR-13: typing$ lists the others who are typing, not the own user', () => {
    const names: (readonly string[])[] = [];
    subscriptions.push(session.typing$.subscribe((value) => names.push(value)));

    event$.next({ type: 'joined', userId: 'u-carla', name: 'Carla' });
    event$.next({ type: 'typing', userId: 'u-carla', name: 'Carla' });
    event$.next({ type: 'typing', userId: 'u-ana', name: 'Ana' });

    expect(names).toEqual([[], ['Ana']]);

    vi.advanceTimersByTime(2000);
    expect(names.at(-1)).toEqual([]);
  });

  it('FR-08: ignores typing events that arrive before the join is acknowledged', () => {
    const names: (readonly string[])[] = [];
    subscriptions.push(session.typing$.subscribe((value) => names.push(value)));

    event$.next({ type: 'typing', userId: 'u-ana', name: 'Ana' });
    expect(names).toEqual([[]]);
  });
});
