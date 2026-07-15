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
}));

const {
  OneKeyErrorPrimeLoginInvalidToken,
  OneKeyLocalError,
} = require('@onekeyhq/shared/src/errors');
const {
  EAppEventBusNames,
  appEventBus,
} = require('@onekeyhq/shared/src/eventBus/appEventBus');
const {
  EPrimeAuthSessionSource,
} = require('@onekeyhq/shared/types/prime/primeTypes');

const ServicePrime = require('./ServicePrime').default;

const REQUEST_TOKEN = 'request-token';

function createService() {
  const simpleDbPrime = {
    getAuthSessionSource: jest.fn(async () => undefined as unknown),
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
      expect(simpleDbPrime.clearKeylessAuthSession).toHaveBeenCalled();
      expect(simpleDbPrime.clearLegacyAuthSession).not.toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith(
        EAppEventBusNames.PrimeLoginInvalidToken,
        {
          authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
          clearedByBackground: true,
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
        $$requestAuthToken: REQUEST_TOKEN,
        data: {
          code: 90_002,
          message: 'refresh token required',
          requestUrl: 'https://test.onekey.so/prime/v1/user/info',
        },
      };
      let thrown: unknown;
      try {
        await onRejected?.(rawError);
      } catch (error) {
        thrown = error;
      }
      return { thrown };
    }

    it('marks the rethrown error with $$invalidTokenHandled after handling', async () => {
      handlerImpl.mockImplementation(async () => ({
        cleared: true,
        authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
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
      });
      expect(simpleDbPrime.clearAuthTokens).toHaveBeenCalled();
      expect(simpleDbPrime.clearKeylessAuthSession).toHaveBeenCalled();
      expect(mockPrimePersistAtom.set).toHaveBeenCalled();
      expect(
        backgroundApi.serviceMasterPassword.clearLocalMasterPassword,
      ).toHaveBeenCalled();
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
      expect(simpleDbPrime.clearKeylessAuthSession).not.toHaveBeenCalled();
      expect(simpleDbPrime.clearLegacyAuthSession).not.toHaveBeenCalled();
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

describe('ServicePrime.commitAuthSessionSourceBeforeAtomUpdate', () => {
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    emitSpy = jest.spyOn(appEventBus, 'emit').mockImplementation(() => true);
  });

  afterEach(() => {
    emitSpy.mockRestore();
  });

  it('emits PrimeAuthSessionSourceCommitted after a successful commit', async () => {
    // The main-runtime SupabaseAuthProvider relies on this event: a bind
    // commit switches the source without flipping primePersistAtom.isLoggedIn,
    // so without the event the provider would keep selecting the stale slot.
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getActiveAuthToken.mockResolvedValue('active-token');

    await service.commitAuthSessionSourceBeforeAtomUpdate({
      authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
      callerName: 'test',
    });

    expect(simpleDbPrime.setAuthSessionSource).toHaveBeenCalledWith(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.PrimeAuthSessionSourceCommitted,
      {
        authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
        callerName: 'test',
      },
    );
  });

  it('does not emit when the commit fails safe (no readable active token)', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getActiveAuthToken.mockResolvedValue('');
    const atomResetSpy = jest
      .spyOn(service, 'setPrimePersistAtomNotLoggedIn')
      .mockResolvedValue(undefined);

    await expect(
      service.commitAuthSessionSourceBeforeAtomUpdate({
        authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
        callerName: 'test',
      }),
    ).rejects.toThrow('Active auth token not found');

    expect(atomResetSpy).toHaveBeenCalled();
    expect(simpleDbPrime.clearAuthTokens).toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.PrimeAuthSessionSourceCommitted,
      expect.anything(),
    );
  });
});
