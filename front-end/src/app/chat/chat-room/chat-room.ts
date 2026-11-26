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
import { Subject, tap } from 'rxjs';
import { initialOf, toneOf } from '../../domain/message-view';
import { typingParts, type TypingPart } from '../../domain/typing';
import { unreadLabel } from '../../domain/unread';
import type { ChatSession } from '../../streams/chat-session';
import { autoScroll$, isNearBottom, nextRender, scrollToBottom, scrollToBottomSmoothly } from '../../streams/scroll';
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

  /** FR-15 / FR-16: messages from others received while scrolled up. Bound in ngOnInit. */
  protected unread: Signal<number> = signal(0);

  private readonly list = viewChild.required<ElementRef<HTMLElement>>('list');
  private readonly injector = inject(Injector);

  // Private: the template reports DOM events through the methods below.
  private readonly scroll$ = new Subject<void>();
  private readonly jump$ = new Subject<void>();

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

    // FR-10: keystrokes become throttled typing events; sending happens while this is consumed.
    toSignal(session.typingSent$, { injector: this.injector });

    // FR-15 to FR-19: unread counter.
    this.unread = toSignal(unreadCount$(session.message$, () => isNearBottom(element()), this.scroll$, this.jump$), {
      initialValue: 0,
      injector: this.injector,
    });
  }

  protected send(): void {
    this.session().submit(this.draft.value);
  }

  /** A keystroke in the message box (FR-10). Programmatic clears do not count. */
  protected typed(): void {
    this.session().typing();
  }

  protected scrolled(): void {
    this.scroll$.next();
  }

  /** FR-17: the pill scrolls smoothly to the bottom and resets the counter. */
  protected jumpToBottom(): void {
    scrollToBottomSmoothly(this.list().nativeElement);
    this.jump$.next();
  }

  protected typingParts(names: readonly string[] | null): readonly TypingPart[] {
    return typingParts(names ?? []);
  }

  protected unreadLabel(count: number): string {
    return unreadLabel(count);
  }
}
