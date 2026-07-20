/* eslint-disable import/first, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-var-requires */

const mockPrimePersistAtom = {
  get: jest.fn(async () => ({})),
  set: jest.fn(async () => undefined),
};
const mockPrimeServerMasterPasswordStatusAtom = {
  get: jest.fn(async () => ({})),
  set: jest.fn(async () => undefined),
};
const mockPrimeLoginDialogAtom = {
  get: jest.fn(async () => ({})),
  set: jest.fn(async () => undefined),
};

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/core/src/secret', () => ({
  ensureSensitiveTextEncoded: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  function createLoggerProxy(): any {
    return new Proxy(jest.fn(), {
      get: () => createLoggerProxy(),
    });
  }
  return {
    defaultLogger: createLoggerProxy(),
  };
});

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: {
      formatMessage: jest.fn(() => ''),
    },
    onLocaleChange: jest.fn(),
  },
}));

jest.mock('../../states/jotai/atoms/prime', () => ({
  primePersistAtom: mockPrimePersistAtom,
  primePersistAtomInitialValue: { isLoggedIn: false },
  primeServerMasterPasswordStatusAtom: mockPrimeServerMasterPasswordStatusAtom,
  primeLoginDialogAtom: mockPrimeLoginDialogAtom,
}));

jest.mock('../../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: {
    get: jest.fn(async () => ({ enabled: false, settings: {} })),
    set: jest.fn(),
  },
}));

jest.mock('../../endpoints', () => ({
  getEndpointInfo: jest.fn(async () => ({
    endpoint: 'https://test.onekey.so',
  })),
}));

// Captures the interceptor callbacks that ServiceBase.getOneKeyIdClient
// registers, so tests can invoke the response error interceptor directly.
const mockCapturedInterceptors: {
  responseOnRejected?: (error: unknown) => Promise<unknown>;
} = {};

jest.mock('@onekeyhq/shared/src/appApiClient/appApiClient', () => ({
  appApiClient: {
    getClient: jest.fn(async () => ({
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(),
        },
      },
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
    })),
    // ServiceBase.getOneKeyIdClient registers the auth/prime interceptors on
    // this dedicated client (not on the shared plain client above).
    getOneKeyIdAuthClient: jest.fn(async () => ({
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(
            (
              _onFulfilled: unknown,
              onRejected: (error: unknown) => Promise<unknown>,
            ) => {
              mockCapturedInterceptors.responseOnRejected = onRejected;
            },
          ),
        },
      },
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
    })),
    getRawDataClient: jest.fn(),
  },
}));

// Captures the session-slot mutation helpers so tests can assert the
// generation-gated deletion behavior without a real Supabase client.
const mockRemoveAuthSessionStorageBySessionSource = jest.fn(
  async (_source: unknown) => undefined,
);
const mockReadPersistedAccessTokenBySessionSource = jest.fn(
  async (_source: unknown) => 'persisted-access-token',
);
const mockReadPersistedAccessTokenBySessionSourceStrict = jest.fn(
  async (_source: unknown): Promise<unknown> => ({
    status: 'ok',
    accessToken: 'persisted-access-token',
  }),
);
const mockRevokeAuthSessionTokenOnServerBestEffort = jest.fn(
  async (_params: unknown) => undefined,
);

// Real retryable-error semantics, driven by a `$$retryable` marker on the
// rejection so tests can simulate a failed local session refresh.
jest.mock('./primeAuthSessionAccess', () => ({
  readAuthTokenAllowingRetryableAuthError: async (
    read: () => Promise<string>,
  ) => {
    try {
      return { token: await read() };
    } catch (error) {
      if ((error as { $$retryable?: boolean } | undefined)?.$$retryable) {
        return { token: '', retryableError: error };
      }
      throw error;
    }
  },
  readAuthTokenOrNull: async (read: () => Promise<string>) => {
    try {
      return (await read()) || null;
    } catch {
      return null;
    }
  },
  // Pass-through slot queue preserving the serial-execution shape.
  runExclusiveOnAuthSessionSlot: async (
    _source: unknown,
    fn: () => Promise<unknown>,
  ) => fn(),
  removeAuthSessionStorageBySessionSource: (source: unknown) =>
    mockRemoveAuthSessionStorageBySessionSource(source),
  readPersistedAccessTokenBySessionSource: (source: unknown) =>
    mockReadPersistedAccessTokenBySessionSource(source),
  readPersistedAccessTokenBySessionSourceStrict: (source: unknown) =>
    mockReadPersistedAccessTokenBySessionSourceStrict(source),
  revokeAuthSessionTokenOnServerBestEffort: (params: unknown) =>
    mockRevokeAuthSessionTokenOnServerBestEffort(params),
  clearSupabaseStorageLocalCache: jest.fn(),
}));

const {
  OneKeyErrorOneKeyIdKeylessSessionSlotReplaced,
  OneKeyErrorPrimeLoginInvalidToken,
  OneKeyLocalError,
} = require('@onekeyhq/shared/src/errors');
const {
  EOneKeyErrorClassNames,
} = require('@onekeyhq/shared/src/errors/types/errorTypes');
const {
  EAppEventBusNames,
  appEventBus,
} = require('@onekeyhq/shared/src/eventBus/appEventBus');
const {
  stashRequestAuthTokenOfError,
  takeRequestAuthTokenOfError,
} = require('@onekeyhq/shared/src/request/requestAuthTokenErrorStash');
const {
  EPrimeAuthSessionSource,
} = require('@onekeyhq/shared/types/prime/primeTypes');

const ServicePrime = require('./ServicePrime').default;

const REQUEST_TOKEN = 'request-token';

function createService() {
  const simpleDbPrime = {
    getAuthSessionSource: jest.fn(async () => undefined as unknown),
    getAuthStateGeneration: jest.fn(async () => 0),
    getActiveAuthToken: jest.fn(async () => ''),
    getSupabaseAuthToken: jest.fn(async () => ''),
    getKeylessSupabaseAuthToken: jest.fn(async () => ''),
    getEffectiveAuthSessionSource: jest.fn(async () => undefined as unknown),
    setAuthSessionSource: jest.fn(async () => undefined),
    clearCachedAuthToken: jest.fn(async () => undefined),
    clearAuthTokens: jest.fn(async () => undefined),
    clearKeylessAuthSession: jest.fn(async () => undefined),
    clearLegacyAuthSession: jest.fn(async () => undefined),
    clearLocalAuthSession: jest.fn(async () => undefined),
  };
  const backgroundApi: any = {
    simpleDb: {
      prime: simpleDbPrime,
    },
    serviceMasterPassword: {
      clearLocalMasterPassword: jest.fn(async () => undefined),
    },
    serviceSetting: {
      syncKytEnabledFromServer: jest.fn(async () => undefined),
    },
    serviceReferralCode: {
      updateMyReferralCode: jest.fn(async () => undefined),
    },
    serviceKeylessWallet: {
      cleanupLocalKeylessOAuthTokens: jest.fn(async () => undefined),
    },
  };
  const service = new ServicePrime({ backgroundApi });
  backgroundApi.servicePrime = service;
  return { service, backgroundApi, simpleDbPrime };
}

function createDeferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function flushAsync(rounds = 10) {
  for (let i = 0; i < rounds; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

describe('ServicePrime invalid-token handling', () => {
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    emitSpy = jest.spyOn(appEventBus, 'emit').mockImplementation(() => true);
  });

  afterEach(() => {
    emitSpy.mockRestore();
  });

  describe('D5: throwIfAllPrimeUserInfoRequestsFailedByInvalidTokenError', () => {
    it('skips re-handling for errors already handled by the interceptor ($$invalidTokenHandled)', async () => {
      const { service } = createService();
      const error = new OneKeyErrorPrimeLoginInvalidToken({
        message: 'invalid',
        code: 90_002,
      });
      error.$$invalidTokenHandled = true;
      const handleSpy = jest.spyOn(service, 'handlePrimeLoginInvalidToken');

      await expect(
        service.throwIfAllPrimeUserInfoRequestsFailedByInvalidTokenError({
          results: [
            { status: 'rejected', reason: error },
            { status: 'rejected', reason: error },
          ],
          requestAuthToken: REQUEST_TOKEN,
        }),
      ).rejects.toBe(error);

      expect(handleSpy).not.toHaveBeenCalled();
      expect(emitSpy).not.toHaveBeenCalledWith(
        EAppEventBusNames.PrimeLoginInvalidToken,
        expect.anything(),
      );
    });

    it('keeps full handling for unmarked errors (HTTP-200 body-code path)', async () => {
      const { service, simpleDbPrime } = createService();
      simpleDbPrime.getAuthSessionSource.mockResolvedValue(
        EPrimeAuthSessionSource.KeylessOAuth,
      );
      simpleDbPrime.getActiveAuthToken.mockResolvedValue(REQUEST_TOKEN);
      const error = new OneKeyErrorPrimeLoginInvalidToken({
        message: 'invalid',
        code: 90_002,
      });

      await expect(
        service.throwIfAllPrimeUserInfoRequestsFailedByInvalidTokenError({
          results: [
            { status: 'rejected', reason: error },
            { status: 'rejected', reason: error },
          ],
          requestAuthToken: REQUEST_TOKEN,
        }),
      ).rejects.toBe(error);

      expect(simpleDbPrime.clearAuthTokens).toHaveBeenCalled();
      // The per-source sweep runs through the generation-gated slot-queue
      // deletion, targeting only the keyless realm.
      expect(mockRemoveAuthSessionStorageBySessionSource).toHaveBeenCalledWith(
        EPrimeAuthSessionSource.KeylessOAuth,
      );
      expect(mockRevokeAuthSessionTokenOnServerBestEffort).toHaveBeenCalledWith(
        {
          authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
          accessToken: 'persisted-access-token',
        },
      );
      expect(emitSpy).toHaveBeenCalledWith(
        EAppEventBusNames.PrimeLoginInvalidToken,
        {
          authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
          clearedByBackground: true,
          // In-lock generation snapshot: lets main-runtime handlers detect
          // a login that commits during bg->main event propagation.
          authStateGeneration: 0,
        },
      );
    });
  });

  describe('D5: ServiceBase response interceptor', () => {
    // ServiceBase caches the OneKey-ID client (and thus the interceptor
    // closure and its backgroundApi) in a module-global map, so a single
    // shared service must be used and the handler swapped per test.
    const handlerImpl = jest.fn();

    beforeAll(async () => {
      const { service, backgroundApi } = createService();
      backgroundApi.servicePrime = {
        handlePrimeLoginInvalidToken: handlerImpl,
      };
      await service.getPrimeClient();
    });

    async function invokeInterceptorWith90002() {
      const onRejected = mockCapturedInterceptors.responseOnRejected;
      expect(onRejected).toBeDefined();
      const rawError = {
        data: {
          code: 90_002,
          message: 'refresh token required',
          requestUrl: 'https://test.onekey.so/prime/v1/user/info',
        },
      };
      // The global axios interceptor never writes the token onto the error
      // (it would leak through console.error / error collection); it goes
      // through the module-private WeakMap stash instead.
      stashRequestAuthTokenOfError({
        error: rawError,
        requestAuthToken: REQUEST_TOKEN,
      });
      let thrown: unknown;
      try {
        await onRejected?.(rawError);
      } catch (error) {
        thrown = error;
      }
      return { thrown, rawError };
    }

    it('never exposes the request token as a property of the error object', async () => {
      handlerImpl.mockImplementation(async () => ({
        cleared: false,
      }));
      const { thrown, rawError } = await invokeInterceptorWith90002();

      // The handler received the token via the stash…
      expect(handlerImpl).toHaveBeenCalledWith(
        expect.objectContaining({ requestAuthToken: REQUEST_TOKEN }),
      );
      // …but neither the incoming raw error nor the rethrown error carries
      // it anywhere JSON/console serialization could reach.
      expect(JSON.stringify(rawError)).not.toContain(REQUEST_TOKEN);
      expect(JSON.stringify(thrown)).not.toContain(REQUEST_TOKEN);
      // Read-and-delete: a second take returns nothing.
      expect(takeRequestAuthTokenOfError(rawError)).toBe('');
    });

    it('marks the rethrown error with $$invalidTokenHandled after handling', async () => {
      handlerImpl.mockImplementation(async () => ({
        cleared: true,
        authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
        authStateGeneration: 7,
      }));
      const { thrown } = await invokeInterceptorWith90002();

      expect(handlerImpl).toHaveBeenCalledWith({
        requestAuthToken: REQUEST_TOKEN,
        errorCode: 90_002,
        errorMessage: 'refresh token required',
        requestUrl: 'https://test.onekey.so/prime/v1/user/info',
      });
      expect(thrown).toBeInstanceOf(OneKeyErrorPrimeLoginInvalidToken);
      expect((thrown as Error).$$invalidTokenHandled).toBe(true);
      expect(emitSpy).toHaveBeenCalledWith(
        EAppEventBusNames.PrimeLoginInvalidToken,
        {
          authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
          clearedByBackground: true,
          // Forwarded from the handler result so main-runtime handlers can
          // gate on staleness.
          authStateGeneration: 7,
        },
      );
    });

    it('still throws the marked invalid-token error when the handler fails', async () => {
      handlerImpl.mockImplementation(async () => {
        throw new OneKeyLocalError('handler exploded');
      });
      const { thrown } = await invokeInterceptorWith90002();

      expect(handlerImpl).toHaveBeenCalled();
      expect(thrown).toBeInstanceOf(OneKeyErrorPrimeLoginInvalidToken);
      // Marker means "handled or attempted": set even on handler failure so
      // downstream never re-runs the handler with corrupted state.
      expect((thrown as Error).$$invalidTokenHandled).toBe(true);
      expect(emitSpy).not.toHaveBeenCalledWith(
        EAppEventBusNames.PrimeLoginInvalidToken,
        expect.anything(),
      );
    });
  });

  describe('D4: handlePrimeLoginInvalidToken in-lock guard re-check', () => {
    it('clears when guards hold across the lock (happy path)', async () => {
      const { service, backgroundApi, simpleDbPrime } = createService();
      simpleDbPrime.getAuthSessionSource.mockResolvedValue(
        EPrimeAuthSessionSource.KeylessOAuth,
      );
      simpleDbPrime.getActiveAuthToken.mockResolvedValue(REQUEST_TOKEN);

      const result = await service.handlePrimeLoginInvalidToken({
        requestAuthToken: REQUEST_TOKEN,
        errorCode: 90_002,
        errorMessage: 'invalid',
      });

      expect(result).toEqual({
        cleared: true,
        authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
        authStateGeneration: 0,
      });
      expect(simpleDbPrime.clearAuthTokens).toHaveBeenCalled();
      expect(mockRemoveAuthSessionStorageBySessionSource).toHaveBeenCalledWith(
        EPrimeAuthSessionSource.KeylessOAuth,
      );
      expect(mockRevokeAuthSessionTokenOnServerBestEffort).toHaveBeenCalledWith(
        {
          authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
          accessToken: 'persisted-access-token',
        },
      );
      expect(mockPrimePersistAtom.set).toHaveBeenCalled();
      expect(
        backgroundApi.serviceMasterPassword.clearLocalMasterPassword,
      ).toHaveBeenCalled();
    });

    it('skips the post-lock per-source session sweep when a login commits after the in-lock clear', async () => {
      const { service, simpleDbPrime } = createService();
      simpleDbPrime.getAuthSessionSource.mockResolvedValue(
        EPrimeAuthSessionSource.KeylessOAuth,
      );
      simpleDbPrime.getActiveAuthToken.mockResolvedValue(REQUEST_TOKEN);
      // In-lock snapshot reads 0; a same-source OAuth login fully commits
      // right after the lock releases, bumping the generation to 1 — the
      // sweep would otherwise delete the fresh login's session while its
      // atom/source stay logged-in (the commit fail-safe already passed).
      simpleDbPrime.getAuthStateGeneration
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);

      const result = await service.handlePrimeLoginInvalidToken({
        requestAuthToken: REQUEST_TOKEN,
        errorCode: 90_002,
        errorMessage: 'invalid',
      });

      // The guarded simpleDb+atom clear already committed in-lock…
      expect(result.cleared).toBe(true);
      expect(simpleDbPrime.clearAuthTokens).toHaveBeenCalled();
      // …but the stale per-source session sweep must be skipped: neither
      // the storage removal nor the SDK sign-out may run.
      expect(
        mockRemoveAuthSessionStorageBySessionSource,
      ).not.toHaveBeenCalled();
      expect(
        mockRevokeAuthSessionTokenOnServerBestEffort,
      ).not.toHaveBeenCalled();
    });

    it('skips clearing when the active token changed while waiting for the lock (concurrent re-login committed)', async () => {
      const { service, simpleDbPrime } = createService();
      simpleDbPrime.getAuthSessionSource.mockResolvedValue(
        EPrimeAuthSessionSource.KeylessOAuth,
      );
      let activeToken = REQUEST_TOKEN;
      simpleDbPrime.getActiveAuthToken.mockImplementation(
        async () => activeToken,
      );

      // Hold authStateWriteMutex, simulating a login commit in progress.
      const lockAcquired = createDeferred();
      const releaseLock = createDeferred();
      const lockHolder = service.authStateWriteMutex.runExclusive(async () => {
        lockAcquired.resolve();
        await releaseLock.promise;
      });
      await lockAcquired.promise;

      const resultPromise = service.handlePrimeLoginInvalidToken({
        requestAuthToken: REQUEST_TOKEN,
        errorCode: 90_002,
        errorMessage: 'invalid',
      });
      // Let the entry-time guards (which pass: token still matches) finish
      // and the handler block on the mutex.
      await flushAsync();

      // The "login" commits a fresh token before releasing the lock.
      activeToken = 'fresh-token-after-relogin';
      releaseLock.resolve();
      await lockHolder;

      const result = await resultPromise;
      expect(result.cleared).toBe(false);
      expect(simpleDbPrime.clearAuthTokens).not.toHaveBeenCalled();
      expect(
        mockRemoveAuthSessionStorageBySessionSource,
      ).not.toHaveBeenCalled();
      expect(
        mockRevokeAuthSessionTokenOnServerBestEffort,
      ).not.toHaveBeenCalled();
      expect(mockPrimePersistAtom.set).not.toHaveBeenCalled();
    });

    it('skips clearing when the auth session source changed while waiting for the lock', async () => {
      const { service, simpleDbPrime } = createService();
      // Entry-time: no persisted source, no token anywhere -> guards pass
      // (legacy fallback would be cleared).
      const sourceRef: { current: unknown } = { current: undefined };
      simpleDbPrime.getAuthSessionSource.mockImplementation(
        async () => sourceRef.current,
      );
      simpleDbPrime.getActiveAuthToken.mockResolvedValue('');
      simpleDbPrime.getSupabaseAuthToken.mockResolvedValue('');

      const lockAcquired = createDeferred();
      const releaseLock = createDeferred();
      const lockHolder = service.authStateWriteMutex.runExclusive(async () => {
        lockAcquired.resolve();
        await releaseLock.promise;
      });
      await lockAcquired.promise;

      const resultPromise = service.handlePrimeLoginInvalidToken({
        requestAuthToken: REQUEST_TOKEN,
        errorCode: 90_003,
        errorMessage: 'invalid',
      });
      await flushAsync();

      // A concurrent login commits a KeylessOAuth source (its token read
      // still returns '' here, keeping the token guards pass-through, so
      // only the source-changed re-check can catch this).
      sourceRef.current = EPrimeAuthSessionSource.KeylessOAuth;
      releaseLock.resolve();
      await lockHolder;

      const result = await resultPromise;
      expect(result.cleared).toBe(false);
      expect(simpleDbPrime.clearAuthTokens).not.toHaveBeenCalled();
      expect(mockPrimePersistAtom.set).not.toHaveBeenCalled();
    });

    it('preserves the retryable-error skip inside the lock', async () => {
      const { service, simpleDbPrime } = createService();
      simpleDbPrime.getAuthSessionSource.mockResolvedValue(
        EPrimeAuthSessionSource.LegacyEmailSupabase,
      );
      // Entry-time read succeeds, in-lock read hits a retryable refresh
      // failure -> the clear must be skipped.
      simpleDbPrime.getActiveAuthToken
        .mockResolvedValueOnce(REQUEST_TOKEN)
        .mockImplementationOnce(async () => {
          const error: any = new Error('fetch failed');
          error.$$retryable = true;
          throw error;
        });

      const result = await service.handlePrimeLoginInvalidToken({
        requestAuthToken: REQUEST_TOKEN,
        errorCode: 90_002,
        errorMessage: 'invalid',
      });

      expect(result.cleared).toBe(false);
      expect(simpleDbPrime.clearAuthTokens).not.toHaveBeenCalled();
      expect(mockPrimePersistAtom.set).not.toHaveBeenCalled();
    });

    it('preserves the no-request-token skip (entry-time)', async () => {
      const { service, simpleDbPrime } = createService();
      simpleDbPrime.getAuthSessionSource.mockResolvedValue(
        EPrimeAuthSessionSource.KeylessOAuth,
      );
      simpleDbPrime.getActiveAuthToken.mockResolvedValue(REQUEST_TOKEN);

      const result = await service.handlePrimeLoginInvalidToken({
        errorCode: 90_002,
        errorMessage: 'invalid',
      });

      expect(result.cleared).toBe(false);
      expect(simpleDbPrime.clearAuthTokens).not.toHaveBeenCalled();
    });

    it('preserves the stale-token skip (entry-time)', async () => {
      const { service, simpleDbPrime } = createService();
      simpleDbPrime.getAuthSessionSource.mockResolvedValue(
        EPrimeAuthSessionSource.KeylessOAuth,
      );
      simpleDbPrime.getActiveAuthToken.mockResolvedValue('another-token');

      const result = await service.handlePrimeLoginInvalidToken({
        requestAuthToken: REQUEST_TOKEN,
        errorCode: 90_002,
        errorMessage: 'invalid',
      });

      expect(result.cleared).toBe(false);
      expect(simpleDbPrime.clearAuthTokens).not.toHaveBeenCalled();
    });
  });
});

describe('ServicePrime.clearOneKeyIdAuthStateIfNoActiveToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clears tokens and resets the atom when no active token exists (entry + in-lock)', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getActiveAuthToken.mockResolvedValue('');
    const atomResetSpy = jest
      .spyOn(service, 'setPrimePersistAtomNotLoggedIn')
      .mockResolvedValue(undefined);

    const result = await service.clearOneKeyIdAuthStateIfNoActiveToken({
      callerName: 'test',
    });

    expect(result.cleared).toBe(true);
    expect(simpleDbPrime.clearAuthTokens).toHaveBeenCalled();
    expect(atomResetSpy).toHaveBeenCalled();
  });

  it('skips clearing when a login commit lands between the entry read and the in-lock re-read', async () => {
    const { service, simpleDbPrime } = createService();
    // Entry-time read observes no token, but a concurrent OAuth login
    // commits before the lock is acquired — the in-lock re-read must see it
    // and abort, otherwise the just-committed authSessionSource would be
    // wiped (a wiped KeylessOAuth source is never re-inferred).
    simpleDbPrime.getActiveAuthToken
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('fresh-login-token');
    const atomResetSpy = jest
      .spyOn(service, 'setPrimePersistAtomNotLoggedIn')
      .mockResolvedValue(undefined);

    const result = await service.clearOneKeyIdAuthStateIfNoActiveToken({
      callerName: 'test',
    });

    expect(result.cleared).toBe(false);
    expect(simpleDbPrime.clearAuthTokens).not.toHaveBeenCalled();
    expect(atomResetSpy).not.toHaveBeenCalled();
  });

  it('skips clearing when the token read fails with a retryable auth error', async () => {
    const { service, simpleDbPrime } = createService();
    const retryableError: Error & { $$retryable?: boolean } = new Error(
      'transient refresh failure',
    );
    retryableError.$$retryable = true;
    simpleDbPrime.getActiveAuthToken.mockRejectedValue(retryableError);
    const atomResetSpy = jest
      .spyOn(service, 'setPrimePersistAtomNotLoggedIn')
      .mockResolvedValue(undefined);

    const result = await service.clearOneKeyIdAuthStateIfNoActiveToken({
      callerName: 'test',
    });

    expect(result.cleared).toBe(false);
    expect(simpleDbPrime.clearAuthTokens).not.toHaveBeenCalled();
    expect(atomResetSpy).not.toHaveBeenCalled();
  });
});

describe('ServicePrime.clearAuthSessionIfGenerationStillMatches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('removes storage under the lock then revokes the snapshotted token on the server when the generation matches', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(3);

    const result = await service.clearAuthSessionIfGenerationStillMatches({
      authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
      expectedAuthStateGeneration: 3,
      callerName: 'test',
    });

    expect(result).toEqual({ cleared: true });
    expect(mockRemoveAuthSessionStorageBySessionSource).toHaveBeenCalledWith(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    expect(mockRevokeAuthSessionTokenOnServerBestEffort).toHaveBeenCalledWith({
      authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
      accessToken: 'persisted-access-token',
    });
  });

  it('skips removal and server revocation when a login committed after the snapshot', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(4);

    const result = await service.clearAuthSessionIfGenerationStillMatches({
      authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
      expectedAuthStateGeneration: 3,
      callerName: 'test',
    });

    expect(result).toEqual({ cleared: false, generationChanged: true });
    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();
    expect(mockRevokeAuthSessionTokenOnServerBestEffort).not.toHaveBeenCalled();
  });

  it('validates the generation atomically with commits (waits for authStateWriteMutex)', async () => {
    const { service, simpleDbPrime } = createService();
    const generationRef = { current: 3 };
    simpleDbPrime.getAuthStateGeneration.mockImplementation(
      async () => generationRef.current,
    );

    // Hold authStateWriteMutex, simulating a login commit in progress.
    const lockAcquired = createDeferred();
    const releaseLock = createDeferred();
    const lockHolder = service.authStateWriteMutex.runExclusive(async () => {
      lockAcquired.resolve();
      await releaseLock.promise;
    });
    await lockAcquired.promise;

    const resultPromise = service.clearAuthSessionIfGenerationStillMatches({
      authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
      expectedAuthStateGeneration: 3,
      callerName: 'test',
    });
    await flushAsync();
    // Nothing may have been deleted while the commit holds the mutex.
    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();

    // The commit bumps the generation before releasing the lock — the
    // deletion must then observe it and skip.
    generationRef.current = 4;
    releaseLock.resolve();
    await lockHolder;

    const result = await resultPromise;
    expect(result).toEqual({ cleared: false, generationChanged: true });
    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();
    expect(mockRevokeAuthSessionTokenOnServerBestEffort).not.toHaveBeenCalled();
  });
});

describe('ServicePrime.clearOneKeyIdAuthStateIfSourceStillKeylessOAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clears when the source is still KeylessOAuth and the generation is unchanged', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(3);
    const atomResetSpy = jest
      .spyOn(service, 'setPrimePersistAtomNotLoggedIn')
      .mockResolvedValue(undefined);

    const result =
      await service.clearOneKeyIdAuthStateIfSourceStillKeylessOAuth({
        callerName: 'test',
        expectedAuthStateGeneration: 3,
      });

    expect(result).toEqual({ cleared: true });
    expect(simpleDbPrime.clearAuthTokens).toHaveBeenCalled();
    expect(atomResetSpy).toHaveBeenCalled();
  });

  it('skips with generationChanged when a login committed after the caller snapshot', async () => {
    const { service, simpleDbPrime } = createService();
    // The fresh login re-committed KeylessOAuth, so a source-only recheck
    // would still match and wipe it — only the generation exposes the race.
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(4);
    const atomResetSpy = jest
      .spyOn(service, 'setPrimePersistAtomNotLoggedIn')
      .mockResolvedValue(undefined);

    const result =
      await service.clearOneKeyIdAuthStateIfSourceStillKeylessOAuth({
        callerName: 'test',
        expectedAuthStateGeneration: 3,
      });

    expect(result).toEqual({ cleared: false, generationChanged: true });
    expect(simpleDbPrime.clearAuthTokens).not.toHaveBeenCalled();
    expect(atomResetSpy).not.toHaveBeenCalled();
  });

  it('keeps the source-only guard when no generation snapshot is provided', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    const atomResetSpy = jest
      .spyOn(service, 'setPrimePersistAtomNotLoggedIn')
      .mockResolvedValue(undefined);

    const result =
      await service.clearOneKeyIdAuthStateIfSourceStillKeylessOAuth({
        callerName: 'test',
      });

    expect(result).toEqual({ cleared: false });
    expect(simpleDbPrime.clearAuthTokens).not.toHaveBeenCalled();
    expect(atomResetSpy).not.toHaveBeenCalled();
  });
});

describe('ServicePrime.apiLogin invalid-token clear guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockLoginRejection(service: any) {
    const invalidTokenError = new OneKeyErrorPrimeLoginInvalidToken({
      message: 'invalid token',
      code: 90_002,
    });
    service.getPrimeClient = jest.fn(async () => ({
      post: jest.fn(async () => {
        throw invalidTokenError;
      }),
    }));
    return invalidTokenError;
  }

  it('clears tokens on a confirmed invalid-token rejection when no other realm committed', async () => {
    const { service, simpleDbPrime } = createService();
    mockLoginRejection(service);
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(undefined);

    await expect(
      service.apiLogin({ accessToken: REQUEST_TOKEN }),
    ).rejects.toThrow('invalid token');

    expect(simpleDbPrime.clearAuthTokens).toHaveBeenCalled();
  });

  it('skips clearing when the persisted source belongs to another realm (KeylessOAuth)', async () => {
    const { service, simpleDbPrime } = createService();
    mockLoginRejection(service);
    // A KeylessOAuth login committed concurrently (or this call replayed a
    // residual legacy token while a keyless session backs the live login):
    // clearing would wipe that session's source, which is never re-inferred.
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );

    await expect(
      service.apiLogin({ accessToken: REQUEST_TOKEN }),
    ).rejects.toThrow('invalid token');

    expect(simpleDbPrime.clearAuthTokens).not.toHaveBeenCalled();
  });

  it('keeps the persisted source on a transient login failure', async () => {
    const { service, simpleDbPrime } = createService();
    service.getPrimeClient = jest.fn(async () => ({
      post: jest.fn(async () => {
        throw new OneKeyLocalError('Network Error');
      }),
    }));

    await expect(
      service.apiLogin({ accessToken: REQUEST_TOKEN }),
    ).rejects.toThrow('Network Error');

    expect(simpleDbPrime.clearAuthTokens).not.toHaveBeenCalled();
  });
});

describe('ServicePrime.commitAuthSessionSourceAndPrimeAtom', () => {
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    emitSpy = jest.spyOn(appEventBus, 'emit').mockImplementation(() => true);
  });

  afterEach(() => {
    emitSpy.mockRestore();
  });

  it('emits PrimeAuthSessionSourceCommitted and runs the atom update after a successful commit', async () => {
    // The main-runtime SupabaseAuthProvider relies on this event: a bind
    // commit switches the source without flipping primePersistAtom.isLoggedIn,
    // so without the event the provider would keep selecting the stale slot.
    const { service, simpleDbPrime } = createService();
    const updatePrimeAtom = jest.fn(async () => undefined);

    await service.commitAuthSessionSourceAndPrimeAtom({
      authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
      callerName: 'test',
      updatePrimeAtom,
    });

    expect(simpleDbPrime.setAuthSessionSource).toHaveBeenCalledWith(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    // Lock policy: the in-lock slot check must be the strict LOCAL
    // persisted-bytes read of the committed source, never a network-capable
    // getSession-based token read.
    expect(
      mockReadPersistedAccessTokenBySessionSourceStrict,
    ).toHaveBeenCalledWith(EPrimeAuthSessionSource.KeylessOAuth);
    expect(simpleDbPrime.getActiveAuthToken).not.toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.PrimeAuthSessionSourceCommitted,
      {
        authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
        callerName: 'test',
      },
    );
    expect(updatePrimeAtom).toHaveBeenCalled();
    expect(simpleDbPrime.clearAuthTokens).not.toHaveBeenCalled();
  });

  it('does not emit and rolls back when the committed slot is empty', async () => {
    const { service, simpleDbPrime } = createService();
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValueOnce({
      status: 'empty',
    });
    const updatePrimeAtom = jest.fn(async () => undefined);
    const atomResetSpy = jest
      .spyOn(service, 'setPrimePersistAtomNotLoggedIn')
      .mockResolvedValue(undefined);

    await expect(
      service.commitAuthSessionSourceAndPrimeAtom({
        authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
        callerName: 'test',
        updatePrimeAtom,
      }),
    ).rejects.toThrow('Active auth token not found');

    expect(atomResetSpy).toHaveBeenCalled();
    expect(simpleDbPrime.clearAuthTokens).toHaveBeenCalled();
    expect(updatePrimeAtom).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.PrimeAuthSessionSourceCommitted,
      expect.anything(),
    );
  });

  it('rolls back before rethrowing when the strict slot read fails transiently', async () => {
    // Previously a transient throw escaped AFTER setAuthSessionSource,
    // leaving source persisted + atom logged out (half-committed state).
    const { service, simpleDbPrime } = createService();
    const transientError = new Error('sealed storage transient failure');
    mockReadPersistedAccessTokenBySessionSourceStrict.mockRejectedValueOnce(
      transientError,
    );
    const atomResetSpy = jest
      .spyOn(service, 'setPrimePersistAtomNotLoggedIn')
      .mockResolvedValue(undefined);

    await expect(
      service.commitAuthSessionSourceAndPrimeAtom({
        authSessionSource: EPrimeAuthSessionSource.LegacyEmailSupabase,
        callerName: 'test',
        updatePrimeAtom: jest.fn(async () => undefined),
      }),
    ).rejects.toBe(transientError);

    expect(simpleDbPrime.setAuthSessionSource).toHaveBeenCalled();
    expect(simpleDbPrime.clearAuthTokens).toHaveBeenCalled();
    expect(atomResetSpy).toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.PrimeAuthSessionSourceCommitted,
      expect.anything(),
    );
  });

  it('rolls back before rethrowing when the prime-atom update fails', async () => {
    const { service, simpleDbPrime } = createService();
    const atomError = new Error('atom write failed');
    const atomResetSpy = jest
      .spyOn(service, 'setPrimePersistAtomNotLoggedIn')
      .mockResolvedValue(undefined);

    await expect(
      service.commitAuthSessionSourceAndPrimeAtom({
        authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
        callerName: 'test',
        updatePrimeAtom: jest.fn(async () => {
          throw atomError;
        }),
      }),
    ).rejects.toBe(atomError);

    expect(simpleDbPrime.clearAuthTokens).toHaveBeenCalled();
    expect(atomResetSpy).toHaveBeenCalled();
  });
});

// Build an unsigned JWT-shaped token whose payload decodes to the given
// claims — enough for the identity guard, which reads claims only and never
// verifies signatures.
function buildFakeJwt(payload: Record<string, unknown>): string {
  const encodeBase64Url = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${encodeBase64Url({ alg: 'none', typ: 'JWT' })}.${encodeBase64Url(
    payload,
  )}.fake-signature`;
}

describe('ServicePrime.apiOAuthLogin keyless slot identity guard', () => {
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    emitSpy = jest.spyOn(appEventBus, 'emit').mockImplementation(() => true);
  });

  afterEach(() => {
    emitSpy.mockRestore();
  });

  function mockOAuthLoginClient(service: any) {
    const post = jest.fn(async () => ({
      data: {
        data: {
          userId: 'user-a',
          onekeyAccount: {
            onekeyUserId: 'user-a',
            normalizedEmail: 'a@example.com',
            displayEmail: 'a@example.com',
          },
        },
      },
    }));
    service.getPrimeClient = jest.fn(async () => ({ post }));
    return post;
  }

  it('aborts before the server POST when the slot was replaced by a different account', async () => {
    // TOCTOU repro: account A's persist finished, but a concurrent flow
    // (ext popup vs expand tab) overwrote the shared keyless slot with
    // account B's session before the bg commit.
    const { service } = createService();
    const post = mockOAuthLoginClient(service);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValueOnce({
      status: 'ok',
      accessToken: buildFakeJwt({ sub: 'user-b' }),
    });

    const loginPromise = service.apiOAuthLogin({
      accessToken: buildFakeJwt({ sub: 'user-a' }),
    });
    await expect(loginPromise).rejects.toBeDefined();
    const error: unknown = await loginPromise.then(
      () => undefined,
      (e: unknown) => e,
    );

    // The typed class (not a plain OneKeyLocalError) is load-bearing: the
    // slot holds the WINNING flow's valid session, and main-runtime cleanup
    // matches this className to skip its session teardown.
    expect(error).toBeInstanceOf(OneKeyErrorOneKeyIdKeylessSessionSlotReplaced);
    expect((error as { className?: string }).className).toBe(
      EOneKeyErrorClassNames.OneKeyErrorOneKeyIdKeylessSessionSlotReplaced,
    );
    expect(post).not.toHaveBeenCalled();
  });

  it('accepts a rotated slot token carrying the same identity', async () => {
    // bg auto-refresh legitimately rotates tokens: different bytes, same
    // `sub` claim — neither the pre-POST guard nor the in-lock commit
    // re-check must reject that.
    const { service } = createService();
    const post = mockOAuthLoginClient(service);
    // First read: pre-POST guard. Second read: in-lock commit re-check.
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValueOnce({
      status: 'ok',
      accessToken: buildFakeJwt({ sub: 'user-a', iat: 1_752_000_000 }),
    });
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValueOnce({
      status: 'ok',
      accessToken: buildFakeJwt({ sub: 'user-a', iat: 1_752_000_500 }),
    });

    await service.apiOAuthLogin({
      accessToken: buildFakeJwt({ sub: 'user-a' }),
    });

    expect(post).toHaveBeenCalled();
  });

  it('rolls back but keeps the replacement session when the slot is replaced during the commit', async () => {
    // The pre-POST guard cannot cover the guard->POST->commit window: the
    // main-runtime persist takes no bg mutex, so account B can overwrite
    // the shared slot while account A's POST is in flight. The in-lock
    // commit re-check must then abort (typed slot-replaced error) and roll
    // back source + atom — WITHOUT which the commit would persist
    // atom=A / slot=B and every later authenticated request would use B's
    // token while the UI shows A.
    const { service, simpleDbPrime } = createService();
    const post = mockOAuthLoginClient(service);
    // Guard read: slot still holds account A.
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValueOnce({
      status: 'ok',
      accessToken: buildFakeJwt({ sub: 'user-a' }),
    });
    // Commit read: account B replaced the slot during the POST.
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValueOnce({
      status: 'ok',
      accessToken: buildFakeJwt({ sub: 'user-b' }),
    });

    const loginPromise = service.apiOAuthLogin({
      accessToken: buildFakeJwt({ sub: 'user-a' }),
    });
    await expect(loginPromise).rejects.toBeDefined();
    const error: unknown = await loginPromise.then(
      () => undefined,
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(OneKeyErrorOneKeyIdKeylessSessionSlotReplaced);
    expect(post).toHaveBeenCalled();
    // Rollback resets only the simpleDb source/token pair; the session slot
    // (B's valid session) is deliberately untouched.
    expect(simpleDbPrime.clearAuthTokens).toHaveBeenCalled();
  });

  it('aborts definitively when the in-flight token payload is undecodable', async () => {
    const { service } = createService();
    const post = mockOAuthLoginClient(service);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValueOnce({
      status: 'ok',
      accessToken: buildFakeJwt({ sub: 'user-a' }),
    });

    await expect(
      service.apiOAuthLogin({ accessToken: 'not-a-jwt' }),
    ).rejects.toThrow('session token payload is not decodable');

    expect(post).not.toHaveBeenCalled();
  });
});
