import { AsyncPipe, DatePipe } from '@angular/common';
import {
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  OnInit,
  signal,
  viewChild,
  type Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { filter, merge, Subject, tap } from 'rxjs';
import { initialOf, toneOf } from '../../domain/message-view';
import { typingSegments } from '../../domain/typing-label';
import { unreadLabel } from '../../domain/unread-label';
import type { ChatSession } from '../../streams/chat-session';
import {
  autoScroll$,
  isNearBottom,
  nextRender,
  scrollToBottom,
  scrollToBottomSmoothly,
} from '../../streams/scroll';
import { unreadCount$ } from '../../streams/unread';

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

  protected readonly typingSegments = typingSegments;
  protected readonly unreadLabel = unreadLabel;
  /** Unread messages from others while scrolled up (FR-15 to FR-19); set up in ngOnInit. */
  protected unread: Signal<number> = signal(0);

  private readonly list = viewChild.required<ElementRef<HTMLElement>>('list');
  private readonly injector = inject(Injector);
  private readonly scrolled$ = new Subject<void>();
  private readonly pillClicked$ = new Subject<void>();

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

    // FR-10: send the (throttled) typing pings.
    toSignal(session.typingSent$, { injector: this.injector });

    // FR-15 to FR-19: measured before the message renders, like autoScroll$ above.
    // Reset by reaching the bottom (FR-18) or by clicking the pill, which scrolls smoothly (FR-17).
    const reset$ = merge(
      this.scrolled$.pipe(filter(() => isNearBottom(element()))),
      this.pillClicked$.pipe(tap(() => scrollToBottomSmoothly(element()))),
    );
    this.unread = toSignal(unreadCount$(session.message$, () => !isNearBottom(element()), reset$), {
      initialValue: 0,
      injector: this.injector,
    });
  }

  protected send(): void {
    this.session().submit(this.draft.value);
  }

  protected typed(): void {
    this.session().typed();
  }

  protected scrolled(): void {
    this.scrolled$.next();
  }

  protected jumpToBottom(): void {
    this.pillClicked$.next();
  }
}
