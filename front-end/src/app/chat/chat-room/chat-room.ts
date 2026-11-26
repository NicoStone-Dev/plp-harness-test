import { AsyncPipe, DatePipe } from '@angular/common';
import {
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  OnInit,
  type Signal,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { filter, merge, Subject, tap } from 'rxjs';
import { initialOf, toneOf } from '../../domain/message-view';
import type { ChatSession } from '../../streams/chat-session';
import { autoScroll$, isNearBottom, nextRender, scrollToBottom, scrollToBottomSmoothly } from '../../streams/scroll';
import { typingSegments } from '../../streams/typing';
import { unreadCount$, unreadLabel } from '../../streams/unread';

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

  /** Names of the other users typing (FR-11 to FR-13); bound in ngOnInit. */
  protected typists: Signal<readonly string[]> = signal([]);
  protected readonly typingSegments = computed(() => typingSegments(this.typists()));

  /** Unread messages from others while scrolled up (FR-15 to FR-19); bound in ngOnInit. */
  protected unread: Signal<number> = signal(0);
  protected readonly unreadLabel = computed(() => unreadLabel(this.unread()));

  /** DOM events from the template, as streams. */
  protected readonly scrolled$ = new Subject<void>();
  protected readonly pillClicked$ = new Subject<void>();

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

    // FR-10: keystrokes become throttled typing notices.
    toSignal(session.typingSent$, { injector: this.injector });

    // FR-11 to FR-13: who else is typing.
    this.typists = toSignal(session.typingNames$, { initialValue: [], injector: this.injector });

    // FR-17: the pill scrolls smoothly to the bottom.
    const jumpToBottom$ = this.pillClicked$.pipe(tap(() => scrollToBottomSmoothly(element())));
    // FR-18: reaching the bottom by scrolling.
    const reachedBottom$ = this.scrolled$.pipe(filter(() => isNearBottom(element())));

    // FR-15 / FR-19: count others' messages that arrive while scrolled up (measured before render).
    this.unread = toSignal(
      unreadCount$(session.message$, () => isNearBottom(element()), merge(jumpToBottom$, reachedBottom$)),
      { initialValue: 0, injector: this.injector },
    );
  }

  protected send(): void {
    this.session().submit(this.draft.value);
  }
}
