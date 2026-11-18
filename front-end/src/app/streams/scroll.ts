import { afterNextRender, type Injector } from '@angular/core';
import { Observable } from 'rxjs';

export const BOTTOM_THRESHOLD_PX = 40;

/** True when the element is scrolled to within `threshold` px of its bottom. */
export function isNearBottom(element: HTMLElement, threshold = BOTTOM_THRESHOLD_PX): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

export function scrollToBottom(element: HTMLElement): void {
  element.scrollTop = element.scrollHeight;
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
