import { WebSocketServer } from 'ws';
import { chatRoom } from './streams/chat-room.js';
import { connection$, fromEmitter } from './streams/socket.js';

const PORT = Number(process.env['PORT'] ?? 3000);

// maxPayload bounds memory per frame; larger frames close that socket only.
const server = new WebSocketServer({ port: PORT, maxPayload: 64 * 1024 });

fromEmitter(server, 'listening', () => undefined).subscribe(() =>
  console.log(`Chat server listening on ws://localhost:${PORT}`),
);

fromEmitter(server, 'error', (error: Error) => error).subscribe((error) => {
  console.error(`Server error: ${error.message}`);
  process.exit(1);
});

chatRoom(connection$(server)).subscribe();
