import {
  cancelRequest as nativeCancelRequest,
  request as nativeSniRequest,
} from '@onekeyfe/react-native-sni-connect';

import { sniRequest } from './sniRequest.native';

import type { ISniRequestConfig } from '../types/ipTable';

jest.mock('@onekeyfe/react-native-sni-connect', () => ({
  cancelRequest: jest.fn(),
  isProxyActiveForUrl: jest.fn(),
  request: jest.fn(),
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
  generateUUID: jest.fn(() => 'native-generated-request-id'),
}));

const mockedNativeRequest = nativeSniRequest as jest.MockedFunction<
  typeof nativeSniRequest
>;
const mockedNativeCancelRequest = nativeCancelRequest as jest.MockedFunction<
  typeof nativeCancelRequest
>;

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
    let resolveRequest:
      | ((response: Awaited<ReturnType<typeof nativeSniRequest>>) => void)
      | undefined;
    mockedNativeRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const controller = new AbortController();

    const responsePromise = sniRequest(buildSniRequestConfig(), {
      signal: controller.signal,
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

    resolveRequest?.({
      data: '',
      status: 204,
      statusText: 'No Content',
      headers: {},
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
});
