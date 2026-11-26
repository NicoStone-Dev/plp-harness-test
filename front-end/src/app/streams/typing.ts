import {
  concat,
  distinctUntilChanged,
  filter,
  groupBy,
  map,
  mergeMap,
  type Observable,
  of,
  race,
  scan,
  startWith,
  switchMap,
  take,
  tap,
  throttleTime,
  timer,
} from 'rxjs';
import { TYPING_THROTTLE_MS, TYPING_TIMEOUT_MS, type ServerEvent } from '../domain/events';

type JoinedEvent = Extract<ServerEvent, { type: 'joined' }>;
type MessageEvent = Extract<ServerEvent, { type: 'message' }>;
type TypingEvent = Extract<ServerEvent, { type: 'typing' }>;

const isJoined = (event: ServerEvent): event is JoinedEvent => event.type === 'joined';
const isMessage = (event: ServerEvent): event is MessageEvent => event.type === 'message';
const isTyping = (event: ServerEvent): event is TypingEvent => event.type === 'typing';

/** One user starting or stopping to show up in the indicator. */
interface TypingChange {
  readonly userId: string;
  readonly name: string;
  readonly typing: boolean;
}

/**
 * FR-10: keystrokes -> typing notices, at most one per 500 ms.
 * The first keystroke is sent right away (leading edge); the rest of the window is dropped.
 */
export function typingNotices$(keystroke$: Observable<unknown>, send: () => void): Observable<unknown> {
  return keystroke$.pipe(
    throttleTime(TYPING_THROTTLE_MS),
    tap(() => send()),
  );
}

/**
 * FR-11 / FR-12 / FR-13: server events -> names of the *other* users typing right now,
 * in the order they started typing.
 *
 * Per user: every typing event (re)starts a 2 s timer; the user is removed when the
 * timer fires or as soon as a message from them arrives, whichever comes first.
 */
export function typingNames$(event$: Observable<ServerEvent>): Observable<readonly string[]> {
  return event$.pipe(
    filter(isJoined),
    take(1),
    switchMap(({ userId: selfId }) => {
      const messageFrom$ = (userId: string) =>
        event$.pipe(filter((event) => isMessage(event) && event.message.authorId === userId));

      return event$.pipe(
        filter(isTyping),
        // FR-13: the server never echoes our own typing, but never trust the wire.
        filter((event) => event.userId !== selfId),
        groupBy((event) => event.userId),
        mergeMap((typist$) =>
          typist$.pipe(
            switchMap(({ userId, name }) =>
              concat(
                of<TypingChange>({ userId, name, typing: true }),
                race(timer(TYPING_TIMEOUT_MS), messageFrom$(userId)).pipe(
                  take(1),
                  map((): TypingChange => ({ userId, name, typing: false })),
                ),
              ),
            ),
          ),
        ),
        scan(applyChange, new Map<string, string>() as ReadonlyMap<string, string>),
        map((typists) => [...typists.values()]),
        startWith([] as readonly string[]),
        distinctUntilChanged(sameNames),
      );
    }),
  );
}

function applyChange(typists: ReadonlyMap<string, string>, change: TypingChange): ReadonlyMap<string, string> {
  const next = new Map(typists);
  if (change.typing) next.set(change.userId, change.name);
  else next.delete(change.userId);
  return next;
}

function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, i) => name === b[i]);
}

/** A piece of the indicator text; names are rendered in bold (docs/design/typing.png). */
export interface TypingSegment {
  readonly text: string;
  readonly name: boolean;
}

/**
 * FR-11: "Ana está digitando…", "Ana e Bruno estão digitando…",
 * "Ana, Bruno e Carla estão digitando…". Empty for nobody.
 */
export function typingSegments(names: readonly string[]): readonly TypingSegment[] {
  if (names.length === 0) return [];
  const segments: TypingSegment[] = [];
  names.forEach((name, i) => {
    if (i > 0) segments.push({ text: i === names.length - 1 ? ' e ' : ', ', name: false });
    segments.push({ text: name, name: true });
  });
  segments.push({ text: names.length === 1 ? ' está digitando…' : ' estão digitando…', name: false });
  return segments;
}

export function typingLabel(names: readonly string[]): string {
  return typingSegments(names)
    .map((segment) => segment.text)
    .join('');
}
