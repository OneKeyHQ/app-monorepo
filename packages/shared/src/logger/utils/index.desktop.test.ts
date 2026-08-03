describe('desktop logger console transport', () => {
  const loadDesktopLoggerUtils = ({ isDev }: { isDev: boolean }) => {
    const mockConsoleTransport = { level: false as false | string };
    const mockAppLogger = { info: jest.fn() };

    jest.resetModules();
    jest.doMock('electron-log/renderer', () => ({
      __esModule: true,
      default: {
        transports: { console: mockConsoleTransport },
        scope: jest.fn(() => mockAppLogger),
      },
    }));
    jest.doMock('../../platformEnv', () => ({
      __esModule: true,
      default: {
        isDev,
        appPlatform: 'desktop',
        appChannel: 'desktop',
        buildNumber: '1',
        bundleVersion: '1',
        githubSHA: 'test',
        version: '1.0.0',
      },
    }));

    Object.defineProperty(globalThis, 'desktopApi', {
      configurable: true,
      value: {
        platform: 'darwin',
        systemVersion: 'test',
      },
    });

    jest.isolateModules(() => {
      require('./index.desktop');
    });

    return mockConsoleTransport;
  };

  afterEach(() => {
    jest.dontMock('electron-log/renderer');
    jest.dontMock('../../platformEnv');
    Reflect.deleteProperty(globalThis, 'desktopApi');
  });

  it('开发环境开启控制台日志', () => {
    expect(loadDesktopLoggerUtils({ isDev: true }).level).toBe('silly');
  });

  it('生产环境保持关闭控制台日志', () => {
    expect(loadDesktopLoggerUtils({ isDev: false }).level).toBe(false);
  });
});
