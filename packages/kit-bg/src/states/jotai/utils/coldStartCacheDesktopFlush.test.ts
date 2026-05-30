const addWindowEventListener = jest.fn();
const addDocumentEventListener = jest.fn();
const swrFlushNow = jest.fn();

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: true,
    isExtensionUi: false,
    isNative: false,
  },
}));

jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    LogLevel: { Info: 'info' },
    NativeLogger: { write: jest.fn() },
  }),
);

jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: {
    flushNow: swrFlushNow,
  },
}));

jest.mock('../jotaiStorage', () => ({
  MMKV_MIGRATION_COMPLETE_KEY: 'migration-complete',
  atomWithStorage: jest.fn(),
  buildJotaiStorageKey: jest.fn((name: string) => name),
  globalJotaiStorageReadyHandler: {
    isReady: true,
    ready: Promise.resolve(),
  },
}));

describe('desktop cold-start cache flush listener', () => {
  beforeEach(() => {
    jest.resetModules();
    addWindowEventListener.mockReset();
    addDocumentEventListener.mockReset();
    swrFlushNow.mockReset();

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        addEventListener: addWindowEventListener,
      },
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        addEventListener: addDocumentEventListener,
        visibilityState: 'visible',
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'document');
  });

  it('flushes cold-start caches on desktop beforeunload', () => {
    let beforeUnloadHandler: (() => void) | undefined;
    addWindowEventListener.mockImplementation((eventName, handler) => {
      if (eventName === 'beforeunload') {
        beforeUnloadHandler = handler;
      }
    });

    const { ensureColdStartDesktopUnloadListener } =
      require('./index') as typeof import('./index');

    ensureColdStartDesktopUnloadListener();

    expect(addWindowEventListener).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    );

    beforeUnloadHandler?.();

    expect(swrFlushNow).toHaveBeenCalledTimes(1);
  });

  it('flushes cold-start caches when desktop document becomes hidden', () => {
    let visibilityHandler: (() => void) | undefined;
    addDocumentEventListener.mockImplementation((eventName, handler) => {
      if (eventName === 'visibilitychange') {
        visibilityHandler = handler;
      }
    });

    const { ensureColdStartDesktopUnloadListener } =
      require('./index') as typeof import('./index');

    ensureColdStartDesktopUnloadListener();
    Object.defineProperty(globalThis.document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    visibilityHandler?.();

    expect(swrFlushNow).toHaveBeenCalledTimes(1);
  });
});
