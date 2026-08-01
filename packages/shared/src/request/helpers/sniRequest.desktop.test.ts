import { defaultLogger } from '../../logger/logger';
import platformEnv from '../../platformEnv';

import { isProxyActiveForUrl, sniRequest } from './sniRequest.desktop';

import type { ISniRequestConfig, ISniResponse } from '../types/ipTable';

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

jest.mock('../../utils/miscUtils', () => ({
  generateUUID: jest.fn(() => 'desktop-generated-request-id'),
}));

type DesktopApiProxyMock = {
  sniRequest?: {
    request?: jest.Mock<Promise<ISniResponse>, [ISniRequestConfig]>;
    cancelRequest?: jest.Mock<Promise<{ success: boolean }>, [string]>;
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

function buildSniRequestConfig(): ISniRequestConfig {
  return {
    ip: '93.184.216.34',
    hostname: 'example.com',
    path: '/health',
    headers: {},
    method: 'GET',
    body: null,
    timeout: 10_000,
  };
}

const sniResponse: ISniResponse = {
  statusCode: 204,
  headers: {},
  body: '',
};

describe('sniRequest.desktop compatibility', () => {
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

  test('cancels an in-flight request with its generated request id', async () => {
    let resolveRequest: ((response: ISniResponse) => void) | undefined;
    const request = jest.fn<Promise<ISniResponse>, [ISniRequestConfig]>(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const cancelRequest = jest
      .fn<Promise<{ success: boolean }>, [string]>()
      .mockResolvedValue({ success: true });
    setDesktopApiProxy({ sniRequest: { request, cancelRequest } });
    const controller = new AbortController();

    const responsePromise = sniRequest(buildSniRequestConfig(), {
      signal: controller.signal,
    });
    controller.abort();

    await expect(responsePromise).rejects.toMatchObject({
      code: 'SNI_CANCELLED',
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'desktop-generated-request-id' }),
    );
    expect(cancelRequest).toHaveBeenCalledWith('desktop-generated-request-id');

    resolveRequest?.(sniResponse);
  });

  test('does not start a request for an already aborted signal', async () => {
    const request = jest
      .fn<Promise<ISniResponse>, [ISniRequestConfig]>()
      .mockResolvedValue(sniResponse);
    const cancelRequest = jest
      .fn<Promise<{ success: boolean }>, [string]>()
      .mockResolvedValue({ success: true });
    setDesktopApiProxy({ sniRequest: { request, cancelRequest } });
    const controller = new AbortController();
    controller.abort();

    await expect(
      sniRequest(buildSniRequestConfig(), { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'SNI_CANCELLED' });
    expect(request).not.toHaveBeenCalled();
    expect(cancelRequest).not.toHaveBeenCalled();
  });

  test('removes the abort listener after a request completes', async () => {
    const request = jest
      .fn<Promise<ISniResponse>, [ISniRequestConfig]>()
      .mockResolvedValue(sniResponse);
    const cancelRequest = jest
      .fn<Promise<{ success: boolean }>, [string]>()
      .mockResolvedValue({ success: true });
    setDesktopApiProxy({ sniRequest: { request, cancelRequest } });
    const controller = new AbortController();

    await expect(
      sniRequest(buildSniRequestConfig(), { signal: controller.signal }),
    ).resolves.toEqual(sniResponse);
    controller.abort();

    expect(cancelRequest).not.toHaveBeenCalled();
  });
});
