import {
  IME_KEYCODE,
  IME_PROCESS_KEY,
  attachImeCompositionListeners,
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

  it('detects the IME Process key', () => {
    expect(
      isImeComposingKeyboardEvent({
        key: IME_PROCESS_KEY,
        keyCode: IME_KEYCODE,
      }),
    ).toBe(true);
    expect(
      isImeComposingKeyboardEvent({
        nativeEvent: { key: IME_PROCESS_KEY },
      }),
    ).toBe(true);
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

describe('attachImeCompositionListeners', () => {
  it('binds start, update, and end, then removes them on dispose', () => {
    const listeners = new Map<string, Array<(event: Event) => void>>();
    const node = {
      addEventListener(type: string, listener: (event: Event) => void) {
        const current = listeners.get(type) ?? [];
        current.push(listener);
        listeners.set(type, current);
      },
      removeEventListener(type: string, listener: (event: Event) => void) {
        listeners.set(
          type,
          (listeners.get(type) ?? []).filter((item) => item !== listener),
        );
      },
    };
    const onStart = jest.fn();
    const onUpdate = jest.fn();
    const onEnd = jest.fn();
    const detach = attachImeCompositionListeners(node, {
      onStart,
      onUpdate,
      onEnd,
    });

    const startEvent = { type: 'compositionstart' } as Event;
    const updateEvent = { type: 'compositionupdate' } as Event;
    const endEvent = { type: 'compositionend' } as Event;
    listeners.get('compositionstart')?.[0](startEvent);
    listeners.get('compositionupdate')?.[0](updateEvent);
    listeners.get('compositionend')?.[0](endEvent);

    expect(onStart).toHaveBeenCalledWith(startEvent);
    expect(onUpdate).toHaveBeenCalledWith(updateEvent);
    expect(onEnd).toHaveBeenCalledWith(endEvent);

    detach();
    expect(listeners.get('compositionstart')).toEqual([]);
    expect(listeners.get('compositionupdate')).toEqual([]);
    expect(listeners.get('compositionend')).toEqual([]);
  });

  it('drives the composition lock from DOM events', () => {
    jest.useFakeTimers();
    const lock = createImeCompositionLock();
    const listeners = new Map<string, Array<(event: Event) => void>>();
    const node = {
      addEventListener(type: string, listener: (event: Event) => void) {
        const current = listeners.get(type) ?? [];
        current.push(listener);
        listeners.set(type, current);
      },
      removeEventListener() {},
    };
    attachImeCompositionListeners(node, {
      onStart: lock.start,
      onUpdate: lock.start,
      onEnd: lock.end,
    });

    listeners.get('compositionupdate')?.[0]({} as Event);
    listeners.get('compositionend')?.[0]({} as Event);
    expect(lock.shouldIgnoreKeyboardEvent({ key: 'Enter', keyCode: 13 })).toBe(
      true,
    );

    jest.runOnlyPendingTimers();
    expect(lock.shouldIgnoreKeyboardEvent({ key: 'Enter', keyCode: 13 })).toBe(
      false,
    );
    lock.dispose();
    jest.useRealTimers();
  });
});
