import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { unwrapElectronIpcError } from '@onekeyhq/shared/src/errors/utils/electronIpcError';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';
import type {
  IRevenueCatMethod,
  IRevenueCatPurchaseResult,
  IRevenueCatRequestMap,
} from '@onekeyhq/shared/types/prime/revenueCat';

import { RevenueCatDesktopClient } from './revenueCat';

import type { IVerifiedRevenueCatIdentity } from './revenueCatIdentity';

jest.mock('electron', () => ({ app: {} }));
jest.mock('../../libs/store', () => ({ getSecureItem: jest.fn() }));
jest.mock('../../i18n', () => ({ i18nText: (key: string) => key }));

const authContext = {
  sessionSource: EPrimeAuthSessionSource.KeylessOAuth,
  endpointEnv: 'prod' as const,
  instanceId: 'instance-a',
};
const loginParams = (expectedAppUserId = 'user-a') => ({
  expectedAppUserId,
  authContext,
});
const verifiedIdentity = (userId = 'user-a'): IVerifiedRevenueCatIdentity => ({
  userId,
  email: `${userId}@example.com`,
  isPrime: false,
  assertCurrentSession: jest.fn(),
});

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
  const verifyIdentity = jest.fn(async () => verifiedIdentity());
  const confirmIdentity = jest.fn(
    async (_identity: IVerifiedRevenueCatIdentity) => true,
  );
  const client = new RevenueCatDesktopClient({
    apiKey: 'apple-key',
    verifyIdentity,
    confirmIdentity,
    isMacAppStore: () => isMacAppStore,
    loadNativeModule,
  });
  return {
    client,
    nativeInvoke,
    nativeImplementation,
    loadNativeModule,
    verifyIdentity,
    confirmIdentity,
  };
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
    ).rejects.toThrow('Unsupported RevenueCat API key');
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

    await client.invoke('logIn', loginParams());
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
    const { client, nativeInvoke, nativeImplementation, verifyIdentity } =
      createClient();
    await client.invoke('configure', { apiKey: 'apple-key' });
    await client.invoke('logIn', loginParams());
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
    verifyIdentity.mockResolvedValue(verifiedIdentity('user-b'));
    const nextLogin = client.invoke('logIn', loginParams('user-b'));
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
    const { client, nativeInvoke, verifyIdentity } = createClient();
    await client.invoke('configure', { apiKey: 'apple-key' });
    await client.invoke('logIn', loginParams());

    verifyIdentity.mockResolvedValue(verifiedIdentity('user-b'));
    const nextLogin = client.invoke('logIn', loginParams('user-b'));
    const stalePurchase = client.invoke('purchasePackage', purchaseParams);
    await expect(stalePurchase).rejects.toThrow(
      ETranslations.prime_onekey_id_session_changed__msg,
    );
    await nextLogin;
    expect(
      nativeInvoke.mock.calls.some(([method]) => method === 'purchasePackage'),
    ).toBe(false);
  });

  it.each(['getCustomerInfo', 'restorePurchases', 'setAttributes'] as const)(
    'rejects %s for a different SDK identity',
    async (method) => {
      const { client, nativeInvoke, verifyIdentity } = createClient();
      await client.invoke('configure', { apiKey: 'apple-key' });
      verifyIdentity.mockResolvedValue(verifiedIdentity('user-b'));
      await client.invoke('logIn', loginParams('user-b'));

      await expect(
        client.invoke(method, {
          expectedAppUserId: 'user-a',
          attributes: { '$posthogUserId': 'instance-a' },
        }),
      ).rejects.toThrow(ETranslations.prime_onekey_id_session_changed__msg);
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
    await client.invoke('logIn', loginParams());
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
    await client.invoke('logIn', loginParams());
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
      params: { ...loginParams(), expectedAppUserId: 42 },
      error: 'Invalid RevenueCat expected app user ID',
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

describe('RevenueCat trusted identity boundary', () => {
  it('rechecks the persisted session after awaiting the native identity read', async () => {
    const { client, nativeInvoke, nativeImplementation, verifyIdentity } =
      createClient();
    let sessionCurrent = true;
    verifyIdentity.mockImplementation(async () => ({
      ...verifiedIdentity(),
      assertCurrentSession: () => {
        if (!sessionCurrent) throw new OneKeyLocalError('session changed');
      },
    }));
    await client.invoke('configure', { apiKey: 'apple-key' });
    await client.invoke('logIn', loginParams());
    nativeInvoke.mockImplementation((method, params) => {
      if (method === 'getAppUserId') sessionCurrent = false;
      return nativeImplementation(method, params);
    });
    await expect(
      client.invoke('purchasePackage', purchaseParams),
    ).rejects.toThrow('session changed');
    expect(
      nativeInvoke.mock.calls.some(([method]) => method === 'purchasePackage'),
    ).toBe(false);
  });

  it('rejects an arbitrary renderer account even when both requested IDs agree', async () => {
    const { client, nativeInvoke, confirmIdentity } = createClient();
    await client.invoke('configure', { apiKey: 'apple-key' });
    await expect(
      client.invoke('logIn', loginParams('attacker')),
    ).rejects.toThrow(ETranslations.prime_onekey_id_session_changed__msg);
    await expect(
      client.invoke('purchasePackage', {
        ...purchaseParams,
        expectedAppUserId: 'attacker',
      }),
    ).rejects.toThrow(ETranslations.prime_onekey_id_session_changed__msg);
    await expect(
      client.invoke('restorePurchases', { expectedAppUserId: 'attacker' }),
    ).rejects.toThrow(ETranslations.prime_onekey_id_session_changed__msg);
    expect(confirmIdentity).not.toHaveBeenCalled();
    expect(nativeInvoke.mock.calls.map(([method]) => method)).toEqual([
      'configure',
    ]);
  });

  it('ignores an injected native appUserId and logs in only as the server-verified user', async () => {
    const { client, nativeInvoke } = createClient();
    await client.invoke('configure', { apiKey: 'apple-key' });
    const params = { ...loginParams(), appUserId: 'attacker' };
    await client.invoke('logIn', params);
    expect(nativeInvoke).toHaveBeenCalledWith('logIn', { appUserId: 'user-a' });
    expect(nativeInvoke).not.toHaveBeenCalledWith(
      'logIn',
      expect.objectContaining({ appUserId: 'attacker' }),
    );
  });

  it('does not trust a native SDK identity restored from a previous app launch', async () => {
    const { client, nativeInvoke } = createClient();
    await client.invoke('configure', { apiKey: 'apple-key' });
    nativeInvoke.mockResolvedValue('user-a');
    await expect(
      client.invoke('purchasePackage', purchaseParams),
    ).rejects.toThrow(ETranslations.prime_onekey_id_session_changed__msg);
    expect(
      nativeInvoke.mock.calls.some(([method]) => method === 'purchasePackage'),
    ).toBe(false);
  });

  it('requires confirmation again after switching recipients or logging out', async () => {
    const { client, verifyIdentity, confirmIdentity } = createClient();
    await client.invoke('configure', { apiKey: 'apple-key' });
    await client.invoke('logIn', loginParams());
    await client.invoke('logIn', loginParams());
    expect(confirmIdentity).toHaveBeenCalledTimes(1);
    verifyIdentity.mockResolvedValue(verifiedIdentity('user-b'));
    await client.invoke('logIn', loginParams('user-b'));
    expect(confirmIdentity).toHaveBeenCalledTimes(2);
    await client.invoke('logOut', undefined);
    await client.invoke('logIn', loginParams('user-b'));
    expect(confirmIdentity).toHaveBeenCalledTimes(3);
  });

  it('cannot reuse a previous binding after native consent is cancelled', async () => {
    const { client, nativeInvoke, confirmIdentity, verifyIdentity } =
      createClient();
    await client.invoke('configure', { apiKey: 'apple-key' });
    await client.invoke('logIn', loginParams());
    nativeInvoke.mockClear();
    verifyIdentity.mockResolvedValue(verifiedIdentity('user-b'));
    confirmIdentity.mockResolvedValue(false);
    await expect(client.invoke('logIn', loginParams('user-b'))).rejects.toThrow(
      '"userCancelled":true',
    );
    await expect(
      client.invoke('restorePurchases', { expectedAppUserId: 'user-a' }),
    ).rejects.toThrow(ETranslations.prime_onekey_id_session_changed__msg);
    expect(nativeInvoke).not.toHaveBeenCalled();
  });

  it('does not log in if the persisted session changes while consent is open', async () => {
    const { client, nativeInvoke, verifyIdentity, confirmIdentity } =
      createClient();
    const assertCurrentSession = jest.fn();
    verifyIdentity.mockResolvedValue({
      ...verifiedIdentity(),
      assertCurrentSession,
    });
    confirmIdentity.mockImplementation(async () => {
      assertCurrentSession.mockImplementation(() => {
        throw new OneKeyLocalError('session replaced');
      });
      return true;
    });
    await client.invoke('configure', { apiKey: 'apple-key' });
    await expect(client.invoke('logIn', loginParams())).rejects.toThrow(
      'session replaced',
    );
    expect(nativeInvoke.mock.calls.map(([method]) => method)).toEqual([
      'configure',
    ]);
  });

  it.each(['purchasePackage', 'restorePurchases'] as const)(
    'rechecks server identity before %s and rejects a changed recipient',
    async (method) => {
      const { client, nativeInvoke, verifyIdentity } = createClient();
      await client.invoke('configure', { apiKey: 'apple-key' });
      await client.invoke('logIn', loginParams());
      verifyIdentity.mockResolvedValue(verifiedIdentity('user-b'));
      await expect(client.invoke(method, purchaseParams)).rejects.toThrow(
        ETranslations.prime_onekey_id_session_changed__msg,
      );
      expect(
        nativeInvoke.mock.calls.some(
          ([calledMethod]) => calledMethod === method,
        ),
      ).toBe(false);
    },
  );

  it.each(['purchasePackage', 'restorePurchases'] as const)(
    'fails closed if server verification fails before %s',
    async (method) => {
      const { client, nativeInvoke, verifyIdentity } = createClient();
      await client.invoke('configure', { apiKey: 'apple-key' });
      await client.invoke('logIn', loginParams());
      verifyIdentity.mockRejectedValue(new Error('server unavailable'));
      await expect(client.invoke(method, purchaseParams)).rejects.toThrow(
        'server unavailable',
      );
      expect(
        nativeInvoke.mock.calls.some(
          ([calledMethod]) => calledMethod === method,
        ),
      ).toBe(false);
    },
  );

  it('blocks duplicate purchase for an active Prime user but still allows restore', async () => {
    const { client, nativeInvoke, verifyIdentity } = createClient();
    await client.invoke('configure', { apiKey: 'apple-key' });
    await client.invoke('logIn', loginParams());
    verifyIdentity.mockResolvedValue({ ...verifiedIdentity(), isPrime: true });
    await expect(
      client.invoke('purchasePackage', purchaseParams),
    ).rejects.toThrow(ETranslations.prime_already_active__msg);
    await client.invoke('restorePurchases', { expectedAppUserId: 'user-a' });
    expect(
      nativeInvoke.mock.calls.some(([method]) => method === 'purchasePackage'),
    ).toBe(false);
    expect(nativeInvoke).toHaveBeenCalledWith('restorePurchases', {});
  });

  it('rejects a renderer-selected RevenueCat project before initial configuration', async () => {
    const { client, nativeInvoke } = createClient();
    await expect(
      client.invoke('configure', { apiKey: 'attacker-project' }),
    ).rejects.toThrow('Unsupported RevenueCat API key');
    expect(nativeInvoke).not.toHaveBeenCalled();
  });
});
