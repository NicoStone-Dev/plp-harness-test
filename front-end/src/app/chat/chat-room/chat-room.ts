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
import { filter, map, switchMap } from 'rxjs';
import { initialOf, toneOf } from '../../domain/message-view';
import type { ChatSession } from '../../streams/chat-session';
import { isNearBottom, nextRender, scrollToBottom } from '../../streams/scroll';

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

    // FR-02: clear the input once the text has been sent.
    session.sent$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.draft.setValue(''));
  }

  protected send(): void {
    this.session().outgoing.next(this.draft.value);
  }
}
