const initMock = jest.fn();

function passthrough<T>(value: T): T {
  return value;
}

jest.mock('@sentry/react-native', () => ({
  init: initMock,
  nativeCrash: jest.fn(),
  reactNavigationIntegration: jest.fn(() => 'navigationIntegration'),
  reactNativeTracingIntegration: jest.fn(() => 'reactNativeTracingIntegration'),
  withErrorBoundary: jest.fn(passthrough),
  withProfiler: jest.fn(passthrough),
  wrap: jest.fn(passthrough),
}));

describe('initSentry', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    initMock.mockClear();
    jest.resetModules();
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
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
    // Both sample rates must be stripped: a numeric tracesSampleRate (even 0)
    // makes @sentry/react-native treat tracing as enabled and re-add its
    // default tracing integrations despite `integrations: []`.
    expect(initMock.mock.calls[0][0].tracesSampleRate).toBeUndefined();
    expect(initMock.mock.calls[0][0].profilesSampleRate).toBeUndefined();
  });
});
