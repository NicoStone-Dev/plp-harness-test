import { Subject } from 'rxjs';
import type { ClientEvent, ServerEvent } from '../domain/events';
import type { MessageView } from '../domain/message-view';
import { chatSession } from './chat-session';

function fakeConnection() {
  const event$ = new Subject<ServerEvent>();
  const sent: ClientEvent[] = [];
  return { connection: { event$, send: (event: ClientEvent) => sent.push(event) }, event$, sent };
}

describe('chatSession', () => {
  afterEach(() => vi.useRealTimers());

  it('FR-10: keystrokes send typing notices, at most one per 500 ms', () => {
    vi.useFakeTimers();
    const { connection, sent } = fakeConnection();
    const session = chatSession('Ana', connection);
    const subscription = session.typingSent$.subscribe();

    session.keystroke();
    session.keystroke();
    vi.advanceTimersByTime(200);
    session.keystroke();
    expect(sent).toEqual([{ type: 'typing' }]);

    vi.advanceTimersByTime(400);
    session.keystroke();
    expect(sent).toEqual([{ type: 'typing' }, { type: 'typing' }]);
    subscription.unsubscribe();
  });

  it('FR-11 / FR-12: exposes the other typists and drops them when they send', () => {
    const { connection, event$ } = fakeConnection();
    const session = chatSession('Carla', connection);
    const names: (readonly string[])[] = [];
    const subscription = session.typingNames$.subscribe((value) => names.push(value));

    event$.next({ type: 'joined', userId: 'me', name: 'Carla' });
    event$.next({ type: 'typing', userId: 'ana', name: 'Ana' });
    event$.next({
      type: 'message',
      message: { id: '1', authorId: 'ana', author: 'Ana', text: 'oi', sentAt: 0 },
    });

    expect(names).toEqual([[], ['Ana'], []]);
    subscription.unsubscribe();
  });

  it('FR-02 / FR-03 still work: submit sends trimmed text and messages are listed', () => {
    const { connection, event$, sent } = fakeConnection();
    const session = chatSession('Ana', connection);
    const lists: (readonly MessageView[])[] = [];
    const subs = [session.sent$.subscribe(), session.messages$.subscribe((list) => lists.push(list))];

    session.submit('   ');
    session.submit('  oi ');
    expect(sent).toEqual([{ type: 'message', text: 'oi' }]);

    event$.next({ type: 'joined', userId: 'me', name: 'Ana' });
    event$.next({ type: 'message', message: { id: '1', authorId: 'me', author: 'Ana', text: 'oi', sentAt: 0 } });
    expect(lists.at(-1)?.map((message) => [message.text, message.own])).toEqual([['oi', true]]);
    subs.forEach((sub) => sub.unsubscribe());
  });
});
