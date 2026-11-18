import {
  IME_KEYCODE,
  createImeCompositionLock,
  getKeyboardEventKey,
  isImeComposingKeyboardEvent,
} from './imeUtils';

describe('isImeComposingKeyboardEvent', () => {
  it('detects isComposing on the event', () => {
    expect(
      isImeComposingKeyboardEvent({ key: 'Enter', isComposing: true }),
    ).toBe(true);
  });

  it('detects IME keyCode 229', () => {
    expect(
      isImeComposingKeyboardEvent({ key: 'Enter', keyCode: IME_KEYCODE }),
    ).toBe(true);
  });

  it('detects composing flags on nativeEvent', () => {
    expect(
      isImeComposingKeyboardEvent({
        nativeEvent: { key: 'Enter', isComposing: true },
      }),
    ).toBe(true);
    expect(
      isImeComposingKeyboardEvent({
        nativeEvent: { key: 'Enter', keyCode: IME_KEYCODE },
      }),
    ).toBe(true);
  });

  it('is false for a normal Enter', () => {
    expect(
      isImeComposingKeyboardEvent({
        key: 'Enter',
        keyCode: 13,
        isComposing: false,
      }),
    ).toBe(false);
  });
});

describe('getKeyboardEventKey', () => {
  it('reads key from the event or nativeEvent', () => {
    expect(getKeyboardEventKey({ key: 'Enter' })).toBe('Enter');
    expect(getKeyboardEventKey({ nativeEvent: { key: 'Escape' } })).toBe(
      'Escape',
    );
    expect(getKeyboardEventKey({})).toBe('');
  });
});

describe('createImeCompositionLock', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ignores Enter until after the composition confirm window', () => {
    const lock = createImeCompositionLock();
    const enterEvent = { key: 'Enter', keyCode: 13 };

    lock.start();
    expect(lock.shouldIgnoreKeyboardEvent(enterEvent)).toBe(true);

    lock.end();
    expect(lock.shouldIgnoreKeyboardEvent(enterEvent)).toBe(true);

    jest.runOnlyPendingTimers();
    expect(lock.shouldIgnoreKeyboardEvent(enterEvent)).toBe(false);
  });

  it('ignores a composing Enter even when the lock is unlocked', () => {
    const lock = createImeCompositionLock();
    expect(
      lock.shouldIgnoreKeyboardEvent({ key: 'Enter', isComposing: true }),
    ).toBe(true);
  });

  it('cancels a pending unlock when composition starts again', () => {
    const lock = createImeCompositionLock();
    const enterEvent = { key: 'Enter', keyCode: 13 };

    lock.start();
    lock.end();
    lock.start();
    jest.runOnlyPendingTimers();
    expect(lock.shouldIgnoreKeyboardEvent(enterEvent)).toBe(true);

    lock.dispose();
  });

  it('dispose clears the pending unlock', () => {
    const lock = createImeCompositionLock();
    lock.start();
    lock.end();
    lock.dispose();
    jest.runOnlyPendingTimers();
    expect(lock.isLocked()).toBe(false);
  });

  it('ignores a Safari IME 229 Enter after compositionend before unlock', () => {
    const lock = createImeCompositionLock();
    lock.start();
    lock.end();
    expect(
      lock.shouldIgnoreKeyboardEvent({
        key: 'Enter',
        keyCode: IME_KEYCODE,
      }),
    ).toBe(true);

    jest.runOnlyPendingTimers();
    expect(
      lock.shouldIgnoreKeyboardEvent({
        key: 'Enter',
        keyCode: 13,
        isComposing: false,
      }),
    ).toBe(false);
  });
});
