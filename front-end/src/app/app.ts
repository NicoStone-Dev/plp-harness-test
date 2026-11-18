import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { map, Subject, take } from 'rxjs';
import { ChatRoom } from './chat/chat-room/chat-room';
import { Join } from './chat/join/join';
import { ChatSocketService } from './services/chat-socket.service';
import { chatSession } from './streams/chat-session';

@Component({
  selector: 'app-root',
  imports: [AsyncPipe, ChatRoom, Join],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly sockets = inject(ChatSocketService);

  protected readonly join$ = new Subject<string>();

  protected readonly session$ = this.join$.pipe(
    take(1),
    map((name) => chatSession(name, this.sockets.connect(name))),
  );
}
