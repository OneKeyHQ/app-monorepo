type INativeSentryOptions = Parameters<
  typeof import('@sentry/react-native').init
>[0];

const initMock = jest.fn<void, [INativeSentryOptions]>();

function passthrough<T>(value: T): T {
  return value;
}

jest.mock('@sentry/react-native', () => ({
  init: initMock,
  nativeCrash: jest.fn(),
  reactNavigationIntegration: jest.fn(() => 'navigationIntegration'),
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
    expect(initMock.mock.calls[0][0].tracesSampleRate).toBeUndefined();
    expect(initMock.mock.calls[0][0].profilesSampleRate).toBeUndefined();
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
  });
});
