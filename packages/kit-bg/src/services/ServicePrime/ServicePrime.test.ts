/* eslint-disable import/first, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-var-requires */

import type { IKeylessOAuthSessionPersistenceJournal } from '../../dbs/simple/entity/SimpleDbEntityPrime';

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
const mockPersistKeylessAuthSession = jest.fn(
  async (_params: unknown) => undefined,
);
const mockClearAllSupabaseAuthSessions = jest.fn(async () => undefined);
const mockVerifyEmailOtp = jest.fn();

jest.mock('@onekeyhq/shared/src/utils/supabaseClientUtils', () => ({
  getSupabaseClient: () => ({
    client: {
      auth: {
        verifyOtp: mockVerifyEmailOtp,
      },
    },
  }),
}));

// Real retryable-error semantics, driven by a `$$retryable` marker on the
// rejection so tests can simulate a failed local session refresh.
jest.mock('./primeAuthSessionAccess', () => ({
  allowAuthSessionStorageWritesBySessionSource: jest.fn(),
  clearAllSupabaseAuthSessions: () => mockClearAllSupabaseAuthSessions(),
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
  persistKeylessAuthSession: (params: unknown) =>
    mockPersistKeylessAuthSession(params),
  clearSupabaseStorageLocalCache: jest.fn(),
}));

const {
  EOAuthSocialLoginProvider,
} = require('@onekeyhq/shared/src/consts/authConsts');
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
const stringUtils = require('@onekeyhq/shared/src/utils/stringUtils').default;
const {
  EPrimeAuthSessionSource,
  EOneKeyIdAccountStatus,
  EOneKeyIdIdentityType,
  EOneKeyIdOAuthProvider,
} = require('@onekeyhq/shared/types/prime/primeTypes');

const {
  isIdentityRecoveryReady,
  resetIdentityRecoveryStateForTest,
} = require('../ServiceIdentityExit/identityLifecycleMutex');

const ServicePrime = require('./ServicePrime').default;

const REQUEST_TOKEN = 'request-token';

function createService() {
  const simpleDbPrime = {
    getAuthSessionSource: jest.fn(async () => undefined as unknown),
    getAuthSessionCommitId: jest.fn(
      async () => undefined as string | undefined,
    ),
    getKeylessSessionCommitId: jest.fn(
      async () => undefined as string | undefined,
    ),
    getAuthStateGeneration: jest.fn(async () => 0),
    getIdentityLifecycleRevision: jest.fn(async () => 0),
    getOneKeyIdAuthState: jest.fn(
      async (): Promise<'loggedIn' | 'loggedOut' | undefined> => 'loggedOut',
    ),
    getActiveAuthToken: jest.fn(async () => ''),
    getSupabaseAuthToken: jest.fn(async () => ''),
    getKeylessSupabaseAuthToken: jest.fn(async () => ''),
    getEffectiveAuthSessionSource: jest.fn(async () => undefined as unknown),
    getKeylessOAuthSessionPersistenceJournal: jest.fn(
      async () => undefined as unknown,
    ),
    setKeylessOAuthSessionPersistenceJournal: jest.fn<
      Promise<void>,
      [IKeylessOAuthSessionPersistenceJournal]
    >(async () => undefined),
    commitKeylessOAuthSessionPersistenceMetadata: jest.fn(async () => ({
      status: 'committed' as const,
      identityLifecycleRevision: 1,
    })),
    removeKeylessOAuthSessionPersistenceJournal: jest.fn(async () => true),
    setAuthSessionSource: jest.fn(async () => undefined),
    setAuthSessionSourceWithCommitId: jest.fn(async () => undefined),
    setAuthSessionCommitId: jest.fn(async () => undefined),
    setKeylessSessionCommitId: jest.fn(async () => undefined),
    bumpIdentityLifecycleRevision: jest.fn(async () => 1),
    clearCachedAuthToken: jest.fn(async () => undefined),
    clearAuthTokens: jest.fn(async () => undefined),
    clearAuthSessionCommitIdIfMatches: jest.fn(async () => true),
    clearKeylessSessionCommitIdIfMatches: jest.fn(async () => true),
    clearKeylessAuthSession: jest.fn(async () => undefined),
    clearLegacyAuthSession: jest.fn(async () => undefined),
    clearLocalAuthSession: jest.fn(async () => undefined),
    isAllIdentityAuthMetadataCleared: jest.fn(async () => false),
    clearAllIdentityAuthMetadataAndBumpRevision: jest.fn(async () => 1),
    hasShownOneKeyIdOAuthBindPrompt: jest.fn(async () => false),
    markOneKeyIdOAuthBindPromptShown: jest.fn(async () => undefined),
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
    servicePrimeCloudSync: {
      showAlertDialogIfServerPasswordNotSet: jest.fn(async () => undefined),
      showAlertDialogIfServerPasswordChanged: jest.fn(async () => undefined),
    },
    serviceAccount: {
      getKeylessWallet: jest.fn(async () => undefined),
    },
    serviceKeylessWallet: {
      cleanupLocalKeylessOAuthTokens: jest.fn(async () => undefined),
      validateTokenMatchesKeylessWallet: jest.fn(async () => ({
        isValid: true,
      })),
    },
    serviceIdentityExit: {
      reconcileMissingOneKeyIdSession: jest.fn(async () => ({
        cleared: true,
      })),
      stageRemoteOneKeyIdLogoutReconciliation: jest.fn(async () => ({
        staged: true as const,
        operationId: 'invalid-token-operation',
        planId: 'system:invalid-token-operation',
      })),
      executeIdentityExit: jest.fn(async () => ({
        status: 'completed' as const,
        oneKeyIdLoggedOut: true,
      })),
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

describe('ServicePrime.clearAllIdentityAuthForExplicitOperation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not commit local cleanup when legacy Keyless token deletion fails', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    simpleDbPrime.getIdentityLifecycleRevision.mockResolvedValue(7);
    const cleanupError = new OneKeyLocalError(
      'Legacy Keyless token deletion failed',
    );
    backgroundApi.serviceKeylessWallet.cleanupLocalKeylessOAuthTokens.mockRejectedValue(
      cleanupError,
    );

    await expect(
      service.clearAllIdentityAuthForExplicitOperation({
        callerName: 'accountDeletion',
        expectedIdentityLifecycleRevision: 7,
      }),
    ).rejects.toBe(cleanupError);

    expect(mockClearAllSupabaseAuthSessions).toHaveBeenCalledTimes(1);
    expect(
      simpleDbPrime.clearAllIdentityAuthMetadataAndBumpRevision,
    ).not.toHaveBeenCalled();
  });
});

describe('ServicePrime.commitIdentityExitLocalState', () => {
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    emitSpy = jest.spyOn(appEventBus, 'emit');
  });

  afterEach(() => {
    emitSpy.mockRestore();
  });

  it('clears only the wallet association when auth-session cleanup is omitted', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getIdentityLifecycleRevision.mockResolvedValue(7);
    simpleDbPrime.bumpIdentityLifecycleRevision.mockResolvedValue(8);
    simpleDbPrime.getKeylessSessionCommitId.mockResolvedValue(
      'wallet-session-2',
    );
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
    });

    await expect(
      service.commitIdentityExitLocalState({
        expectedIdentityLifecycleRevision: 7,
        keylessWalletSession: {
          walletId: 'hd-keyless-1',
          sessionCommitId: 'wallet-session-2',
        },
      }),
    ).resolves.toEqual({ status: 'committed', revision: 8 });

    expect(
      simpleDbPrime.clearKeylessSessionCommitIdIfMatches,
    ).toHaveBeenCalledWith({
      walletId: 'hd-keyless-1',
      expectedSessionCommitId: 'wallet-session-2',
    });
    expect(simpleDbPrime.getAuthSessionCommitId).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.clearAuthSessionCommitIdIfMatches,
    ).not.toHaveBeenCalled();
    expect(
      mockReadPersistedAccessTokenBySessionSourceStrict,
    ).not.toHaveBeenCalled();
    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.KeylessAuthSessionCleared,
      undefined,
    );
  });

  it('clears an unreadable Keyless session only for an authorized malformed-wallet recovery', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getIdentityLifecycleRevision.mockResolvedValue(7);
    simpleDbPrime.bumpIdentityLifecycleRevision.mockResolvedValue(8);
    simpleDbPrime.getAuthSessionCommitId.mockResolvedValue(undefined);
    simpleDbPrime.getKeylessSessionCommitId.mockResolvedValue(undefined);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'corrupt',
    });
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: false,
      isLoggedInOnServer: false,
    });

    await expect(
      service.commitIdentityExitLocalState({
        expectedIdentityLifecycleRevision: 7,
        keylessSession: {
          allowUnknownIdentity: true,
        },
        keylessWalletSession: {
          walletId: 'hd-keyless-1',
        },
      }),
    ).resolves.toEqual({ status: 'committed', revision: 8 });
    expect(mockRemoveAuthSessionStorageBySessionSource).toHaveBeenCalledWith(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
  });

  it('refuses to clear an unreadable Keyless session without malformed-wallet authorization', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getIdentityLifecycleRevision.mockResolvedValue(7);
    simpleDbPrime.getAuthSessionCommitId.mockResolvedValue(undefined);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'corrupt',
    });

    await expect(
      service.commitIdentityExitLocalState({
        expectedIdentityLifecycleRevision: 7,
        keylessSession: {},
      }),
    ).resolves.toEqual({ status: 'stateChanged' });
    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();
  });
});

describe('ServicePrime invalid-token handling', () => {
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrimePersistAtom.get.mockResolvedValue({});
    mockReadPersistedAccessTokenBySessionSourceStrict.mockReset();
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: buildFakeJwt({ sub: 'user-a' }),
    });
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

    it('defers unmarked HTTP-200 body-code errors to the identity coordinator', async () => {
      const { service, backgroundApi, simpleDbPrime } = createService();
      simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
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

      expect(simpleDbPrime.clearAuthTokens).not.toHaveBeenCalled();
      await flushAsync();
      expect(
        backgroundApi.serviceIdentityExit
          .stageRemoteOneKeyIdLogoutReconciliation,
      ).toHaveBeenCalledWith({
        expectedAccessToken: REQUEST_TOKEN,
      });
      expect(
        backgroundApi.serviceIdentityExit.executeIdentityExit,
      ).toHaveBeenCalledWith({
        planId: 'system:invalid-token-operation',
      });
      expect(emitSpy).toHaveBeenCalledWith(
        EAppEventBusNames.PrimeLoginInvalidToken,
        {
          authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
          clearedByBackground: true,
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

  describe('D4: handlePrimeLoginInvalidToken coordinator handoff', () => {
    it('returns promptly and lets the coordinator perform the authoritative cleanup', async () => {
      const { service, backgroundApi, simpleDbPrime } = createService();
      simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
        EPrimeAuthSessionSource.KeylessOAuth,
      );
      simpleDbPrime.getActiveAuthToken.mockResolvedValue(REQUEST_TOKEN);

      const result = await service.handlePrimeLoginInvalidToken({
        requestAuthToken: REQUEST_TOKEN,
        errorCode: 90_002,
        errorMessage: 'invalid',
      });

      expect(result).toEqual({
        cleared: false,
        authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
        authStateGeneration: 0,
      });
      expect(simpleDbPrime.clearAuthTokens).not.toHaveBeenCalled();
      await flushAsync();
      expect(
        backgroundApi.serviceIdentityExit
          .stageRemoteOneKeyIdLogoutReconciliation,
      ).toHaveBeenCalledWith({ expectedAccessToken: REQUEST_TOKEN });
      expect(
        backgroundApi.serviceIdentityExit.executeIdentityExit,
      ).toHaveBeenCalledWith({
        planId: 'system:invalid-token-operation',
      });
      expect(emitSpy).toHaveBeenCalledWith(
        EAppEventBusNames.PrimeLoginInvalidToken,
        {
          authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
          clearedByBackground: true,
          authStateGeneration: 0,
        },
      );
    });

    it('does not deadlock the interceptor while a login lifecycle commit is active', async () => {
      const { service, backgroundApi, simpleDbPrime } = createService();
      simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
        EPrimeAuthSessionSource.KeylessOAuth,
      );
      simpleDbPrime.getActiveAuthToken.mockResolvedValue(REQUEST_TOKEN);
      backgroundApi.serviceIdentityExit.executeIdentityExit.mockImplementation(
        async () => {
          await service.loginMutex.waitForUnlock();
          return { status: 'completed', oneKeyIdLoggedOut: true };
        },
      );

      const lockAcquired = createDeferred();
      const releaseLock = createDeferred();
      const lockHolder = service.loginMutex.runExclusive(async () => {
        lockAcquired.resolve();
        await releaseLock.promise;
      });
      await lockAcquired.promise;

      const result = await service.handlePrimeLoginInvalidToken({
        requestAuthToken: REQUEST_TOKEN,
        errorCode: 90_002,
        errorMessage: 'invalid',
      });

      expect(result.cleared).toBe(false);
      expect(
        backgroundApi.serviceIdentityExit
          .stageRemoteOneKeyIdLogoutReconciliation,
      ).toHaveBeenCalledWith({ expectedAccessToken: REQUEST_TOKEN });
      expect(emitSpy).not.toHaveBeenCalledWith(
        EAppEventBusNames.PrimeLoginInvalidToken,
        expect.anything(),
      );

      releaseLock.resolve();
      await lockHolder;
      await flushAsync();
      expect(
        backgroundApi.serviceIdentityExit.executeIdentityExit,
      ).toHaveBeenCalledWith({
        planId: 'system:invalid-token-operation',
      });
    });

    it('preserves the no-request-token skip (entry-time)', async () => {
      const { service, simpleDbPrime } = createService();
      simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
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
      simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
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

    it('fails closed when the active auth source is unavailable', async () => {
      const { service, backgroundApi, simpleDbPrime } = createService();
      simpleDbPrime.getActiveAuthToken.mockResolvedValue(REQUEST_TOKEN);

      await expect(
        service.handlePrimeLoginInvalidToken({
          requestAuthToken: REQUEST_TOKEN,
          errorCode: 90_002,
          errorMessage: 'invalid',
        }),
      ).rejects.toThrow('authSessionSource is unavailable');

      expect(
        backgroundApi.serviceIdentityExit
          .stageRemoteOneKeyIdLogoutReconciliation,
      ).not.toHaveBeenCalled();
    });
  });
});

describe('ServicePrime.clearOneKeyIdAuthStateIfNoActiveToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates missing-session cleanup to the durable identity coordinator', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();

    const result = await service.clearOneKeyIdAuthStateIfNoActiveToken({
      callerName: 'test',
    });

    expect(result.cleared).toBe(true);
    expect(
      backgroundApi.serviceIdentityExit.reconcileMissingOneKeyIdSession,
    ).toHaveBeenCalledWith({ callerName: 'test' });
    expect(simpleDbPrime.clearAuthTokens).not.toHaveBeenCalled();
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

  it('preserves the authoritative session state for deferred reconciliation', async () => {
    const { service, simpleDbPrime } = createService();
    mockLoginRejection(service);
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(undefined);

    await expect(
      service.apiLogin({ accessToken: REQUEST_TOKEN }),
    ).rejects.toThrow('invalid token');

    expect(simpleDbPrime.clearAuthTokens).not.toHaveBeenCalled();
  });

  it('does not clear a concurrently committed KeylessOAuth source', async () => {
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

describe('ServicePrime.apiEmailOtpLogin serialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a queued stale Email login after another surface commits first', async () => {
    const { service, simpleDbPrime } = createService();
    let isLoggedIn = false;
    mockPrimePersistAtom.get.mockImplementation(async () =>
      isLoggedIn
        ? {
            isLoggedIn: true,
            isLoggedInOnServer: true,
            onekeyUserId: 'first-user',
          }
        : {},
    );
    simpleDbPrime.getEffectiveAuthSessionSource.mockImplementation(async () =>
      isLoggedIn ? EPrimeAuthSessionSource.LegacyEmailSupabase : undefined,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockImplementation(async () =>
      isLoggedIn ? 'loggedIn' : 'loggedOut',
    );
    mockVerifyEmailOtp.mockResolvedValue({
      data: { session: { access_token: 'first-email-token' } },
      error: null,
    });
    service.apiLoginWithPersistedLegacySession = jest.fn(async () => {
      isLoggedIn = true;
    });

    const firstLogin = service.apiEmailOtpLogin({
      email: 'first@example.com',
      otp: '111111',
    });
    const queuedLogin = service.apiEmailOtpLogin({
      email: 'second@example.com',
      otp: '222222',
    });

    await expect(firstLogin).resolves.toEqual({ success: true });
    await expect(queuedLogin).rejects.toThrow('already logged in');
    expect(mockVerifyEmailOtp).toHaveBeenCalledTimes(1);
    expect(service.apiLoginWithPersistedLegacySession).toHaveBeenCalledTimes(1);
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

    expect(simpleDbPrime.setAuthSessionSourceWithCommitId).toHaveBeenCalledWith(
      expect.objectContaining({
        authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
      }),
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

    expect(simpleDbPrime.setAuthSessionSourceWithCommitId).toHaveBeenCalled();
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

describe('ServicePrime apiFetchPrimeUserInfo lifecycle commit guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadPersistedAccessTokenBySessionSourceStrict.mockReset();
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'user-a',
      primeSubscription: undefined,
    });
  });

  it('discards an old response when lifecycle revision changes before the atom commit', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getAuthSessionCommitId.mockResolvedValue('commit-a');
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    simpleDbPrime.getActiveAuthToken.mockResolvedValue('active-token-a');
    simpleDbPrime.getIdentityLifecycleRevision
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(8);
    service.callApiFetchPrimeUserInfo = jest.fn(async () => ({
      userId: 'user-a',
      isPrime: false,
    }));
    const updateSpy = jest
      .spyOn(service, 'updatePrimeAtomByServerUserInfo')
      .mockResolvedValue({ primeSubscription: undefined });

    const result = await (service as any)._fetchPrimeUserInfo();

    expect(updateSpy).not.toHaveBeenCalled();
    expect(result.serverUserInfo).toBeUndefined();
    expect(result.userInfo.onekeyUserId).toBe('user-a');
  });
});

describe('ServicePrime.checkAndMarkShouldShowOneKeyIdOAuthBindPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not check or mark an account that was already reminded', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.hasShownOneKeyIdOAuthBindPrompt.mockResolvedValue(true);
    const bindRequiredSpy = jest.spyOn(
      service,
      'isLegacyOneKeyIdOAuthBindRequired',
    );

    await expect(
      service.checkAndMarkShouldShowOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toBe(false);

    expect(bindRequiredSpy).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.markOneKeyIdOAuthBindPromptShown,
    ).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'marks the reminder decision once when bindRequired=%s',
    async (bindRequired) => {
      const { service, simpleDbPrime } = createService();
      jest
        .spyOn(service, 'isLegacyOneKeyIdOAuthBindRequired')
        .mockResolvedValue(bindRequired);

      await expect(
        service.checkAndMarkShouldShowOneKeyIdOAuthBindPrompt({
          onekeyUserId: 'user-1',
        }),
      ).resolves.toBe(bindRequired);

      expect(
        simpleDbPrime.markOneKeyIdOAuthBindPromptShown,
      ).toHaveBeenCalledWith({ onekeyUserId: 'user-1' });
    },
  );

  it('does not consume the reminder when the profile check fails', async () => {
    const { service, simpleDbPrime } = createService();
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    jest
      .spyOn(service, 'isLegacyOneKeyIdOAuthBindRequired')
      .mockRejectedValue(new Error('network failed'));

    await expect(
      service.checkAndMarkShouldShowOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toBe(false);

    expect(
      simpleDbPrime.markOneKeyIdOAuthBindPromptShown,
    ).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

// Build an unsigned JWT-shaped token whose payload decodes to the given
// claims — enough for the identity guard, which reads claims only and never
// verifies signatures.
function buildFakeJwt(payload: Record<string, unknown>): string {
  const normalizedPayload = Object.prototype.hasOwnProperty.call(
    payload,
    'session_id',
  )
    ? payload
    : {
        ...payload,
        session_id:
          typeof payload.sub === 'string'
            ? `supabase-session:${payload.sub}`
            : undefined,
      };
  const encodeBase64Url = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${encodeBase64Url({ alg: 'none', typ: 'JWT' })}.${encodeBase64Url(
    normalizedPayload,
  )}.fake-signature`;
}

describe('ServicePrime OneKey ID OAuth identity precheck', () => {
  function mockProfile(service: any) {
    service.apiFetchOneKeyIdProfile = jest.fn(async () => ({
      onekeyAccount: {
        onekeyUserId: 'onekey-user-a',
        status: EOneKeyIdAccountStatus.Active,
        identities: [
          {
            identityType: EOneKeyIdIdentityType.LegacyEmail,
            legacyEmail: 'a@example.com',
          },
          {
            identityType: EOneKeyIdIdentityType.OAuth,
            oauthProvider: EOneKeyIdOAuthProvider.Google,
            oauthSubject: 'google-sub-a',
          },
        ],
      },
    }));
  }

  it('detects whether the selected provider is already bound on the current OneKey ID', async () => {
    const { service } = createService();
    mockProfile(service);

    await expect(
      service.isOAuthProviderBoundToCurrentOneKeyId({
        provider: EOAuthSocialLoginProvider.Google,
      }),
    ).resolves.toBe(true);
    await expect(
      service.isOAuthProviderBoundToCurrentOneKeyId({
        provider: EOAuthSocialLoginProvider.Apple,
      }),
    ).resolves.toBe(false);
  });

  it('matches only the exact provider subject selected during OAuth reauthentication', async () => {
    const { service } = createService();
    mockProfile(service);

    await expect(
      service.isOAuthIdentityBoundToCurrentOneKeyId({
        oauthAccessToken: buildFakeJwt({
          user_metadata: { sub: 'google-sub-a' },
        }),
        provider: EOAuthSocialLoginProvider.Google,
      }),
    ).resolves.toBe(true);
    await expect(
      service.isOAuthIdentityBoundToCurrentOneKeyId({
        oauthAccessToken: buildFakeJwt({
          user_metadata: { sub: 'different-google-sub' },
        }),
        provider: EOAuthSocialLoginProvider.Google,
      }),
    ).resolves.toBe(false);
    await expect(
      service.isOAuthIdentityBoundToCurrentOneKeyId({
        oauthAccessToken: buildFakeJwt({}),
        provider: EOAuthSocialLoginProvider.Google,
      }),
    ).resolves.toBe(false);
  });
});

describe('ServicePrime.apiOAuthLogin keyless slot identity guard', () => {
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrimePersistAtom.get.mockResolvedValue({});
    mockReadPersistedAccessTokenBySessionSourceStrict.mockReset();
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: buildFakeJwt({ sub: 'user-a' }),
    });
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

describe('ServicePrime.persistKeylessOAuthSession active OneKey ID guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadPersistedAccessTokenBySessionSourceStrict.mockReset();
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    mockPersistKeylessAuthSession.mockImplementation(
      async (params: unknown) => {
        const { accessToken } = params as { accessToken: string };
        mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
          status: 'ok',
          accessToken,
        });
      },
    );
  });

  afterEach(() => {
    resetIdentityRecoveryStateForTest('ready');
  });

  it('rejects a different account before replacing a KeylessOAuth-backed OneKey ID slot', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValueOnce({
      status: 'ok',
      accessToken: buildFakeJwt({ sub: 'user-a' }),
    });

    const persistence = service.persistKeylessOAuthSession({
      accessToken: buildFakeJwt({ sub: 'user-b' }),
      refreshToken: 'refresh-b',
    });

    await expect(persistence).rejects.toBeInstanceOf(
      OneKeyErrorOneKeyIdKeylessSessionSlotReplaced,
    );
    expect(mockPersistKeylessAuthSession).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.setKeylessOAuthSessionPersistenceJournal,
    ).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.commitKeylessOAuthSessionPersistenceMetadata,
    ).not.toHaveBeenCalled();
  });

  it('allows token rotation for the same KeylessOAuth-backed OneKey ID identity', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValueOnce({
      status: 'ok',
      accessToken: buildFakeJwt({ sub: 'user-a', iat: 1 }),
    });
    const nextAccessToken = buildFakeJwt({ sub: 'user-a', iat: 2 });

    await service.persistKeylessOAuthSession({
      accessToken: nextAccessToken,
      refreshToken: 'refresh-a',
    });

    expect(mockPersistKeylessAuthSession).toHaveBeenCalledWith({
      accessToken: nextAccessToken,
      refreshToken: 'refresh-a',
    });
    expect(
      simpleDbPrime.setKeylessOAuthSessionPersistenceJournal,
    ).toHaveBeenCalled();
    expect(
      simpleDbPrime.commitKeylessOAuthSessionPersistenceMetadata,
    ).toHaveBeenCalled();
  });

  it('allows an independent Keyless session beside an Email OneKey ID', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    const accessToken = buildFakeJwt({ sub: 'independent-keyless-user' });

    await service.persistKeylessOAuthSession({
      accessToken,
      refreshToken: 'refresh-independent',
    });

    expect(mockPersistKeylessAuthSession).toHaveBeenCalledWith({
      accessToken,
      refreshToken: 'refresh-independent',
    });
    expect(
      simpleDbPrime.setKeylessOAuthSessionPersistenceJournal,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionTokenSub: 'independent-keyless-user',
        supabaseSessionId: 'supabase-session:independent-keyless-user',
      }),
    );
    expect(
      simpleDbPrime.commitKeylessOAuthSessionPersistenceMetadata,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        persistedSessionIdentity: {
          sessionTokenSub: 'independent-keyless-user',
          supabaseSessionId: 'supabase-session:independent-keyless-user',
        },
      }),
    );
  });

  it('fails closed before journaling when the token session_id claim is missing', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');

    await expect(
      service.persistKeylessOAuthSession({
        accessToken: buildFakeJwt({
          sub: 'independent-keyless-user',
          session_id: undefined,
        }),
        refreshToken: 'refresh-independent',
      }),
    ).rejects.toThrow('token session_id claim is missing');

    expect(
      simpleDbPrime.setKeylessOAuthSessionPersistenceJournal,
    ).not.toHaveBeenCalled();
    expect(mockPersistKeylessAuthSession).not.toHaveBeenCalled();
  });

  it('keeps the identity gate closed when the journal storage write rejects', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    const storageError = new Error('journal storage write failed');
    simpleDbPrime.setKeylessOAuthSessionPersistenceJournal.mockRejectedValue(
      storageError,
    );

    await expect(
      service.persistKeylessOAuthSession({
        accessToken: buildFakeJwt({ sub: 'independent-keyless-user' }),
        refreshToken: 'refresh-independent',
      }),
    ).rejects.toBe(storageError);

    expect(isIdentityRecoveryReady()).toBe(false);
    expect(mockPersistKeylessAuthSession).not.toHaveBeenCalled();
  });

  it('does not trust the current cache when the metadata commit write rejects', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    const storageError = new Error('metadata storage write failed');
    simpleDbPrime.commitKeylessOAuthSessionPersistenceMetadata.mockRejectedValue(
      storageError,
    );

    await expect(
      service.persistKeylessOAuthSession({
        accessToken: buildFakeJwt({ sub: 'independent-keyless-user' }),
        refreshToken: 'refresh-independent',
      }),
    ).rejects.toBe(storageError);

    expect(isIdentityRecoveryReady()).toBe(false);
    expect(
      simpleDbPrime.getKeylessOAuthSessionPersistenceJournal,
    ).not.toHaveBeenCalled();
  });
});

describe('ServicePrime provisional Keyless OAuth session rollback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadPersistedAccessTokenBySessionSourceStrict.mockReset();
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    mockPersistKeylessAuthSession.mockImplementation(
      async (params: unknown) => {
        const { accessToken } = params as { accessToken: string };
        mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
          status: 'ok',
          accessToken,
        });
      },
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    resetIdentityRecoveryStateForTest('ready');
  });

  it('expires an unused rollback handle after five minutes', async () => {
    jest.useFakeTimers();
    const { service, simpleDbPrime } = createService();
    const accessToken = buildFakeJwt({ sub: 'independent-keyless-user' });
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    simpleDbPrime.getIdentityLifecycleRevision.mockResolvedValue(1);

    const { rollbackHandle } = await service.persistKeylessOAuthSession({
      accessToken,
      refreshToken: 'refresh-independent',
    });
    const persistenceJournal =
      simpleDbPrime.setKeylessOAuthSessionPersistenceJournal.mock.calls[0][0];
    simpleDbPrime.getAuthSessionCommitId.mockResolvedValue(
      persistenceJournal.sessionCommitId,
    );

    jest.advanceTimersByTime(5 * 60 * 1000);

    await expect(
      service.rollbackProvisionalKeylessOAuthSession({ rollbackHandle }),
    ).resolves.toEqual({ cleared: false });
    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();
  });

  it('uses a rollback handle once before expiry and cancels its timer', async () => {
    jest.useFakeTimers();
    const { service, simpleDbPrime } = createService();
    const accessToken = buildFakeJwt({ sub: 'independent-keyless-user' });
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    simpleDbPrime.getIdentityLifecycleRevision.mockResolvedValue(1);

    const { rollbackHandle } = await service.persistKeylessOAuthSession({
      accessToken,
      refreshToken: 'refresh-independent',
    });
    const persistenceJournal =
      simpleDbPrime.setKeylessOAuthSessionPersistenceJournal.mock.calls[0][0];
    simpleDbPrime.getAuthSessionCommitId.mockResolvedValue(
      persistenceJournal.sessionCommitId,
    );

    jest.advanceTimersByTime(5 * 60 * 1000 - 1);

    await expect(
      service.rollbackProvisionalKeylessOAuthSession({ rollbackHandle }),
    ).resolves.toEqual({ cleared: true });
    expect(mockRemoveAuthSessionStorageBySessionSource).toHaveBeenCalledTimes(
      1,
    );

    jest.advanceTimersByTime(1);

    await expect(
      service.rollbackProvisionalKeylessOAuthSession({ rollbackHandle }),
    ).resolves.toEqual({ cleared: false });
    expect(mockRemoveAuthSessionStorageBySessionSource).toHaveBeenCalledTimes(
      1,
    );
  });

  it('rejects an expired rollback handle when its timer is delayed', async () => {
    jest.useFakeTimers();
    const { service, simpleDbPrime } = createService();
    const accessToken = buildFakeJwt({ sub: 'independent-keyless-user' });
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    simpleDbPrime.getIdentityLifecycleRevision.mockResolvedValue(1);

    const { rollbackHandle } = await service.persistKeylessOAuthSession({
      accessToken,
      refreshToken: 'refresh-independent',
    });
    const persistenceJournal =
      simpleDbPrime.setKeylessOAuthSessionPersistenceJournal.mock.calls[0][0];
    simpleDbPrime.getAuthSessionCommitId.mockResolvedValue(
      persistenceJournal.sessionCommitId,
    );

    jest.setSystemTime(Date.now() + 5 * 60 * 1000);

    await expect(
      service.rollbackProvisionalKeylessOAuthSession({ rollbackHandle }),
    ).resolves.toEqual({ cleared: false });
    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();
  });

  it('does not let an old timer delete a newer record with the same handle', async () => {
    jest.useFakeTimers();
    const generateUUIDSpy = jest
      .spyOn(stringUtils, 'generateUUID')
      .mockReturnValueOnce('session-commit-1')
      .mockReturnValueOnce('operation-1')
      .mockReturnValueOnce('reused-rollback-handle')
      .mockReturnValueOnce('session-commit-2')
      .mockReturnValueOnce('operation-2')
      .mockReturnValueOnce('reused-rollback-handle');
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    simpleDbPrime.getIdentityLifecycleRevision.mockResolvedValue(1);

    try {
      const firstPersist = await service.persistKeylessOAuthSession({
        accessToken: buildFakeJwt({ sub: 'independent-keyless-user' }),
        refreshToken: 'refresh-independent-1',
      });
      const firstJournal =
        simpleDbPrime.setKeylessOAuthSessionPersistenceJournal.mock.calls[0][0];
      simpleDbPrime.getAuthSessionCommitId.mockResolvedValue(
        firstJournal.sessionCommitId,
      );

      jest.advanceTimersByTime(60 * 1000);

      const secondPersist = await service.persistKeylessOAuthSession({
        accessToken: buildFakeJwt({ sub: 'independent-keyless-user' }),
        refreshToken: 'refresh-independent-2',
      });
      expect(secondPersist.rollbackHandle).toBe(firstPersist.rollbackHandle);
      const secondJournal =
        simpleDbPrime.setKeylessOAuthSessionPersistenceJournal.mock.calls[1][0];
      simpleDbPrime.getAuthSessionCommitId.mockResolvedValue(
        secondJournal.sessionCommitId,
      );

      jest.advanceTimersByTime(4 * 60 * 1000);

      await expect(
        service.rollbackProvisionalKeylessOAuthSession({
          rollbackHandle: secondPersist.rollbackHandle,
        }),
      ).resolves.toEqual({ cleared: true });
      expect(mockRemoveAuthSessionStorageBySessionSource).toHaveBeenCalledTimes(
        1,
      );
    } finally {
      generateUUIDSpy.mockRestore();
    }
  });
});

describe('ServicePrime Keyless OAuth persistence recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrimePersistAtom.get.mockResolvedValue({});
    mockReadPersistedAccessTokenBySessionSourceStrict.mockReset();
  });

  it('finishes atomic metadata when the exact journaled session is persisted', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getKeylessOAuthSessionPersistenceJournal.mockResolvedValue({
      operationId: 'operation-1',
      status: 'prepared',
      startedAt: 1,
      updatedAt: 1,
      expectedLifecycleRevision: 5,
      sessionCommitId: 'commit-1',
      sessionTokenSub: 'user-a',
      supabaseSessionId: 'supabase-session:user-a',
    });
    simpleDbPrime.commitKeylessOAuthSessionPersistenceMetadata.mockResolvedValue(
      {
        status: 'committed',
        identityLifecycleRevision: 6,
      },
    );
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: buildFakeJwt({ sub: 'user-a' }),
    });

    await expect(
      service.recoverInterruptedKeylessOAuthSessionPersistence(),
    ).resolves.toEqual({ recovered: true, abandoned: false });
    expect(
      simpleDbPrime.commitKeylessOAuthSessionPersistenceMetadata,
    ).toHaveBeenCalledWith({
      operationId: 'operation-1',
      persistedSessionIdentity: {
        sessionTokenSub: 'user-a',
        supabaseSessionId: 'supabase-session:user-a',
      },
    });
  });

  it('abandons only the journal when a different session won the slot', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getKeylessOAuthSessionPersistenceJournal.mockResolvedValue({
      operationId: 'operation-1',
      status: 'prepared',
      startedAt: 1,
      updatedAt: 1,
      expectedLifecycleRevision: 5,
      sessionCommitId: 'commit-1',
      sessionTokenSub: 'user-a',
      supabaseSessionId: 'supabase-session:user-a',
    });
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: buildFakeJwt({ sub: 'user-b' }),
    });

    await expect(
      service.recoverInterruptedKeylessOAuthSessionPersistence(),
    ).resolves.toEqual({ recovered: false, abandoned: true });
    expect(
      simpleDbPrime.removeKeylessOAuthSessionPersistenceJournal,
    ).toHaveBeenCalledWith({ operationId: 'operation-1' });
    expect(
      simpleDbPrime.commitKeylessOAuthSessionPersistenceMetadata,
    ).not.toHaveBeenCalled();
    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();
  });

  it('abandons a crash-before-setSession journal when the old slot has the same subject', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getKeylessOAuthSessionPersistenceJournal.mockResolvedValue({
      operationId: 'operation-1',
      status: 'prepared',
      startedAt: 1,
      updatedAt: 1,
      expectedLifecycleRevision: 5,
      sessionCommitId: 'commit-new',
      sessionTokenSub: 'user-a',
      supabaseSessionId: 'supabase-session-new',
    });
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: buildFakeJwt({
        sub: 'user-a',
        session_id: 'supabase-session-old',
      }),
    });

    await expect(
      service.recoverInterruptedKeylessOAuthSessionPersistence(),
    ).resolves.toEqual({ recovered: false, abandoned: true });
    expect(
      simpleDbPrime.removeKeylessOAuthSessionPersistenceJournal,
    ).toHaveBeenCalledWith({ operationId: 'operation-1' });
    expect(
      simpleDbPrime.commitKeylessOAuthSessionPersistenceMetadata,
    ).not.toHaveBeenCalled();
    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();
  });

  it('abandons recovery when the persisted slot has no session_id claim', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getKeylessOAuthSessionPersistenceJournal.mockResolvedValue({
      operationId: 'operation-1',
      status: 'prepared',
      startedAt: 1,
      updatedAt: 1,
      expectedLifecycleRevision: 5,
      sessionCommitId: 'commit-new',
      sessionTokenSub: 'user-a',
      supabaseSessionId: 'supabase-session-new',
    });
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: buildFakeJwt({ sub: 'user-a', session_id: undefined }),
    });

    await expect(
      service.recoverInterruptedKeylessOAuthSessionPersistence(),
    ).resolves.toEqual({ recovered: false, abandoned: true });
    expect(
      simpleDbPrime.commitKeylessOAuthSessionPersistenceMetadata,
    ).not.toHaveBeenCalled();
  });
});

describe('ServicePrime.apiOAuthLoginWithFreshSessionForLoggedOutState', () => {
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrimePersistAtom.get.mockResolvedValue({});
    mockPersistKeylessAuthSession.mockImplementation(
      async (params: unknown) => {
        const { accessToken } = params as { accessToken: string };
        mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
          status: 'ok',
          accessToken,
        });
      },
    );
    mockReadPersistedAccessTokenBySessionSourceStrict.mockReset();
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: buildFakeJwt({
        sub: 'user-a',
        session_id: 'supabase-session-old',
      }),
    });
    emitSpy = jest.spyOn(appEventBus, 'emit').mockImplementation(() => true);
  });

  afterEach(() => {
    emitSpy.mockRestore();
  });

  function mockFreshOAuthLoginClient({
    service,
    post,
  }: {
    service: any;
    post: jest.Mock;
  }) {
    service.getPrimeClient = jest.fn(async () => ({ post }));
  }

  it('rechecks the logged-out precondition after waiting for loginMutex', async () => {
    const { service, simpleDbPrime } = createService();
    let isAnotherLoginCommitted = false;
    mockPrimePersistAtom.get.mockImplementation(async () =>
      isAnotherLoginCommitted
        ? { isLoggedIn: true, isLoggedInOnServer: true }
        : {},
    );
    simpleDbPrime.getActiveAuthToken.mockImplementation(async () =>
      isAnotherLoginCommitted ? 'current-login-token' : '',
    );
    const lockAcquired = createDeferred();
    const releaseLock = createDeferred();
    const lockHolder = service.loginMutex.runExclusive(async () => {
      lockAcquired.resolve();
      await releaseLock.promise;
    });
    await lockAcquired.promise;

    const loginPromise = service.apiOAuthLoginWithFreshSessionForLoggedOutState(
      {
        accessToken: buildFakeJwt({ sub: 'user-a' }),
        refreshToken: 'refresh-a',
      },
    );
    await flushAsync(1);
    expect(mockPersistKeylessAuthSession).not.toHaveBeenCalled();

    isAnotherLoginCommitted = true;
    releaseLock.resolve();
    await lockHolder;

    await expect(loginPromise).rejects.toThrow('login state changed');
    expect(mockPersistKeylessAuthSession).not.toHaveBeenCalled();
  });

  it('does not persist or post when a local Keyless wallet already exists', async () => {
    const { service, backgroundApi } = createService();
    const post = jest.fn();
    mockFreshOAuthLoginClient({ service, post });
    backgroundApi.serviceAccount.getKeylessWallet.mockResolvedValue({
      id: 'local-keyless-wallet',
    });

    await expect(
      service.apiOAuthLoginWithFreshSessionForLoggedOutState({
        accessToken: buildFakeJwt({ sub: 'user-a' }),
        refreshToken: 'refresh-a',
      }),
    ).rejects.toThrow('local Keyless wallet now exists');

    expect(mockPersistKeylessAuthSession).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();
  });

  it('keeps the session without posting when a Keyless wallet appears during persistence', async () => {
    const { service, backgroundApi } = createService();
    const accessToken = buildFakeJwt({ sub: 'user-a' });
    const post = jest.fn();
    mockFreshOAuthLoginClient({ service, post });
    backgroundApi.serviceAccount.getKeylessWallet
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 'local-keyless-wallet' });
    await expect(
      service.apiOAuthLoginWithFreshSessionForLoggedOutState({
        accessToken,
        refreshToken: 'refresh-a',
      }),
    ).rejects.toThrow('local Keyless wallet now exists');

    expect(mockPersistKeylessAuthSession).toHaveBeenCalledWith({
      accessToken,
      refreshToken: 'refresh-a',
    });
    expect(post).not.toHaveBeenCalled();
    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();
    expect(mockRevokeAuthSessionTokenOnServerBestEffort).not.toHaveBeenCalled();
    expect(backgroundApi.serviceAccount.getKeylessWallet).toHaveBeenCalledTimes(
      3,
    );
  });

  it('preserves the session slot when setSession fails transiently', async () => {
    const { service } = createService();
    const post = jest.fn();
    mockFreshOAuthLoginClient({ service, post });
    const setSessionError = new OneKeyLocalError({
      message: 'setSession temporarily unavailable',
      httpStatusCode: 503,
    });
    mockPersistKeylessAuthSession.mockRejectedValueOnce(setSessionError);

    await expect(
      service.apiOAuthLoginWithFreshSessionForLoggedOutState({
        accessToken: buildFakeJwt({ sub: 'user-a' }),
        refreshToken: 'refresh-a',
      }),
    ).rejects.toBe(setSessionError);

    expect(post).not.toHaveBeenCalled();
    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();
    expect(mockRevokeAuthSessionTokenOnServerBestEffort).not.toHaveBeenCalled();
  });

  it('persists and commits the fresh session under the serialized login flow', async () => {
    const { service } = createService();
    const accessToken = buildFakeJwt({ sub: 'user-a' });
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
    mockFreshOAuthLoginClient({ service, post });

    await service.apiOAuthLoginWithFreshSessionForLoggedOutState({
      accessToken,
      refreshToken: 'refresh-a',
    });

    expect(mockPersistKeylessAuthSession).toHaveBeenCalledWith({
      accessToken,
      refreshToken: 'refresh-a',
    });
    expect(post).toHaveBeenCalled();
  });

  it('keeps the uncommitted session and logged-out state after a definitive POST failure', async () => {
    const { service, simpleDbPrime } = createService();
    const accessToken = buildFakeJwt({ sub: 'user-a' });
    const loginError = Object.assign(new Error('rejected'), {
      httpStatusCode: 401,
    });
    const post = jest.fn(async () => Promise.reject(loginError));
    mockFreshOAuthLoginClient({ service, post });
    await expect(
      service.apiOAuthLoginWithFreshSessionForLoggedOutState({
        accessToken,
        refreshToken: 'refresh-a',
      }),
    ).rejects.toBe(loginError);

    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();
    expect(mockRevokeAuthSessionTokenOnServerBestEffort).not.toHaveBeenCalled();
    expect(simpleDbPrime.setAuthSessionSource).not.toHaveBeenCalled();
    expect(mockPrimePersistAtom.set).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.KeylessAuthSessionCleared,
      undefined,
    );
  });

  it('does not clear a replacement session after a slot-replacement failure', async () => {
    const { service } = createService();
    const attemptedToken = buildFakeJwt({ sub: 'user-a', iat: 1 });
    const replacementToken = buildFakeJwt({ sub: 'user-a', iat: 2 });
    const loginError = Object.assign(new Error('rejected'), {
      httpStatusCode: 401,
    });
    const post = jest.fn(async () => Promise.reject(loginError));
    mockFreshOAuthLoginClient({ service, post });
    mockReadPersistedAccessTokenBySessionSourceStrict
      .mockResolvedValueOnce({ status: 'ok', accessToken: attemptedToken })
      .mockResolvedValueOnce({ status: 'ok', accessToken: replacementToken });

    await expect(
      service.apiOAuthLoginWithFreshSessionForLoggedOutState({
        accessToken: attemptedToken,
        refreshToken: 'refresh-a',
      }),
    ).rejects.toBe(loginError);

    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();
    expect(mockRevokeAuthSessionTokenOnServerBestEffort).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.KeylessAuthSessionCleared,
      undefined,
    );
  });

  it.each([
    {
      name: 'transient failure',
      error: Object.assign(new Error('temporary'), { httpStatusCode: 500 }),
      slotToken: buildFakeJwt({ sub: 'user-a' }),
    },
    {
      name: 'slot replacement',
      error: undefined,
      slotToken: buildFakeJwt({ sub: 'user-b' }),
    },
  ])('preserves the session on $name', async ({ error, slotToken }) => {
    const { service } = createService();
    const attemptedToken = buildFakeJwt({ sub: 'user-a' });
    const post = jest.fn(async () => {
      if (error) {
        throw error;
      }
      return { data: { data: undefined } };
    });
    mockFreshOAuthLoginClient({ service, post });
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: slotToken,
    });

    await expect(
      service.apiOAuthLoginWithFreshSessionForLoggedOutState({
        accessToken: attemptedToken,
        refreshToken: 'refresh-a',
      }),
    ).rejects.toBeDefined();

    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();
    expect(mockRevokeAuthSessionTokenOnServerBestEffort).not.toHaveBeenCalled();
  });
});
