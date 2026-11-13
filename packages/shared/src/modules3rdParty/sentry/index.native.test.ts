type INativeSentryOptions = Parameters<
  typeof import('@sentry/react-native').init
>[0];

const initMock = jest.fn<void, [INativeSentryOptions]>();
const captureExceptionMock = jest.fn();
const nativeRejectionOptionsMock = jest.fn();

function passthrough<T>(value: T): T {
  return value;
}

jest.mock('@sentry/react-native', () => ({
  init: initMock,
  captureException: captureExceptionMock,
  reactNativeErrorHandlersIntegration: jest.fn((options) => ({
    name: 'ReactNativeErrorHandlers',
    options,
  })),
  nativeCrash: jest.fn(),
  reactNavigationIntegration: jest.fn(() => 'navigationIntegration'),
  withErrorBoundary: jest.fn(passthrough),
  withProfiler: jest.fn(passthrough),
  wrap: jest.fn(passthrough),
}));

// The repository's web Jest preset excludes native SDK ESM from transforms.
// Execute the installed helper source so its error normalization stays real.
jest.mock('@sentry/react-native/dist/js/utils/error', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vm = require('node:vm') as typeof import('node:vm');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const swc = require('@swc/core') as typeof import('@swc/core');
  const source = fs.readFileSync(
    require.resolve('@sentry/react-native/dist/js/utils/error'),
    'utf8',
  );
  const { code } = swc.transformSync(source, {
    jsc: { target: 'es2022', parser: { syntax: 'ecmascript' } },
    module: { type: 'commonjs' },
  });
  const sdkExports = {};
  vm.runInNewContext(code, { exports: sdkExports });
  return sdkExports;
});

jest.mock('../../errors/nativePromiseRejectionTracker.native', () => ({
  setNativePromiseRejectionTrackingOptions: nativeRejectionOptionsMock,
}));

describe('initSentry', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalLockdown = process.env.ONEKEY_MOBILE_LOCKDOWN;
  const originalHermes = Object.getOwnPropertyDescriptor(
    globalThis,
    'HermesInternal',
  );

  beforeEach(() => {
    initMock.mockClear();
    captureExceptionMock.mockClear();
    nativeRejectionOptionsMock.mockClear();
    jest.resetModules();
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  afterEach(() => {
    if (originalLockdown === undefined)
      delete process.env.ONEKEY_MOBILE_LOCKDOWN;
    else process.env.ONEKEY_MOBILE_LOCKDOWN = originalLockdown;
    if (originalHermes)
      Object.defineProperty(globalThis, 'HermesInternal', originalHermes);
    else Reflect.deleteProperty(globalThis, 'HermesInternal');
  });

  test('keeps Sentry rejection capture through the prepared Hermes observer', () => {
    Object.defineProperty(globalThis, 'HermesInternal', {
      configurable: true,
      value: { hasPromise: () => true },
    });
    delete process.env.ONEKEY_MOBILE_LOCKDOWN;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initSentry } =
      require('./index.native') as typeof import('./index.native');
    initSentry();
    const integrations = initMock.mock.calls[0][0].integrations;
    expect(Array.isArray(integrations)).toBe(true);
    if (!Array.isArray(integrations)) return;
    expect(integrations[0]).toMatchObject({
      name: 'ReactNativeErrorHandlers',
      options: { onunhandledrejection: false },
    });
    integrations
      .find((integration) => integration.name === 'OneKeyHermesPromiseErrors')
      ?.setupOnce?.();
    expect(nativeRejectionOptionsMock).toHaveBeenCalledTimes(1);
    const options = nativeRejectionOptionsMock.mock.calls[0][0] as {
      allRejections: boolean;
      onUnhandled: (id: number, error: unknown) => void;
      onHandled: (id: number) => void;
    };
    expect(options.allRejections).toBe(true);
    for (const rejection of [
      new Error('fixture'),
      { stack: 'fixture stack' },
      'fixture',
      undefined,
    ]) {
      options.onUnhandled(7, rejection);
      expect(captureExceptionMock).toHaveBeenLastCalledWith(rejection, {
        data: { id: 7 },
        originalException: rejection,
        syntheticException:
          rejection && typeof rejection === 'object' && 'stack' in rejection
            ? undefined
            : expect.objectContaining({ framesToPop: 3 }),
        mechanism: { handled: true, type: 'onunhandledrejection' },
      });
    }
    options.onHandled(7);
    expect(captureExceptionMock).toHaveBeenCalledTimes(4);
  });

  test('rollback preserves the default Sentry integrations', () => {
    Object.defineProperty(globalThis, 'HermesInternal', {
      configurable: true,
      value: { hasPromise: () => true },
    });
    process.env.ONEKEY_MOBILE_LOCKDOWN = 'false';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initSentry } =
      require('./index.native') as typeof import('./index.native');
    initSentry();
    expect(initMock.mock.calls[0][0].integrations).toEqual([]);
    expect(nativeRejectionOptionsMock).not.toHaveBeenCalled();
  });

  test('omits tracesSampleRate and profilesSampleRate for React Native production init', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
      const {
        initSentry,
      }: {
        initSentry: () => void;
      } = require('./index.native');

      initSentry();
    });

    expect(initMock).toHaveBeenCalledTimes(1);
    expect(initMock.mock.calls[0][0].tracesSampleRate).toBeUndefined();
    expect(initMock.mock.calls[0][0].profilesSampleRate).toBeUndefined();
    expect(initMock.mock.calls[0][0].autoInitializeNativeSdk).toBe(false);
    expect(initMock.mock.calls[0][0].enableNativeCrashHandling).toBeUndefined();
    expect(initMock.mock.calls[0][0].enableNdk).toBeUndefined();
    expect(initMock.mock.calls[0][0].enableAppHangTracking).toBeUndefined();
    expect(initMock.mock.calls[0][0].maxCacheItems).toBeUndefined();
    expect(initMock.mock.calls[0][0].attachScreenshot).toBe(false);
    expect(initMock.mock.calls[0][0].attachViewHierarchy).toBe(false);
    expect(initMock.mock.calls[0][0].sendDefaultPii).toBe(false);
  });

  test('sanitizes sensitive data with the React Native v10 event callback', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
      const {
        initSentry,
      }: {
        initSentry: () => void;
      } = require('./index.native');

      initSentry();
    });

    const event = {
      type: undefined,
      breadcrumbs: [
        {
          category: 'navigation',
          data: { from: 'Home', to: 'WalletDetails' },
        },
      ],
      exception: {
        values: [
          {
            value:
              'secret 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            stacktrace: {
              frames: [
                {
                  context_line: 'abandon ability able',
                },
              ],
            },
          },
        ],
      },
    };
    const beforeSend = initMock.mock.calls[0][0].beforeSend;
    expect(beforeSend).toBeDefined();
    const result = beforeSend?.(event, {});

    expect(result).toBe(event);
    expect(event.exception.values[0].value).toBe('secret ****');
    expect(event.exception.values[0].stacktrace.frames[0].context_line).toBe(
      '**** **** ****',
    );
    expect(event.breadcrumbs).toEqual([]);
  });
});
