import platformEnv from '../platformEnv';

import { onVisibilityStateChange } from './appVisibility';

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: false,
    isExtension: false,
    isNative: false,
  },
}));

const mockPlatformEnv = platformEnv as {
  isDesktop: boolean;
  isExtension: boolean;
  isNative: boolean;
};

function installBrowserEventTargets() {
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
  return { documentTarget, testDocument, windowTarget };
}

describe('onVisibilityStateChange in browser runtimes', () => {
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  );
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

  beforeEach(() => {
    mockPlatformEnv.isDesktop = false;
    mockPlatformEnv.isExtension = false;
    mockPlatformEnv.isNative = false;
  });

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
    const { documentTarget, testDocument, windowTarget } =
      installBrowserEventTargets();
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

  it('preserves window focus changes for extension UI runtimes', () => {
    mockPlatformEnv.isExtension = true;
    const { documentTarget, testDocument, windowTarget } =
      installBrowserEventTargets();
    const listener = jest.fn();
    const unsubscribe = onVisibilityStateChange(listener);

    windowTarget.dispatchEvent(new Event('blur'));
    expect(listener).toHaveBeenLastCalledWith(false);

    windowTarget.dispatchEvent(new Event('focus'));
    expect(listener).toHaveBeenLastCalledWith(true);

    testDocument.visibilityState = 'hidden';
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    expect(listener).toHaveBeenLastCalledWith(false);

    unsubscribe();
    windowTarget.dispatchEvent(new Event('focus'));
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
