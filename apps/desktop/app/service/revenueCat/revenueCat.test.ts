import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { unwrapElectronIpcError } from '@onekeyhq/shared/src/errors/utils/electronIpcError';
import type {
  IRevenueCatMethod,
  IRevenueCatPurchaseResult,
  IRevenueCatRequestMap,
} from '@onekeyhq/shared/types/prime/revenueCat';

import { RevenueCatDesktopClient } from './revenueCat';

jest.mock('electron', () => ({ app: {} }));

const purchaseParams = {
  packageIdentifier: '$rc_annual',
  offeringIdentifier: 'default',
  expectedAppUserId: 'user-a',
};

const purchaseResult: IRevenueCatPurchaseResult = {
  customerInfo: {
    managementURL: null,
    entitlements: { active: {} },
  },
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createClient(isMacAppStore = true) {
  let appUserId = '$RCAnonymousID:initial';
  const nativeImplementation = async (
    method: IRevenueCatMethod,
    params: Record<string, unknown>,
  ): Promise<unknown> => {
    switch (method) {
      case 'getAppUserId':
        return appUserId;
      case 'logIn':
        appUserId = String(params.appUserId);
        return undefined;
      case 'logOut':
        appUserId = '$RCAnonymousID:after-logout';
        return undefined;
      case 'getOfferings':
        return { current: null };
      case 'purchasePackage':
        return purchaseResult;
      default:
        return undefined;
    }
  };
  const nativeInvoke = jest.fn<
    Promise<unknown>,
    [IRevenueCatMethod, Record<string, unknown>]
  >(nativeImplementation);
  const loadNativeModule = jest.fn(() => ({ invoke: nativeInvoke }));
  const client = new RevenueCatDesktopClient({
    isMacAppStore: () => isMacAppStore,
    loadNativeModule,
  });
  return { client, nativeInvoke, nativeImplementation, loadNativeModule };
}

describe('RevenueCatDesktopClient', () => {
  it('never loads the native module outside the Mac App Store app', async () => {
    const { client, loadNativeModule } = createClient(false);

    expect(client.isAvailable()).toBe(false);
    await expect(
      client.invoke('configure', { apiKey: 'apple-key' }),
    ).rejects.toThrow('only available in the Mac App Store app');
    expect(loadNativeModule).not.toHaveBeenCalled();
  });

  it('reports an unavailable binary without throwing from the capability probe', () => {
    const { client, loadNativeModule } = createClient();
    loadNativeModule.mockImplementationOnce(() => {
      throw new OneKeyLocalError('Native binary missing');
    });

    expect(client.isAvailable()).toBe(false);
    expect(client.isAvailable()).toBe(true);
  });

  it('configures the singleton once across concurrent callers', async () => {
    const { client, nativeInvoke, loadNativeModule } = createClient();
    const configured = createDeferred<void>();
    const started = createDeferred<void>();
    nativeInvoke.mockImplementationOnce(() => {
      started.resolve();
      return configured.promise;
    });

    const first = client.invoke('configure', { apiKey: 'apple-key' });
    const second = client.invoke('configure', { apiKey: 'apple-key' });
    await started.promise;
    expect(nativeInvoke).toHaveBeenCalledTimes(1);

    configured.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual([
      undefined,
      undefined,
    ]);
    expect(nativeInvoke).toHaveBeenCalledTimes(1);
    expect(loadNativeModule).toHaveBeenCalledTimes(1);

    await expect(
      client.invoke('configure', { apiKey: 'different-key' }),
    ).rejects.toThrow('already configured with a different API key');
    expect(nativeInvoke).toHaveBeenCalledTimes(1);
  });

  it('retries configuration after failure instead of retaining a rejected initialization', async () => {
    const { client, nativeInvoke } = createClient();
    nativeInvoke.mockRejectedValueOnce(new Error('SDK initialization failed'));

    await expect(
      client.invoke('configure', { apiKey: 'apple-key' }),
    ).rejects.toThrow('SDK initialization failed');
    await expect(
      client.invoke('configure', { apiKey: 'apple-key' }),
    ).resolves.toBeUndefined();
    await expect(client.invoke('getAppUserId', undefined)).resolves.toBe(
      '$RCAnonymousID:initial',
    );
    expect(
      nativeInvoke.mock.calls.filter(([method]) => method === 'configure'),
    ).toHaveLength(2);
  });

  it('treats logout before configuration or while anonymous as an idempotent success', async () => {
    const { client, nativeInvoke } = createClient();

    await expect(client.invoke('logOut', undefined)).resolves.toBeUndefined();
    expect(nativeInvoke).not.toHaveBeenCalled();
    await client.invoke('configure', { apiKey: 'apple-key' });
    await client.invoke('logOut', undefined);
    expect(nativeInvoke).not.toHaveBeenCalledWith('logOut', {});

    await client.invoke('logIn', { appUserId: 'user-a' });
    await Promise.all([
      client.invoke('logOut', undefined),
      client.invoke('logOut', undefined),
    ]);
    expect(
      nativeInvoke.mock.calls.filter(([method]) => method === 'logOut'),
    ).toHaveLength(1);
    await expect(client.invoke('getAppUserId', undefined)).resolves.toBe(
      '$RCAnonymousID:after-logout',
    );
  });

  it('rejects SDK operations before configuration', async () => {
    const { client, nativeInvoke } = createClient();

    await expect(client.invoke('getOfferings', undefined)).rejects.toThrow(
      'RevenueCat is not configured',
    );
    expect(nativeInvoke).not.toHaveBeenCalled();
  });

  it('holds the SDK identity for the entire purchase before allowing another login', async () => {
    const { client, nativeInvoke, nativeImplementation } = createClient();
    await client.invoke('configure', { apiKey: 'apple-key' });
    await client.invoke('logIn', { appUserId: 'user-a' });
    const completed = createDeferred<IRevenueCatPurchaseResult>();
    const started = createDeferred<void>();
    nativeInvoke.mockImplementation((method, params) => {
      if (method === 'purchasePackage') {
        started.resolve();
        return completed.promise;
      }
      return nativeImplementation(method, params);
    });

    const purchase = client.invoke('purchasePackage', purchaseParams);
    await started.promise;
    const nextLogin = client.invoke('logIn', { appUserId: 'user-b' });
    expect(nativeInvoke).not.toHaveBeenCalledWith('logIn', {
      appUserId: 'user-b',
    });
    expect(nativeInvoke).toHaveBeenCalledWith('purchasePackage', {
      packageIdentifier: '$rc_annual',
      offeringIdentifier: 'default',
    });

    completed.resolve(purchaseResult);
    await expect(purchase).resolves.toBe(purchaseResult);
    await nextLogin;
    await expect(client.invoke('getAppUserId', undefined)).resolves.toBe(
      'user-b',
    );
  });

  it('rejects a queued stale purchase after another user logs in', async () => {
    const { client, nativeInvoke } = createClient();
    await client.invoke('configure', { apiKey: 'apple-key' });
    await client.invoke('logIn', { appUserId: 'user-a' });

    const nextLogin = client.invoke('logIn', { appUserId: 'user-b' });
    const stalePurchase = client.invoke('purchasePackage', purchaseParams);
    await expect(stalePurchase).rejects.toThrow(
      'app user ID changed before the request',
    );
    await nextLogin;
    expect(
      nativeInvoke.mock.calls.some(([method]) => method === 'purchasePackage'),
    ).toBe(false);
  });

  it.each(['getCustomerInfo', 'restorePurchases', 'setAttributes'] as const)(
    'rejects %s for a different SDK identity',
    async (method) => {
      const { client, nativeInvoke } = createClient();
      await client.invoke('configure', { apiKey: 'apple-key' });
      await client.invoke('logIn', { appUserId: 'user-b' });

      await expect(
        client.invoke(method, {
          expectedAppUserId: 'user-a',
          attributes: { '$posthogUserId': 'instance-a' },
        }),
      ).rejects.toThrow('app user ID changed before the request');
      expect(
        nativeInvoke.mock.calls.some(
          ([calledMethod]) => calledMethod === method,
        ),
      ).toBe(false);
    },
  );

  it('rejects overlapping purchase and restore requests and releases the gate after failure', async () => {
    const { client, nativeInvoke, nativeImplementation } = createClient();
    await client.invoke('configure', { apiKey: 'apple-key' });
    await client.invoke('logIn', { appUserId: 'user-a' });
    const completed = createDeferred<IRevenueCatPurchaseResult>();
    const started = createDeferred<void>();
    nativeInvoke.mockImplementation((method, params) => {
      if (method === 'purchasePackage') {
        started.resolve();
        return completed.promise;
      }
      return nativeImplementation(method, params);
    });

    const purchase = client.invoke('purchasePackage', purchaseParams);
    const purchaseRejection = purchase.catch((error: unknown) => error);
    await started.promise;
    await expect(
      client.invoke('purchasePackage', purchaseParams),
    ).rejects.toThrow('already in progress');
    await expect(
      client.invoke('restorePurchases', { expectedAppUserId: 'user-a' }),
    ).rejects.toThrow('already in progress');

    completed.reject(new Error('Store unavailable'));
    await expect(purchaseRejection).resolves.toMatchObject({
      message: expect.stringContaining('Store unavailable'),
    });
    nativeInvoke.mockImplementation(nativeImplementation);
    await expect(client.invoke('getOfferings', undefined)).resolves.toEqual({
      current: null,
    });
    await expect(
      client.invoke('purchasePackage', purchaseParams),
    ).resolves.toBe(purchaseResult);
  });

  it.each([
    { code: '1', userCancelled: false },
    { code: 1, userCancelled: false },
    { code: 99, userCancelled: true },
  ])('preserves cancellation across Electron IPC for %j', async (details) => {
    const { client, nativeInvoke } = createClient();
    await client.invoke('configure', { apiKey: 'apple-key' });
    await client.invoke('logIn', { appUserId: 'user-a' });
    nativeInvoke.mockResolvedValueOnce('user-a');
    nativeInvoke.mockRejectedValueOnce(
      Object.assign(new Error('Store purchase cancelled'), details),
    );

    const error = await client
      .invoke('purchasePackage', purchaseParams)
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) {
      throw new OneKeyLocalError(
        'Expected an Error at the main-process boundary',
      );
    }
    const ipcError = new Error(
      `Error invoking remote method 'DESKTOP_API_CALL': ${error.toString()}`,
    );
    expect(unwrapElectronIpcError(ipcError)).toMatchObject({
      message: 'Store purchase cancelled',
      code: Number(details.code),
      data: { revenueCat: true, userCancelled: true },
    });
  });

  it.each<{
    name: string;
    method: IRevenueCatMethod;
    params: unknown;
    error: string;
  }>([
    {
      name: 'empty API key',
      method: 'configure',
      params: { apiKey: ' ' },
      error: 'Invalid RevenueCat API key',
    },
    {
      name: 'non-string user ID',
      method: 'logIn',
      params: { appUserId: 42 },
      error: 'Invalid RevenueCat app user ID',
    },
    {
      name: 'missing offering identifier',
      method: 'purchasePackage',
      params: { ...purchaseParams, offeringIdentifier: null },
      error: 'Invalid RevenueCat offering identifier',
    },
    {
      name: 'missing expected user ID',
      method: 'restorePurchases',
      params: {},
      error: 'Invalid RevenueCat expected app user ID',
    },
    {
      name: 'unsupported subscriber attribute',
      method: 'setAttributes',
      params: {
        expectedAppUserId: 'user-a',
        attributes: { '$email': 'user@example.com' },
      },
      error: 'Unsupported RevenueCat subscriber attribute',
    },
    {
      name: 'array subscriber attributes',
      method: 'setAttributes',
      params: { expectedAppUserId: 'user-a', attributes: [] },
      error: 'Invalid RevenueCat attributes',
    },
    {
      name: 'oversized product identifier list',
      method: 'checkTrialOrIntroductoryPriceEligibility',
      params: {
        productIdentifiers: Array.from({ length: 101 }, () => 'prime'),
      },
      error: 'Invalid RevenueCat product identifiers',
    },
    {
      name: 'empty product identifier',
      method: 'checkTrialOrIntroductoryPriceEligibility',
      params: { productIdentifiers: [''] },
      error: 'Invalid RevenueCat product identifier',
    },
  ])(
    'rejects $name before calling the native module',
    async ({ method, params, error }) => {
      const { client, nativeInvoke } = createClient();
      await client.invoke('configure', { apiKey: 'apple-key' });
      nativeInvoke.mockClear();

      await expect(
        client.invoke(
          method,
          params as IRevenueCatRequestMap[IRevenueCatMethod],
        ),
      ).rejects.toThrow(error);
      expect(nativeInvoke).not.toHaveBeenCalled();
    },
  );
});
