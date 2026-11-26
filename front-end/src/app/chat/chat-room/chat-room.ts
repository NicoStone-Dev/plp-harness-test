import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, computed, ElementRef, inject, Injector, input, OnInit, signal, type Signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { map, merge, Subject, tap } from 'rxjs';
import { initialOf, toneOf } from '../../domain/message-view';
import { isTypingKey, typingParts, type TypingPart } from '../../domain/typing';
import { unreadLabel } from '../../domain/unread';
import type { ChatSession } from '../../streams/chat-session';
import { autoScroll$, isNearBottom, nextRender, scrollToBottom, smoothScrollToBottom } from '../../streams/scroll';
import { reachedBottom$, unreadCount$ } from '../../streams/unread';

@Component({
  selector: 'app-chat-room',
  imports: [AsyncPipe, DatePipe, ReactiveFormsModule],
  templateUrl: './chat-room.html',
  styleUrl: './chat-room.css',
})
export class ChatRoom implements OnInit {
  readonly session = input.required<ChatSession>();

  protected readonly initial = computed(() => initialOf(this.session().name));
  protected readonly tone = computed(() => toneOf(this.session().name));
  protected readonly draft = new FormControl('', { nonNullable: true });

  /** FR-11: who is typing, split so names render bold. Empty keeps the strip blank (FR-14). */
  protected typing: Signal<readonly TypingPart[]> = signal([]);
  /** FR-16: pill text, null while there is nothing unread. */
  protected unread: Signal<string | null> = signal(null);

  private readonly list = viewChild.required<ElementRef<HTMLElement>>('list');
  private readonly injector = inject(Injector);

  // Private: the template reports DOM events through onScroll() / jumpToBottom().
  private readonly scrolled$ = new Subject<void>();
  private readonly jumped$ = new Subject<void>();

  ngOnInit(): void {
    const session = this.session();
    const element = () => this.list().nativeElement;

    // Side-effect pipelines are bound to this component's lifetime with toSignal:
    // the subscription ends when the component's injector is destroyed.

    // FR-05 / FR-06: decide *before* the new message is rendered, scroll *after*.
    toSignal(
      autoScroll$(
        session.message$,
        () => isNearBottom(element()),
        () => nextRender(this.injector),
      ).pipe(tap(() => scrollToBottom(element()))),
      { injector: this.injector },
    );

    // FR-02: clear the input once the text has been sent.
    toSignal(session.sent$.pipe(tap(() => this.draft.setValue(''))), { injector: this.injector });

    // FR-10: keep the throttled typing pings flowing while the component lives.
    toSignal(session.typingSent$, { injector: this.injector });

    // FR-11 to FR-14.
    this.typing = toSignal(session.typingNames$.pipe(map(typingParts)), {
      injector: this.injector,
      initialValue: [],
    });

    // FR-15 to FR-19: measured before the new message renders, like FR-05.
    const reset$ = merge(this.jumped$, reachedBottom$(this.scrolled$, () => isNearBottom(element())));
    this.unread = toSignal(
      unreadCount$(session.message$, () => isNearBottom(element()), reset$).pipe(map(unreadLabel)),
      { injector: this.injector, initialValue: null },
    );
  }

  protected send(): void {
    this.session().submit(this.draft.value);
  }

  /** FR-10: a keystroke in the message box. */
  protected typed(event: KeyboardEvent): void {
    if (isTypingKey(event.key, event.ctrlKey || event.metaKey)) this.session().typed();
  }

  /** FR-18: the list was scrolled. */
  protected onScroll(): void {
    this.scrolled$.next();
  }

  /** FR-17: the pill was clicked. */
  protected jumpToBottom(): void {
    smoothScrollToBottom(this.list().nativeElement);
    this.jumped$.next();
  }
}
