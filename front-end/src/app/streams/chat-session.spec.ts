import { Subject, type Subscription } from 'rxjs';
import type { ClientEvent, ServerEvent } from '../domain/events';
import { chatSession, type ChatSession } from './chat-session';

describe('chatSession – typing wiring', () => {
  let event$: Subject<ServerEvent>;
  let sent: ClientEvent[];
  let session: ChatSession;
  let subs: Subscription[];

  beforeEach(() => {
    vi.useFakeTimers();
    event$ = new Subject<ServerEvent>();
    sent = [];
    session = chatSession('Carla', { event$, send: (event) => sent.push(event) });
    subs = [session.sent$.subscribe(), session.typingSent$.subscribe()];
  });

  afterEach(() => {
    subs.forEach((sub) => sub.unsubscribe());
    vi.useRealTimers();
  });

  it('FR-10: keystrokes send typing events, at most one per 500 ms', () => {
    session.typed();
    session.typed();
    session.typed();
    expect(sent).toEqual([{ type: 'typing' }]);
    vi.advanceTimersByTime(500);
    expect(sent).toEqual([{ type: 'typing' }, { type: 'typing' }]);
    vi.advanceTimersByTime(1000);
    expect(sent).toHaveLength(2);
  });

  it('FR-12: sending a message cancels the pending typing event', () => {
    session.typed();
    session.typed();
    session.submit('oi');
    vi.advanceTimersByTime(1000);
    expect(sent).toEqual([{ type: 'typing' }, { type: 'message', text: 'oi' }]);
  });

  it('FR-02 regression: blank text sends nothing, not even a message', () => {
    session.submit('   ');
    expect(sent).toEqual([]);
  });

  it('FR-11 / FR-13: typists$ shows others after the join, never the user', () => {
    const names: (readonly string[])[] = [];
    subs.push(session.typists$.subscribe((n) => names.push(n)));
    event$.next({ type: 'joined', userId: 'me', name: 'Carla' });
    event$.next({ type: 'typing', userId: 'me', name: 'Carla' });
    event$.next({ type: 'typing', userId: 'a', name: 'Ana' });
    expect(names.at(-1)).toEqual(['Ana']);
    expect(names.flat()).not.toContain('Carla');
    vi.advanceTimersByTime(2000);
    expect(names.at(-1)).toEqual([]);
  });
});
