import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, computed, ElementRef, inject, Injector, input, OnInit, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { merge, Observable, of, Subject, tap } from 'rxjs';
import { nameSeparator, typingVerb, unreadText } from '../../domain/indicator-text';
import { initialOf, toneOf } from '../../domain/message-view';
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

  protected readonly nameSeparator = nameSeparator;
  protected readonly typingVerb = typingVerb;
  protected readonly unreadText = unreadText;

  /** Scroll events of the message list. */
  protected readonly scroll$ = new Subject<void>();
  /** Clicks on the unread pill. */
  private readonly pillClick$ = new Subject<void>();
  /** FR-15 to FR-19: number of unread messages; 0 hides the pill. */
  protected unread$: Observable<number> = of(0);

  private readonly list = viewChild.required<ElementRef<HTMLElement>>('list');
  private readonly injector = inject(Injector);

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

    // FR-10: keystrokes are turned into (throttled) typing events while the room is open.
    toSignal(session.typingSent$, { injector: this.injector });

    // FR-15 to FR-19. Like autoScroll$, "was at the bottom?" is measured before rendering.
    this.unread$ = unreadCount$(
      session.message$,
      () => isNearBottom(element()),
      merge(this.pillClick$, reachedBottom$(this.scroll$, () => isNearBottom(element()))),
    );
  }

  /** FR-17: the pill scrolls smoothly to the bottom and clears the counter. */
  protected jumpToBottom(): void {
    this.pillClick$.next();
    smoothScrollToBottom(this.list().nativeElement);
  }

  protected send(): void {
    this.session().submit(this.draft.value);
  }
}
