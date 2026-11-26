import { afterNextRender, type Injector } from '@angular/core';
import { filter, map, Observable, switchMap } from 'rxjs';

export const BOTTOM_THRESHOLD_PX = 40;

/** True when the element is scrolled to within `threshold` px of its bottom. */
export function isNearBottom(element: HTMLElement, threshold = BOTTOM_THRESHOLD_PX): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

export function scrollToBottom(element: HTMLElement): void {
  element.scrollTop = element.scrollHeight;
}

/** FR-17: animated scroll to the bottom; jumps where smooth scrolling is unavailable. */
export function scrollToBottomSmoothly(element: HTMLElement): void {
  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  } else {
    scrollToBottom(element);
  }
}

/**
 * FR-05 / FR-06: for each new message, decide *before* it is rendered whether to
 * follow it (own message, or the user was already near the bottom), then emit
 * once *after* it has been rendered — the moment to scroll.
 */
export function autoScroll$(
  message$: Observable<{ readonly own: boolean }>,
  wasNearBottom: () => boolean,
  rendered$: () => Observable<void>,
): Observable<void> {
  return message$.pipe(
    map((message) => message.own || wasNearBottom()),
    filter(Boolean),
    switchMap(() => rendered$()),
  );
}

/** Emits once, after Angular has rendered the pending changes to the DOM. */
export function nextRender(injector: Injector): Observable<void> {
  return new Observable<void>((subscriber) => {
    const ref = afterNextRender(
      () => {
        subscriber.next();
        subscriber.complete();
      },
      { injector },
    );
    return () => ref.destroy();
  });
}
