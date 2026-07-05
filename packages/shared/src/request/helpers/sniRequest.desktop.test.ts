import { defaultLogger } from '../../logger/logger';
import platformEnv from '../../platformEnv';

import { isProxyActiveForUrl } from './sniRequest.desktop';

jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: true,
  },
}));

jest.mock('../../logger/logger', () => ({
  defaultLogger: {
    ipTable: {
      request: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    },
  },
}));

type DesktopApiProxyMock = {
  sniRequest?: {
    isProxyActiveForUrl?: jest.Mock<Promise<boolean>, [string]>;
  };
};

const mockedPlatformEnv = platformEnv as jest.Mocked<typeof platformEnv>;

type LogMethod = typeof defaultLogger.ipTable.request.warn;
type LogMethodMock = jest.Mock<ReturnType<LogMethod>, Parameters<LogMethod>>;

function getWarnLogCalls(): LogMethodMock['mock']['calls'] {
  return (defaultLogger.ipTable.request.warn as unknown as LogMethodMock).mock
    .calls;
}

function getErrorLogCalls(): LogMethodMock['mock']['calls'] {
  return (defaultLogger.ipTable.request.error as unknown as LogMethodMock).mock
    .calls;
}

function setDesktopApiProxy(value: DesktopApiProxyMock | undefined): void {
  Object.defineProperty(globalThis, 'desktopApiProxy', {
    configurable: true,
    writable: true,
    value,
  });
}

describe('sniRequest.desktop proxy preflight compatibility', () => {
  let originalDesktopApiProxyDescriptor: PropertyDescriptor | undefined;

  beforeAll(() => {
    originalDesktopApiProxyDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'desktopApiProxy',
    );
  });

  beforeEach(() => {
    mockedPlatformEnv.isDesktop = true;
    jest.clearAllMocks();
  });

  afterEach(() => {
    setDesktopApiProxy(undefined);
  });

  afterAll(() => {
    if (originalDesktopApiProxyDescriptor) {
      Object.defineProperty(
        globalThis,
        'desktopApiProxy',
        originalDesktopApiProxyDescriptor,
      );
    } else {
      Reflect.deleteProperty(globalThis, 'desktopApiProxy');
    }
  });

  test('returns the desktop preflight result when the native method exists', async () => {
    const isProxyActive = jest
      .fn<Promise<boolean>, [string]>()
      .mockResolvedValue(false);
    setDesktopApiProxy({
      sniRequest: {
        isProxyActiveForUrl: isProxyActive,
      },
    });

    await expect(
      isProxyActiveForUrl('https://example.com/health'),
    ).resolves.toBe(false);

    expect(isProxyActive).toHaveBeenCalledWith('https://example.com/health');
    expect(getWarnLogCalls()).toHaveLength(0);
    expect(getErrorLogCalls()).toHaveLength(0);
  });

  test('returns null when old desktop native does not expose the preflight method', async () => {
    const isProxyActive = jest
      .fn<Promise<boolean>, [string]>()
      .mockRejectedValue(
        new Error(
          'callRemoteApiMethod not found: desktopApi.sniRequest.isProxyActiveForUrl() ',
        ),
      );
    setDesktopApiProxy({
      sniRequest: {
        isProxyActiveForUrl: isProxyActive,
      },
    });

    await expect(
      isProxyActiveForUrl('https://example.com/health'),
    ).resolves.toBeNull();

    expect(getWarnLogCalls()).toEqual([
      [
        expect.objectContaining({
          info: expect.stringContaining('decision=legacy_sni'),
        }),
      ],
    ]);
    expect(getErrorLogCalls()).toHaveLength(0);
  });

  test('rethrows non-capability desktop preflight errors', async () => {
    const error = new Error('resolveProxy failed');
    const isProxyActive = jest
      .fn<Promise<boolean>, [string]>()
      .mockRejectedValue(error);
    setDesktopApiProxy({
      sniRequest: {
        isProxyActiveForUrl: isProxyActive,
      },
    });

    await expect(
      isProxyActiveForUrl('https://example.com/health'),
    ).rejects.toThrow(error);

    expect(getErrorLogCalls()).toEqual([
      [
        expect.objectContaining({
          info: expect.stringContaining('decision=fallback'),
        }),
      ],
    ]);
  });
});
