import { of } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { autoScroll$, BOTTOM_THRESHOLD_PX, isNearBottom, scrollToBottom, scrollToBottomSmoothly } from './scroll';

let scheduler: TestScheduler;

beforeEach(() => {
  scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
});

function box(scrollHeight: number, clientHeight: number, scrollTop: number): HTMLElement {
  return { scrollHeight, clientHeight, scrollTop } as HTMLElement;
}

describe('isNearBottom (FR-05)', () => {
  it('is true within 40 px of the bottom and false beyond', () => {
    expect(BOTTOM_THRESHOLD_PX).toBe(40);
    expect(isNearBottom(box(1000, 500, 500))).toBe(true);
    expect(isNearBottom(box(1000, 500, 460))).toBe(true);
    expect(isNearBottom(box(1000, 500, 459))).toBe(false);
  });
});

describe('scrollToBottom', () => {
  it('moves scrollTop to the end', () => {
    const element = box(1000, 500, 0);
    scrollToBottom(element);
    expect(element.scrollTop).toBe(1000);
  });
});

describe('scrollToBottomSmoothly (FR-17)', () => {
  it('asks for a smooth scroll to the end', () => {
    const scrollTo = vi.fn();
    const element = { ...box(1000, 500, 0), scrollTo } as unknown as HTMLElement;
    scrollToBottomSmoothly(element);
    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
  });

  it('falls back to a jump when scrollTo is not available', () => {
    const element = box(1000, 500, 0);
    scrollToBottomSmoothly(element);
    expect(element.scrollTop).toBe(1000);
  });
});

describe('autoScroll$', () => {
  const own = { own: true };
  const other = { own: false };

  it('scrolls after render for own messages, always (FR-06)', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const message$ = cold('-a--b-', { a: own, b: own });
      expectObservable(autoScroll$(message$, () => false, () => cold('--(r|)', { r: undefined }))).toBe(
        '---r--r',
        { r: undefined },
      );
    });
  });

  it("scrolls for others' messages only when the user was near the bottom (FR-05)", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const nearBottom = [true, false, true];
      const message$ = cold('-a-b-c-', { a: other, b: other, c: other });
      expectObservable(
        autoScroll$(message$, () => nearBottom.shift() ?? false, () => of(undefined)),
      ).toBe('-a---c-', { a: undefined, c: undefined });
    });
  });

  it('measures before the render and drops a pending render when a newer message arrives', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const message$ = cold('-ab----', { a: own, b: own });
      expectObservable(autoScroll$(message$, () => false, () => cold('--(r|)', { r: undefined }))).toBe(
        '----r--',
        { r: undefined },
      );
    });
  });
});
