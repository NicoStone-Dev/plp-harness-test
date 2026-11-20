# Architecture rules

Each rule with what breaks it and what follows it. The checks that enforce a rule are named
under it; `bash scripts/validate.sh` runs all of them.

```
back-end                         front-end
  src/server.ts   (subscribes)     components: app/chat/**, app/app.ts  (async pipe / toSignal)
      ↓                                ↓
  src/streams/                     app/services/
      ↓                                ↓
  src/domain/     (pure)           app/streams/
                                       ↓
                                   app/domain/      (pure)
```

Arrows are the only allowed import directions.

---

## R1 — Imports only point inward

back-end: `src/domain` ← `src/streams` ← `src/server.ts`.
front-end: `app/domain` ← `app/streams` ← `app/services` ← components.
`domain` never imports rxjs, ws or Angular.

Enforced by: dependency-cruiser (`.dependency-cruiser.cjs`, rules `R1-*`) and ESLint
`no-restricted-imports` per layer.

**Bad** — a stream reaching outward into a service; a domain file using rxjs:

```ts
// front-end/src/app/streams/chat-session.ts
import type { ChatConnection } from '../services/chat-socket.service'; // streams → services ✗

// back-end/src/domain/chat-message.ts
import { map } from 'rxjs'; // domain → rxjs ✗
```

**Good** — the inner layer owns the type; the outer layer implements it:

```ts
// front-end/src/app/streams/chat-connection.ts
export interface ChatConnection { readonly event$: Observable<ServerEvent>; send(e: ClientEvent): void }

// front-end/src/app/services/chat-socket.service.ts
import type { ChatConnection } from '../streams/chat-connection'; // services → streams ✓
```

## R2 — The two `events.ts` files are identical

Enforced by: `scripts/check-contract.sh` (`cmp`, prints a diff on failure).

**Bad** — adding an event to one side only:

```ts
// back-end/src/domain/events.ts
| { readonly type: 'typing' }          // front-end copy doesn't have it ✗
```

**Good** — edit one copy, then copy it over:

```bash
cp back-end/src/domain/events.ts front-end/src/app/domain/events.ts
```

## R3 — Subjects are private

Never exported, never `public`/`protected`, never in a public interface.

Enforced by: ESLint `rxjs-x/no-exposed-subjects` (`allowProtected: false`) and
`no-restricted-syntax` (exported `new Subject`, non-private Subject class fields,
`Subject` in interface properties).

**Bad**

```ts
export const typing$ = new Subject<string>();                 // exported ✗
protected readonly join$ = new Subject<string>();             // template can call join$.next ✗
interface ChatSession { readonly outgoing: Subject<string> }  // anyone can .next/.error/.complete ✗
```

**Good** — keep the Subject private, expose a method and/or an Observable:

```ts
private readonly join$ = new Subject<string>();
protected join(name: string): void { this.join$.next(name); }

interface ChatSession { submit(text: string): void; readonly sent$: Observable<string> }
```

## R4 — `.subscribe()` only in `back-end/src/server.ts`

Never in the front-end (including tests).

Enforced by: ESLint `no-restricted-syntax` on `CallExpression[callee.property.name='subscribe']`
(allowed only in `back-end/src/server.ts`).

**Bad**

```ts
// component
session.sent$.pipe(takeUntilDestroyed()).subscribe(() => this.draft.setValue('')); ✗

// back-end/src/streams/chat-room.ts
room$.subscribe((m) => socket.send(JSON.stringify(m)));                           ✗
```

**Good** — return Observables; let the edge consume them:

```ts
// component: async pipe in the template, or toSignal for side-effect pipelines
toSignal(session.sent$.pipe(tap(() => this.draft.setValue(''))), { injector: this.injector });

// back-end/src/server.ts
chatRoom(chatClient$(server)).subscribe();
```

```ts
// tests: no subscribe either
expectObservable(messageList$(message$)).toBe('ea-b|', values);       // marble
expect(await firstValueFrom(connection.event$)).toEqual(joinedEvent);  // promise
```

## R5 — No nested subscribe

Enforced by: ESLint `rxjs-x/no-nested-subscribe`, `rxjs-x/no-subscribe-in-pipe`.

**Bad**

```ts
name$.subscribe((name) => {
  room$.subscribe((message) => send(name, message)); ✗
});
```

**Good**

```ts
name$.pipe(switchMap((name) => room$.pipe(tap((message) => send(name, message)))));
```

## R6 — `toSignal` only in components

Components are `front-end/src/app/chat/**` and `front-end/src/app/app.ts`.

Enforced by: ESLint `no-restricted-imports` of `toSignal` from `@angular/core/rxjs-interop`
everywhere except components.

**Bad**

```ts
// front-end/src/app/services/chat-socket.service.ts
readonly lastEvent = toSignal(this.event$); ✗  // services/streams return Observables
```

**Good**

```ts
// front-end/src/app/chat/chat-room/chat-room.ts
protected readonly messages = toSignal(this.session().messages$, { initialValue: [] }); ✓
```

## R7 — Time logic is a pure function in `streams/` with a marble test

Debounce, throttle, timers, delays, timeouts.

Enforced by: ESLint `no-restricted-imports` of time operators (`debounceTime`, `throttleTime`,
`timer`, `interval`, `delay`, `auditTime`, …) and `no-restricted-globals`
(`setTimeout`/`setInterval`) outside `streams/`; `scripts/check-time-logic.sh` fails when a
`streams/` file uses a time operator and its `.spec.ts` is missing or has no `TestScheduler`.

**Bad**

```ts
// component
this.draft.valueChanges.pipe(throttleTime(500)) ✗   // time logic in a component, untestable
setTimeout(() => this.clearTyping(), 2000)         ✗
```

**Good**

```ts
// front-end/src/app/streams/typing.ts
export function typingPings$(keystroke$: Observable<unknown>, windowMs = 500): Observable<void> {
  return keystroke$.pipe(throttleTime(windowMs), map(() => undefined));
}

// front-end/src/app/streams/typing.spec.ts
scheduler.run(({ cold, expectObservable }) => {
  expectObservable(typingPings$(cold('ab 498ms c 500ms d'))).toBe('a 499ms c 500ms d', …);
});
```

## R8 — Bad input never kills a stream

Parse to `null` + `filter`, or `catchError` around the part that can fail.

Enforced by: tests that feed garbage to every input boundary
(`events.spec.ts` `returns null for …`, `socket.spec.ts` `clientEvent$ (R8, FR-08)`,
`chat-room.spec.ts` `survives a client whose stream errors`,
`chat-socket.service.spec.ts` `drops invalid frames without ending the stream`).

**Bad**

```ts
message$.pipe(map((raw) => JSON.parse(raw) as ClientEvent)) ✗  // one bad frame errors the stream forever
connections.pipe(mergeMap((client) => clientSession(client))) ✗ // one failing client kills the room
```

**Good**

```ts
message$.pipe(
  map(parseClientEvent),                                   // returns null for anything invalid
  filter((event): event is ClientEvent => event !== null),
);
client$.pipe(mergeMap((client) => clientSession(client, room$).pipe(catchError(() => EMPTY))));
```

## R9 — Observable names end in `$`

Variables, parameters and properties. (Functions that *return* Observables may, but need not.)

Enforced by: ESLint `rxjs-x/finnish` (type-aware).

**Bad**

```ts
const socket = webSocket(url);                         ✗
export function chatRoom(connections: Observable<WebSocket>) ✗
```

**Good**

```ts
const socket$ = webSocket(url);
export function chatRoom(client$: Observable<ChatClient>)
```

---

## Guards

`scripts/check-guards.sh` fails on `eslint-disable`, `@ts-ignore`, `@ts-nocheck`,
`@ts-expect-error`, and on `.only`/`.skip`/`.todo`/`xit`/`fit` in specs. ESLint also runs with
`noInlineConfig`, so disable comments have no effect anyway.
