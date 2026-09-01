import { onVisibilityStateChange } from './appVisibility';

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: false,
    isNative: false,
  },
}));

describe('onVisibilityStateChange on web', () => {
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  );
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

  afterEach(() => {
    if (originalDocument) {
      Object.defineProperty(globalThis, 'document', originalDocument);
    } else {
      Reflect.deleteProperty(globalThis, 'document');
    }
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  });

  it('ignores window focus changes and reacts to document visibility changes', () => {
    const documentTarget = new EventTarget();
    const windowTarget = new EventTarget();
    const testDocument = Object.assign(documentTarget, {
      visibilityState: 'visible' as DocumentVisibilityState,
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: testDocument,
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: windowTarget,
    });
    const listener = jest.fn();
    const unsubscribe = onVisibilityStateChange(listener);

    windowTarget.dispatchEvent(new Event('blur'));
    windowTarget.dispatchEvent(new Event('focus'));
    expect(listener).not.toHaveBeenCalled();

    testDocument.visibilityState = 'hidden';
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    expect(listener).toHaveBeenLastCalledWith(false);

    testDocument.visibilityState = 'visible';
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    expect(listener).toHaveBeenLastCalledWith(true);

    unsubscribe();
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
