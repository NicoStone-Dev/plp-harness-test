import { AsyncPipe, DatePipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  OnInit,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { defer, filter, map, merge, Subject, switchMap } from 'rxjs';
import { typingParts, unreadLabel } from '../../domain/indicator-text';
import { initialOf, toneOf } from '../../domain/message-view';
import type { ChatSession } from '../../streams/chat-session';
import { isNearBottom, nextRender, scrollToBottom } from '../../streams/scroll';
import { unreadCount } from '../../streams/unread';

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

  /** Scroll events on the message list. */
  protected readonly scroll$ = new Subject<void>();
  /** Clicks on the "novas mensagens" pill. */
  protected readonly jump$ = new Subject<void>();

  /** FR-11: the indicator text, split so names can be bold. */
  // `defer`: the input is read when the template subscribes, after it has been set.
  protected readonly typing$ = defer(() => this.session().typers$).pipe(map(typingParts));

  /** FR-15–19: messages from others that arrived while scrolled up. */
  protected readonly unread$ = defer(() =>
    unreadCount(
      this.session().message$,
      () => !isNearBottom(this.list().nativeElement),
      merge(
        this.jump$, // FR-17
        this.scroll$.pipe(filter(() => isNearBottom(this.list().nativeElement))), // FR-18
      ),
    ),
  );

  protected readonly unreadLabel = unreadLabel;

  private readonly list = viewChild.required<ElementRef<HTMLElement>>('list');
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const session = this.session();

    // FR-05 / FR-06: decide *before* the new message is rendered, scroll *after*.
    session.message$
      .pipe(
        map((message) => message.own || isNearBottom(this.list().nativeElement)),
        filter(Boolean),
        switchMap(() => nextRender(this.injector)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => scrollToBottom(this.list().nativeElement));

    // FR-17: the pill scrolls smoothly to the bottom (the counter is reset by unread$).
    this.jump$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => scrollToBottom(this.list().nativeElement, 'smooth'));

    // FR-10: typing events go out (throttled) while this screen is open.
    session.typingSent$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

    // FR-02: clear the input once the text has been sent.
    session.sent$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.draft.setValue(''));
  }

  protected send(): void {
    this.session().outgoing.next(this.draft.value);
  }

  protected typed(event: Event): void {
    this.session().keystroke.next((event.target as HTMLInputElement).value);
  }
}
