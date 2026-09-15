import { OneKeyLocalError } from '../../errors';
import { defaultLogger } from '../../logger/logger';
import platformEnv from '../../platformEnv';
import {
  getAvailabilityProxyState,
  noteAvailabilityProxyPreflight,
  resetAvailabilityContextForTest,
} from '../availabilityContext';

import { isProxyActiveForUrl, sniRequest } from './sniRequest.desktop';

import type {
  ISniRequestCancelSettledResult,
  ISniRequestConfig,
  ISniRequestTransportSettledResult,
  ISniResponse,
} from '../types/ipTable';

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

jest.mock('../availabilityContext', () => {
  const actual = jest.requireActual<typeof import('../availabilityContext')>(
    '../availabilityContext',
  );
  return {
    ...actual,
    noteAvailabilityProxyPreflight: jest.fn(
      actual.noteAvailabilityProxyPreflight,
    ),
  };
});

type DesktopApiProxyMock = {
  sniRequest?: {
    request?: jest.Mock<Promise<ISniResponse>, [ISniRequestConfig]>;
    cancelRequest?: jest.Mock<Promise<{ success: boolean }>, [string]>;
    isProxyActiveForUrl?: jest.Mock<Promise<boolean>, [string]>;
  };
};

const mockedPlatformEnv = platformEnv as jest.Mocked<typeof platformEnv>;
const mockedNoteProxyPreflight =
  noteAvailabilityProxyPreflight as jest.MockedFunction<
    typeof noteAvailabilityProxyPreflight
  >;

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

const preflightUrl = 'https://example.com/health';
const preflightHostname = 'example.com';
const otherHostname = 'other.example.com';

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
    resetAvailabilityContextForTest();
  });

  afterEach(() => {
    setDesktopApiProxy(undefined);
    resetAvailabilityContextForTest();
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
    expect(mockedNoteProxyPreflight).toHaveBeenCalledWith(
      preflightHostname,
      false,
    );
    expect(getAvailabilityProxyState(preflightHostname)).toBe('off');
    expect(getAvailabilityProxyState(otherHostname)).toBe('unknown');
  });

  test('notes an active proxy for the URL hostname only and returns true unchanged', async () => {
    const isProxyActive = jest
      .fn<Promise<boolean>, [string]>()
      .mockResolvedValue(true);
    setDesktopApiProxy({
      sniRequest: {
        isProxyActiveForUrl: isProxyActive,
      },
    });

    await expect(
      isProxyActiveForUrl('https://example.com/health'),
    ).resolves.toBe(true);

    expect(getAvailabilityProxyState(preflightHostname)).toBe('on');
    expect(getAvailabilityProxyState(otherHostname)).toBe('unknown');
  });

  test('does not overwrite the state noted for another hostname', async () => {
    noteAvailabilityProxyPreflight(otherHostname, true);
    const isProxyActive = jest
      .fn<Promise<boolean>, [string]>()
      .mockResolvedValue(false);
    setDesktopApiProxy({
      sniRequest: {
        isProxyActiveForUrl: isProxyActive,
      },
    });

    await expect(isProxyActiveForUrl(preflightUrl)).resolves.toBe(false);

    expect(getAvailabilityProxyState(preflightHostname)).toBe('off');
    expect(getAvailabilityProxyState(otherHostname)).toBe('on');
  });

  test('does not label any hostname when the URL cannot be parsed', async () => {
    const isProxyActive = jest
      .fn<Promise<boolean>, [string]>()
      .mockResolvedValue(true);
    setDesktopApiProxy({
      sniRequest: {
        isProxyActiveForUrl: isProxyActive,
      },
    });

    await expect(isProxyActiveForUrl('not a url')).resolves.toBe(true);

    expect(mockedNoteProxyPreflight).toHaveBeenCalledWith(undefined, true);
    expect(getAvailabilityProxyState(preflightHostname)).toBe('unknown');
    expect(getAvailabilityProxyState(undefined)).toBe('unknown');
  });

  test('notes unknown when the desktop API has no preflight method', async () => {
    noteAvailabilityProxyPreflight(preflightHostname, true);
    setDesktopApiProxy({ sniRequest: {} });

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
    expect(getAvailabilityProxyState(preflightHostname)).toBe('unknown');
    expect(getAvailabilityProxyState(otherHostname)).toBe('unknown');
  });

  test('notes unknown outside the desktop runtime', async () => {
    noteAvailabilityProxyPreflight(preflightHostname, false);
    mockedPlatformEnv.isDesktop = false;
    const isProxyActive = jest
      .fn<Promise<boolean>, [string]>()
      .mockResolvedValue(true);
    setDesktopApiProxy({
      sniRequest: {
        isProxyActiveForUrl: isProxyActive,
      },
    });

    await expect(
      isProxyActiveForUrl('https://example.com/health'),
    ).resolves.toBeNull();

    expect(isProxyActive).not.toHaveBeenCalled();
    expect(getAvailabilityProxyState(preflightHostname)).toBe('unknown');
    expect(getAvailabilityProxyState(otherHostname)).toBe('unknown');
  });

  test('keeps the preflight result when noting the context throws', async () => {
    const isProxyActive = jest
      .fn<Promise<boolean>, [string]>()
      .mockResolvedValue(false);
    setDesktopApiProxy({
      sniRequest: {
        isProxyActiveForUrl: isProxyActive,
      },
    });
    mockedNoteProxyPreflight.mockImplementationOnce(() => {
      throw new OneKeyLocalError('context unavailable');
    });

    await expect(
      isProxyActiveForUrl('https://example.com/health'),
    ).resolves.toBe(false);

    expect(mockedNoteProxyPreflight).toHaveBeenCalledWith(
      preflightHostname,
      false,
    );
    expect(getErrorLogCalls()).toHaveLength(0);
    expect(getAvailabilityProxyState(preflightHostname)).toBe('unknown');
  });

  test('returns null when old desktop native does not expose the preflight method', async () => {
    noteAvailabilityProxyPreflight(preflightHostname, true);
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
    expect(getAvailabilityProxyState(preflightHostname)).toBe('unknown');
    expect(getAvailabilityProxyState(otherHostname)).toBe('unknown');
  });

  test('rethrows non-capability desktop preflight errors', async () => {
    noteAvailabilityProxyPreflight(preflightHostname, false);
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
    ).rejects.toBe(error);

    expect(getErrorLogCalls()).toEqual([
      [
        expect.objectContaining({
          info: expect.stringContaining('decision=fallback'),
        }),
      ],
    ]);
    expect(getAvailabilityProxyState(preflightHostname)).toBe('unknown');
    expect(getAvailabilityProxyState(otherHostname)).toBe('unknown');
  });

  test('cancels an in-flight request with its generated request id', async () => {
    let rejectRequest: ((reason?: unknown) => void) | undefined;
    const request = jest.fn<Promise<ISniResponse>, [ISniRequestConfig]>(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );
    const cancelRequest = jest
      .fn<Promise<{ success: boolean }>, [string]>()
      .mockResolvedValue({ success: true });
    setDesktopApiProxy({ sniRequest: { request, cancelRequest } });
    const controller = new AbortController();
    let resolveTransportSettled:
      | ((value: ISniRequestTransportSettledResult) => void)
      | undefined;
    const transportSettled = new Promise<ISniRequestTransportSettledResult>(
      (resolve) => {
        resolveTransportSettled = resolve;
      },
    );

    const responsePromise = sniRequest(buildSniRequestConfig(), {
      signal: controller.signal,
      onTransportSettled: (result) => resolveTransportSettled?.(result),
    });
    controller.abort();

    await expect(responsePromise).rejects.toMatchObject({
      code: 'SNI_CANCELLED',
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'desktop-generated-request-id' }),
    );
    expect(cancelRequest).toHaveBeenCalledWith('desktop-generated-request-id');

    rejectRequest?.(
      Object.assign(new Error('Request cancelled'), {
        code: 'SNI_CANCELLED',
      }),
    );
    await expect(transportSettled).resolves.toEqual({
      requestId: 'desktop-generated-request-id',
      status: 'rejected',
      error: expect.objectContaining({ code: 'SNI_CANCELLED' }),
    });
  });

  test('reports success=false from the desktop cancellation call', async () => {
    const request = jest.fn<Promise<ISniResponse>, [ISniRequestConfig]>(
      () => new Promise(() => undefined),
    );
    const cancelRequest = jest
      .fn<Promise<{ success: boolean }>, [string]>()
      .mockResolvedValue({ success: false });
    setDesktopApiProxy({ sniRequest: { request, cancelRequest } });
    const controller = new AbortController();
    let resolveCancelSettled:
      | ((value: ISniRequestCancelSettledResult) => void)
      | undefined;
    const cancelSettled = new Promise<ISniRequestCancelSettledResult>(
      (resolve) => {
        resolveCancelSettled = resolve;
      },
    );

    const responsePromise = sniRequest(buildSniRequestConfig(), {
      signal: controller.signal,
      onCancelSettled: (result) => resolveCancelSettled?.(result),
    });
    controller.abort();

    await expect(responsePromise).rejects.toMatchObject({
      code: 'SNI_CANCELLED',
    });
    await expect(cancelSettled).resolves.toEqual({
      requestId: 'desktop-generated-request-id',
      status: 'fulfilled',
      success: false,
    });
  });

  test('isolates rejected diagnostic callbacks from request behavior', async () => {
    let rejectRequest: ((reason?: unknown) => void) | undefined;
    const request = jest.fn<Promise<ISniResponse>, [ISniRequestConfig]>(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );
    const cancelRequest = jest
      .fn<Promise<{ success: boolean }>, [string]>()
      .mockResolvedValue({ success: true });
    setDesktopApiProxy({ sniRequest: { request, cancelRequest } });
    const controller = new AbortController();

    const responsePromise = sniRequest(buildSniRequestConfig(), {
      signal: controller.signal,
      onCancelSettled: async () => {
        throw new OneKeyLocalError('cancel diagnostic failed');
      },
      onTransportSettled: async () => {
        throw new OneKeyLocalError('transport diagnostic failed');
      },
    });
    controller.abort();
    rejectRequest?.(
      Object.assign(new Error('Request cancelled'), {
        code: 'SNI_CANCELLED',
      }),
    );

    await expect(responsePromise).rejects.toMatchObject({
      code: 'SNI_CANCELLED',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
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
