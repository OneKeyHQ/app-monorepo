import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  createQueuedHardwareSDK,
  extractPassphraseSessionFromPayload,
  extractPassphraseStateFromPayload,
  openHiddenWalletSession,
} from '../commands/device/hardware-sdk';
import { ERROR_CODES } from '../errors';

import type { CoreApi } from '@onekeyfe/hd-core';

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

describe('extractPassphraseStateFromPayload', () => {
  it('reads passphraseState from the SDK string payload', () => {
    const payload = 'state-1';
    expect(extractPassphraseStateFromPayload(payload)).toBe('state-1');
    expect(extractPassphraseSessionFromPayload(payload)).toEqual({
      passphraseState: 'state-1',
    });
  });

  it('reads passphraseState from the unified wallet-session payload', () => {
    const payload = {
      deviceId: 'device-1',
      walletType: 'hidden',
      passphraseState: 'state-2',
      sessionId: 'session-2',
      resumed: false,
    };
    expect(extractPassphraseStateFromPayload(payload)).toBe('state-2');
    expect(extractPassphraseSessionFromPayload(payload)).toEqual({
      passphraseState: 'state-2',
      sessionId: 'session-2',
    });
  });

  it('returns the hardware session pair for the standard wallet payload', () => {
    expect(
      extractPassphraseSessionFromPayload({
        passphraseState: 'standard-state',
        sessionId: 'standard-session',
      }),
    ).toEqual({
      passphraseState: 'standard-state',
      sessionId: 'standard-session',
    });
  });
});

describe('openHiddenWalletSession', () => {
  it('uses the unified V1/V2 API and returns its CLI compatibility session', async () => {
    const searchDevices = jest.fn();
    const openWalletSession = jest.fn().mockResolvedValue({
      success: true,
      payload: {
        protocol: 'V2',
        walletType: 'hidden',
        deviceId: 'device-1',
        passphraseState: 'state-1',
        sessionId: 'session-1',
        resumed: false,
      },
    });

    await expect(
      openHiddenWalletSession({
        sdk: {
          openWalletSession,
          searchDevices,
        } as unknown as CoreApi,
        connectId: 'connect-1',
      }),
    ).resolves.toEqual({
      passphraseState: 'state-1',
      sessionId: 'session-1',
    });
    expect(openWalletSession).toHaveBeenCalledWith('connect-1', {
      mode: 'hidden',
      access: 'passphrase',
    });
    expect(searchDevices).not.toHaveBeenCalled();
  });

  it('rejects an SDK response without sessionId instead of deriving it from Features', async () => {
    const sdk = {
      openWalletSession: jest.fn().mockResolvedValue({
        success: true,
        payload: {
          protocol: 'V1',
          walletType: 'hidden',
          deviceId: 'device-1',
          passphraseState: 'state-1',
          resumed: false,
        },
      }),
      searchDevices: jest.fn(),
    };

    await expect(
      openHiddenWalletSession({
        sdk: sdk as unknown as CoreApi,
        connectId: 'connect-1',
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.AUTH_SESSION_INVALID.code,
    });
    expect(sdk.searchDevices).not.toHaveBeenCalled();
  });
});
