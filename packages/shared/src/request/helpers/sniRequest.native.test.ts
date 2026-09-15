import {
  isProxyActiveForUrl as nativeIsProxyActiveForUrl,
  request as nativeSniRequest,
} from '@onekeyfe/react-native-sni-connect';
import { NativeModules } from 'react-native';

import { OneKeyLocalError } from '../../errors';
import { defaultLogger } from '../../logger/logger';
import {
  getAvailabilityProxyState,
  noteAvailabilityProxyPreflight,
  resetAvailabilityContextForTest,
} from '../availabilityContext';

import { isProxyActiveForUrl, sniRequest } from './sniRequest.native';

import type {
  ISniRequestCancelSettledResult,
  ISniRequestConfig,
  ISniRequestTransportSettledResult,
} from '../types/ipTable';

jest.mock('@onekeyfe/react-native-sni-connect', () => ({
  isProxyActiveForUrl: jest.fn(),
  request: jest.fn(),
}));

jest.mock('react-native', () => {
  const sniConnect = {
    cancelRequest: jest.fn(),
  };
  return {
    NativeModules: { SniConnect: sniConnect },
    TurboModuleRegistry: { get: jest.fn(() => sniConnect) },
  };
});

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
  generateUUID: jest.fn(() => 'native-generated-request-id'),
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

const mockedNativeRequest = nativeSniRequest as jest.MockedFunction<
  typeof nativeSniRequest
>;
const mockedNativePreflight = nativeIsProxyActiveForUrl as jest.MockedFunction<
  typeof nativeIsProxyActiveForUrl
>;
// The module registry object, so deleting the export reaches the helper.
const mockedSniConnectPackage = jest.requireMock<{
  isProxyActiveForUrl?: typeof mockedNativePreflight;
}>('@onekeyfe/react-native-sni-connect');
const mockedNoteProxyPreflight =
  noteAvailabilityProxyPreflight as jest.MockedFunction<
    typeof noteAvailabilityProxyPreflight
  >;
type NativeCancelRequest = (requestId: string) => Promise<{ success: boolean }>;
const mockedSniConnectModule = NativeModules.SniConnect as {
  cancelRequest?: jest.MockedFunction<NativeCancelRequest>;
};
const mockedNativeCancelRequest =
  mockedSniConnectModule.cancelRequest as jest.MockedFunction<NativeCancelRequest>;
const mockedRequestLogger = defaultLogger.ipTable.request as unknown as {
  warn: jest.Mock;
};

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

describe('sniRequest.native AbortController compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedNativeCancelRequest.mockResolvedValue({ success: true });
  });

  test('cancels an in-flight native request with its generated request id', async () => {
    let rejectRequest: ((reason?: unknown) => void) | undefined;
    mockedNativeRequest.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );
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
    expect(mockedNativeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'native-generated-request-id' }),
    );
    expect(mockedNativeCancelRequest).toHaveBeenCalledWith(
      'native-generated-request-id',
    );

    rejectRequest?.(
      Object.assign(new Error('Request cancelled'), {
        code: 'SNI_CANCELLED',
      }),
    );
    await expect(transportSettled).resolves.toEqual({
      requestId: 'native-generated-request-id',
      status: 'rejected',
      error: expect.objectContaining({ code: 'SNI_CANCELLED' }),
    });
  });

  test('reports a rejected native cancellation call', async () => {
    mockedNativeRequest.mockImplementation(() => new Promise(() => undefined));
    mockedNativeCancelRequest.mockRejectedValue(
      new Error('bridge unavailable'),
    );
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
      requestId: 'native-generated-request-id',
      status: 'rejected',
      error: expect.objectContaining({ message: 'bridge unavailable' }),
    });
  });

  test('does not start a native request for an already aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      sniRequest(buildSniRequestConfig(), { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'SNI_CANCELLED' });
    expect(mockedNativeRequest).not.toHaveBeenCalled();
    expect(mockedNativeCancelRequest).not.toHaveBeenCalled();
  });

  test('removes the abort listener after a native request completes', async () => {
    mockedNativeRequest.mockResolvedValue({
      data: '',
      status: 204,
      statusText: 'No Content',
      headers: {},
    });
    const controller = new AbortController();

    await expect(
      sniRequest(buildSniRequestConfig(), { signal: controller.signal }),
    ).resolves.toMatchObject({ statusCode: 204 });
    controller.abort();

    expect(mockedNativeCancelRequest).not.toHaveBeenCalled();
  });

  test('reports when an older native binary cannot cancel the transport', async () => {
    mockedNativeRequest.mockImplementation(() => new Promise(() => undefined));
    delete mockedSniConnectModule.cancelRequest;
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
      requestId: 'native-generated-request-id',
      status: 'rejected',
      error: expect.objectContaining({
        message: 'Native SNI cancellation is unavailable',
      }),
    });
    const warning = mockedRequestLogger.warn.mock.calls
      .map(([entry]) => String(entry.info))
      .join('\n');
    expect(warning).toContain('event=sni_adapter_capability');
    expect(warning).toContain('capability=cancel_request');
    expect(warning).toContain('available=false');
    expect(warning).toContain('decision=transport_may_continue');
  });
});

describe('sniRequest.native proxy preflight availability context', () => {
  const targetUrl = 'https://example.com/health';
  const targetHostname = 'example.com';
  const otherHostname = 'other.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedNativePreflight.mockReset();
    mockedSniConnectPackage.isProxyActiveForUrl = mockedNativePreflight;
    resetAvailabilityContextForTest();
  });

  afterEach(() => {
    mockedSniConnectPackage.isProxyActiveForUrl = mockedNativePreflight;
    resetAvailabilityContextForTest();
  });

  test('notes an active proxy for the URL hostname only and returns true unchanged', async () => {
    mockedNativePreflight.mockResolvedValue(true);

    await expect(isProxyActiveForUrl(targetUrl)).resolves.toBe(true);

    expect(mockedNativePreflight).toHaveBeenCalledWith(targetUrl);
    expect(mockedNoteProxyPreflight).toHaveBeenCalledWith(targetHostname, true);
    expect(getAvailabilityProxyState(targetHostname)).toBe('on');
    expect(getAvailabilityProxyState(otherHostname)).toBe('unknown');
  });

  test('notes a direct route for the URL hostname only and returns false unchanged', async () => {
    mockedNativePreflight.mockResolvedValue(false);

    await expect(isProxyActiveForUrl(targetUrl)).resolves.toBe(false);

    expect(getAvailabilityProxyState(targetHostname)).toBe('off');
    expect(getAvailabilityProxyState(otherHostname)).toBe('unknown');
  });

  test('does not overwrite the state noted for another hostname', async () => {
    noteAvailabilityProxyPreflight(otherHostname, true);
    mockedNativePreflight.mockResolvedValue(false);

    await expect(isProxyActiveForUrl(targetUrl)).resolves.toBe(false);

    expect(getAvailabilityProxyState(targetHostname)).toBe('off');
    expect(getAvailabilityProxyState(otherHostname)).toBe('on');
  });

  test('notes unknown when an older binary lacks the preflight', async () => {
    noteAvailabilityProxyPreflight(targetHostname, true);
    delete mockedSniConnectPackage.isProxyActiveForUrl;

    await expect(isProxyActiveForUrl(targetUrl)).resolves.toBeNull();

    expect(getAvailabilityProxyState(targetHostname)).toBe('unknown');
    expect(getAvailabilityProxyState(otherHostname)).toBe('unknown');
    const warning = mockedRequestLogger.warn.mock.calls
      .map(([entry]) => String(entry.info))
      .join('\n');
    expect(warning).toContain('decision=legacy_sni');
  });

  test('notes unknown and rethrows the same preflight error', async () => {
    noteAvailabilityProxyPreflight(targetHostname, false);
    const error = new Error('proxy lookup failed');
    mockedNativePreflight.mockRejectedValue(error);

    await expect(isProxyActiveForUrl(targetUrl)).rejects.toBe(error);

    expect(getAvailabilityProxyState(targetHostname)).toBe('unknown');
    expect(getAvailabilityProxyState(otherHostname)).toBe('unknown');
  });

  test('does not label any hostname when the URL cannot be parsed', async () => {
    mockedNativePreflight.mockResolvedValue(true);

    await expect(isProxyActiveForUrl('not a url')).resolves.toBe(true);

    expect(mockedNoteProxyPreflight).toHaveBeenCalledWith(undefined, true);
    expect(getAvailabilityProxyState(targetHostname)).toBe('unknown');
    expect(getAvailabilityProxyState(undefined)).toBe('unknown');
  });

  test('keeps the preflight result when noting the context throws', async () => {
    mockedNativePreflight.mockResolvedValue(true);
    mockedNoteProxyPreflight.mockImplementationOnce(() => {
      throw new OneKeyLocalError('context unavailable');
    });

    await expect(isProxyActiveForUrl(targetUrl)).resolves.toBe(true);

    expect(mockedNoteProxyPreflight).toHaveBeenCalledWith(targetHostname, true);
    expect(getAvailabilityProxyState(targetHostname)).toBe('unknown');
  });
});
