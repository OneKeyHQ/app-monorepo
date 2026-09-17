import { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';

import { PRIME_TRANSFER_CHUNK_TIMEOUT } from '@onekeyhq/shared/types/prime/primeTransferNetworkTypes';

import { buildCallRemoteApiMethod } from '../../../apis/RemoteApiProxyBase';

import { supportsPrimeTransferChunks } from './chunkedTransfer';

import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: Error,
}));

jest.mock('@onekeyhq/shared/src/platformEnvLite', () => ({}));

class TestBridge extends JsBridgeBase {
  peer?: TestBridge;

  override sendPayload(payload: IJsBridgeMessagePayload | string) {
    this.peer?.receive(payload, { origin: 'test-peer', internal: true });
  }
}

describe('Prime Transfer chunk capability negotiation', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('skips peer capability queries when the relay lacks chunk support', async () => {
    const getTransferType = jest.fn();
    await expect(
      supportsPrimeTransferChunks({
        serverSupportsChunkedTransfer: false,
        getTransferType,
        signal: new AbortController().signal,
      }),
    ).resolves.toBe(false);
    expect(getTransferType).not.toHaveBeenCalled();
  });

  test.each([
    { response: {}, expected: false },
    { response: { chunkedTransferVersion: 0 }, expected: false },
    { response: { chunkedTransferVersion: 1 }, expected: true },
    { response: { chunkedTransferVersion: 2 }, expected: false },
  ])('negotiates $response as $expected', async ({ response, expected }) => {
    await expect(
      supportsPrimeTransferChunks({
        serverSupportsChunkedTransfer: true,
        getTransferType: async () => response,
        signal: new AbortController().signal,
      }),
    ).resolves.toBe(expected);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('a peer without getTransferType still receives the legacy single message', async () => {
    // The v5.18 API has sendTransferData but no getTransferType method. Use
    // the real dispatcher and bridge to exercise its serialized error.
    const legacyApi = { sendTransferData: jest.fn(async () => undefined) };
    const dispatch = buildCallRemoteApiMethod(
      async () => legacyApi,
      'e2eeClientToClientApi',
    );
    const sender = new TestBridge();
    const receiver = new TestBridge({
      receiveHandler: async (payload) => {
        const result: unknown = await dispatch(payload.data as IJsonRpcRequest);
        return result;
      },
    });
    sender.peer = receiver;
    receiver.peer = sender;

    const supportsChunks = await supportsPrimeTransferChunks({
      serverSupportsChunkedTransfer: true,
      getTransferType: async () => {
        await sender.request({
          data: { module: 'api', method: 'getTransferType', params: [] },
        });
        return {};
      },
      signal: new AbortController().signal,
    });
    expect(supportsChunks).toBe(false);
    await sender.request({
      data: {
        module: 'api',
        method: 'sendTransferData',
        params: [{ rawData: 'test-ciphertext' }],
      },
    });
    expect(legacyApi.sendTransferData).toHaveBeenCalledTimes(1);
    expect(legacyApi.sendTransferData).toHaveBeenCalledWith({
      rawData: 'test-ciphertext',
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('accepts the exact missing-method error after losing its prototype', async () => {
    await expect(
      supportsPrimeTransferChunks({
        serverSupportsChunkedTransfer: true,
        getTransferType: () =>
          // This is the plain error shape emitted by the legacy bridge.
          // eslint-disable-next-line prefer-promise-reject-errors -- Preserve the serialized error's missing prototype in this fixture.
          Promise.reject({
            name: 'Error',
            message:
              'callRemoteApiMethod not found: e2eeClientToClientApi.api.getTransferType() ',
          }),
        signal: new AbortController().signal,
      }),
    ).resolves.toBe(false);
  });

  test.each([
    new Error('WebSocket disconnected'),
    new Error('Transfer cancelled'),
    new Error('Transfer timed out'),
    new Error(
      'callRemoteApiMethod not found: e2eeClientToClientApi.api.sendTransferData() ',
    ),
    new Error(
      'callRemoteApiMethod not found: e2eeClientToClientApi.other.getTransferType() ',
    ),
    new Error('getTransferType method failed'),
    { code: 1100, message: 'Too many requests' },
    { code: -32_601, message: 'Method not found' },
  ])('propagates real failures unchanged: %p', async (error) => {
    await expect(
      supportsPrimeTransferChunks({
        serverSupportsChunkedTransfer: true,
        getTransferType: () => Promise.reject(error),
        signal: new AbortController().signal,
      }),
    ).rejects.toBe(error);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('cancellation takes priority over a late missing-method response', async () => {
    const controller = new AbortController();
    const result = supportsPrimeTransferChunks({
      serverSupportsChunkedTransfer: true,
      getTransferType: () => {
        controller.abort();
        return Promise.reject(
          new Error(
            'callRemoteApiMethod not found: e2eeClientToClientApi.api.getTransferType() ',
          ),
        );
      },
      signal: controller.signal,
    });
    await expect(result).rejects.toThrow('Transfer cancelled');
    expect(jest.getTimerCount()).toBe(0);
  });

  test('a silent peer times out instead of selecting legacy transport', async () => {
    const result = supportsPrimeTransferChunks({
      serverSupportsChunkedTransfer: true,
      getTransferType: () => new Promise(() => undefined),
      signal: new AbortController().signal,
    });
    await Promise.all([
      expect(result).rejects.toThrow('Transfer timed out'),
      jest.advanceTimersByTimeAsync(PRIME_TRANSFER_CHUNK_TIMEOUT),
    ]);
    expect(jest.getTimerCount()).toBe(0);
  });
});
