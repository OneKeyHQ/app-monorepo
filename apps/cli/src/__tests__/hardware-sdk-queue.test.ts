import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createQueuedHardwareSDK } from '../commands/device/hardware-sdk';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolveFn, rejectFn) => {
    resolve = resolveFn;
    reject = rejectFn;
  });
  return { promise, resolve, reject };
}

describe('createQueuedHardwareSDK', () => {
  it('serializes SDK method calls in FIFO order', async () => {
    const firstCall = createDeferred<void>();
    const order: string[] = [];
    const sdk = createQueuedHardwareSDK({
      searchDevices: jest.fn(async () => {
        order.push('search-start');
        await firstCall.promise;
        order.push('search-end');
        return { success: true as const, payload: [] };
      }),
      getFeatures: jest.fn(async (_connectId: string) => {
        order.push('features-start');
        return { success: true as const, payload: { unlocked: true } };
      }),
    });

    const searchPromise = sdk.searchDevices();
    const featuresPromise = sdk.getFeatures('connect-1');
    await Promise.resolve();

    expect(order).toEqual(['search-start']);

    firstCall.resolve();
    await Promise.all([searchPromise, featuresPromise]);

    expect(order).toEqual(['search-start', 'search-end', 'features-start']);
  });

  it('does not queue SDK queue-bypass methods', async () => {
    const firstCall = createDeferred<void>();
    const order: string[] = [];
    const sdk = createQueuedHardwareSDK({
      searchDevices: jest.fn(async () => {
        order.push('search-start');
        await firstCall.promise;
        order.push('search-end');
        return { success: true as const, payload: [] };
      }),
      uiResponse: jest.fn((_event: { type: string }) => {
        order.push('ui-response');
      }),
    });

    const searchPromise = sdk.searchDevices();
    await Promise.resolve();

    sdk.uiResponse({ type: 'receive-pin' });

    expect(order).toEqual(['search-start', 'ui-response']);

    firstCall.resolve();
    await searchPromise;

    expect(order).toEqual(['search-start', 'ui-response', 'search-end']);
  });

  it('keeps processing queued calls after a SDK method rejects', async () => {
    const order: string[] = [];
    const sdk = createQueuedHardwareSDK({
      getFeatures: jest.fn(async () => {
        order.push('features-start');
        throw new OneKeyLocalError('device busy');
      }),
      searchDevices: jest.fn(async () => {
        order.push('search-start');
        return { success: true as const, payload: [] };
      }),
    });

    const failingCall = sdk.getFeatures();
    const nextCall = sdk.searchDevices();

    await expect(failingCall).rejects.toThrow('device busy');
    await expect(nextCall).resolves.toEqual({ success: true, payload: [] });

    expect(order).toEqual(['features-start', 'search-start']);
  });

  it('uses the same queue for SOL hardware methods', async () => {
    const btcCall = createDeferred<void>();
    const order: string[] = [];
    const sdk = createQueuedHardwareSDK({
      btcGetAddress: jest.fn(async () => {
        order.push('btc-address-start');
        await btcCall.promise;
        order.push('btc-address-end');
        return { success: true as const, payload: { address: 'bc1q-test' } };
      }),
      solGetAddress: jest.fn(async () => {
        order.push('sol-address-start');
        return { success: true as const, payload: { address: 'sol-test' } };
      }),
    });

    const btcPromise = sdk.btcGetAddress();
    const solPromise = sdk.solGetAddress();
    await Promise.resolve();

    expect(order).toEqual(['btc-address-start']);

    btcCall.resolve();
    await Promise.all([btcPromise, solPromise]);

    expect(order).toEqual([
      'btc-address-start',
      'btc-address-end',
      'sol-address-start',
    ]);
  });
});
