import { request as nativeSniRequest } from '@onekeyfe/react-native-sni-connect';
import { NativeModules } from 'react-native';

import { defaultLogger } from '../../logger/logger';

import { sniRequest } from './sniRequest.native';

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

const mockedNativeRequest = nativeSniRequest as jest.MockedFunction<
  typeof nativeSniRequest
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
