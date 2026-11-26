import { TestScheduler } from 'rxjs/testing';
import { unreadCount$, unreadLabel } from './unread';

const newScheduler = () => new TestScheduler((actual, expected) => expect(actual).toEqual(expected));

const msg = { o: { own: false }, m: { own: true } };

describe('unreadCount$', () => {
  it('FR-15: counts others\' messages while scrolled up', () => {
    newScheduler().run(({ hot, expectObservable }) => {
      const count$ = unreadCount$(hot('-o-o-o', msg), () => false, hot(''));
      expectObservable(count$).toBe('0a-b-c', { 0: 0, a: 1, b: 2, c: 3 });
    });
  });

  it('FR-15: does not count while near the bottom', () => {
    newScheduler().run(({ hot, expectObservable }) => {
      let nearBottom = true;
      const message$ = hot('-o-o', msg);
      hot('--x').subscribe(() => (nearBottom = false));
      const count$ = unreadCount$(message$, () => nearBottom, hot(''));
      expectObservable(count$).toBe('0--a', { 0: 0, a: 1 });
    });
  });

  it('FR-19: own messages never increase the counter', () => {
    newScheduler().run(({ hot, expectObservable }) => {
      const count$ = unreadCount$(hot('-o-m-m-o', msg), () => false, hot(''));
      expectObservable(count$).toBe('0a-----b', { 0: 0, a: 1, b: 2 });
    });
  });

  it('FR-17 / FR-18: a reset (pill click or reaching the bottom) sets it back to 0', () => {
    newScheduler().run(({ hot, expectObservable }) => {
      const count$ = unreadCount$(hot('-o-o--o', msg), () => false, hot('-----r'));
      expectObservable(count$).toBe('0a-b-za', { 0: 0, a: 1, b: 2, z: 0 });
    });
  });

  it('does not re-emit 0 for a reset at 0', () => {
    newScheduler().run(({ hot, expectObservable }) => {
      const count$ = unreadCount$(hot(''), () => false, hot('-r-r'));
      expectObservable(count$).toBe('0', { 0: 0 });
    });
  });
});

describe('unreadLabel (FR-16)', () => {
  it('uses singular for 1 and plural otherwise', () => {
    expect(unreadLabel(1)).toBe('1 nova mensagem');
    expect(unreadLabel(3)).toBe('3 novas mensagens');
    expect(unreadLabel(12)).toBe('12 novas mensagens');
  });
});
