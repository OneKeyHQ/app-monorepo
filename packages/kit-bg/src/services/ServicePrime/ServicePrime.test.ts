/* cspell:ignore Infini */
/* eslint-disable import/first, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-var-requires */

import type {
  IKeylessOAuthSessionPersistenceJournal,
  IKeylessOAuthSessionPersistenceJournalPreparation,
  SimpleDbEntityPrime,
} from '../../dbs/simple/entity/SimpleDbEntityPrime';

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
const mockOneKeyIdRemoteLogoutFlowLog = jest.fn();
const mockOneKeyIdAuthStateMigrationLog = jest.fn();
const mockOneKeyIdAuthStateRepairLog = jest.fn();
const mockOneKeyIdLoginFailedReasonLog = jest.fn();
const mockToastIfErrorMethods = new Set<string>();

const VALID_DEV_ONLY_PASSWORD = 'valid-dev-only-password';

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
  // Mirrors the real guard: throws unless the caller passes the devOnlyPassword.
  // The literal is inlined because a jest.mock factory cannot read outer scope.
  checkDevOnlyPassword: (
    params: { $$devOnlyPassword?: string } | undefined,
    methodName?: string,
  ) => {
    if (params?.$$devOnlyPassword !== 'valid-dev-only-password') {
      const { OneKeyLocalError } = require('@onekeyhq/shared/src/errors');
      throw new OneKeyLocalError(
        `You are not allowed to call this method, devOnlyPassword is wrong. method=${
          methodName || ''
        }`,
      );
    }
  },
  toastIfError:
    () =>
    (_target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => {
      mockToastIfErrorMethods.add(propertyKey);
      return descriptor;
    },
}));

jest.mock('@onekeyhq/core/src/secret', () => ({
  ensureSensitiveTextEncoded: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  function createLoggerProxy(path: string[] = []): any {
    return new Proxy(jest.fn(), {
      get: (_target, property: string | symbol) => {
        const nextPath = [...path, String(property)];
        const loggerMethod = nextPath.join('.');
        if (loggerMethod === 'prime.subscription.onekeyIdRemoteLogoutFlow') {
          return mockOneKeyIdRemoteLogoutFlowLog;
        }
        if (loggerMethod === 'prime.subscription.onekeyIdAuthStateMigration') {
          return mockOneKeyIdAuthStateMigrationLog;
        }
        if (loggerMethod === 'prime.subscription.onekeyIdAuthStateRepair') {
          return mockOneKeyIdAuthStateRepairLog;
        }
        if (loggerMethod === 'prime.subscription.onekeyIdLoginFailedReason') {
          return mockOneKeyIdLoginFailedReasonLog;
        }
        return createLoggerProxy(nextPath);
      },
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
const mockGetAuthTokenBySessionSource = jest.fn(async (source: unknown) => {
  const slot = (await mockReadPersistedAccessTokenBySessionSourceStrict(
    source,
  )) as { status: 'ok'; accessToken: string } | { status: 'empty' | 'corrupt' };
  return slot.status === 'ok' ? slot.accessToken : '';
});
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
  getAuthTokenBySessionSource: (source: unknown) =>
    mockGetAuthTokenBySessionSource(source),
  getSupabaseClientBySessionSource: async () => ({
    auth: {
      verifyOtp: mockVerifyEmailOtp,
    },
  }),
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
  getActiveIdentityLifecycleOperationId,
  identityLifecycleMutex,
  isIdentityRecoveryReady,
  markIdentityRecoveryReady,
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
      Promise<IKeylessOAuthSessionPersistenceJournal>,
      [IKeylessOAuthSessionPersistenceJournalPreparation]
    >(async (preparation) => ({
      ...preparation,
      expectedLifecycleRevision: 0,
    })),
    commitKeylessOAuthSessionPersistenceMetadata: jest.fn<
      ReturnType<
        SimpleDbEntityPrime['commitKeylessOAuthSessionPersistenceMetadata']
      >,
      Parameters<
        SimpleDbEntityPrime['commitKeylessOAuthSessionPersistenceMetadata']
      >
    >(async () => ({
      status: 'committed',
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
    markOneKeyIdLoggedOutPreservingSessions: jest.fn(async () => undefined),
    clearAuthSessionCommitIdIfMatches: jest.fn(async () => true),
    clearKeylessSessionCommitIdIfMatches: jest.fn(async () => true),
    clearKeylessAuthSession: jest.fn(async () => undefined),
    clearLegacyAuthSession: jest.fn(async () => undefined),
    clearLocalAuthSession: jest.fn(async () => undefined),
    isAllIdentityAuthMetadataCleared: jest.fn(async () => false),
    clearAllIdentityAuthMetadataAndBumpRevision: jest.fn(async () => 1),
    hasShownOneKeyIdOAuthBindPrompt: jest.fn(async () => false),
    getOneKeyIdOAuthBindPromptUpgradeState: jest.fn(async () => ({
      hasShown: false,
      credentialUpgradeCompleted: false,
      identityLifecycleRevision: 0,
    })),
    markOneKeyIdKeylessCredentialUpgradeCompleted: jest.fn(async () => true),
    markOneKeyIdOAuthBindPromptShown: jest.fn(async () => undefined),
    tryClaimOneKeyIdOAuthBindPrompt: jest.fn(async () => true),
    completeOneKeyIdOAuthBindPromptClaim: jest.fn(async () => true),
    releaseOneKeyIdOAuthBindPromptClaim: jest.fn(async () => true),
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
      cleanupKeylessWalletCredentialStorage: jest.fn(async () => undefined),
      ensureKeylessCredentialReadyForOneKeyIdBind: jest.fn(async () => ({
        status: 'noLocalKeyless' as const,
        hasLocalKeylessWallet: false as const,
      })),
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

function setupV650LoggedOutProjectionWithStaleLegacySession(
  simpleDbPrime: ReturnType<typeof createService>['simpleDbPrime'],
) {
  let authSessionSource:
    | typeof EPrimeAuthSessionSource.LegacyEmailSupabase
    | undefined;
  let oneKeyIdAuthState: 'loggedIn' | 'loggedOut' | undefined;
  let identityLifecycleRevision = 0;
  let didRestoreLegacySession = false;
  mockPrimePersistAtom.get.mockResolvedValue({
    isLoggedIn: false,
    isLoggedInOnServer: false,
    onekeyUserId: undefined,
  });
  simpleDbPrime.getAuthSessionSource.mockImplementation(
    async () => authSessionSource,
  );
  simpleDbPrime.getEffectiveAuthSessionSource.mockImplementation(async () => {
    if (oneKeyIdAuthState === 'loggedOut') {
      return undefined;
    }
    didRestoreLegacySession = true;
    authSessionSource = EPrimeAuthSessionSource.LegacyEmailSupabase;
    oneKeyIdAuthState = 'loggedIn';
    return authSessionSource;
  });
  simpleDbPrime.getOneKeyIdAuthState.mockImplementation(
    async () => oneKeyIdAuthState,
  );
  simpleDbPrime.getAuthStateGeneration.mockResolvedValue(0);
  simpleDbPrime.getIdentityLifecycleRevision.mockImplementation(
    async () => identityLifecycleRevision,
  );
  simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions.mockImplementation(
    async () => {
      authSessionSource = undefined;
      oneKeyIdAuthState = 'loggedOut';
    },
  );
  simpleDbPrime.bumpIdentityLifecycleRevision.mockImplementation(async () => {
    identityLifecycleRevision += 1;
    return identityLifecycleRevision;
  });
  return {
    getAuthSessionSource: () => authSessionSource,
    getOneKeyIdAuthState: () => oneKeyIdAuthState,
    didRestoreLegacySession: () => didRestoreLegacySession,
  };
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

describe('ServicePrime.apiFetchPrimeUserInfo', () => {
  it('refreshes an expired legacy access token through the SDK before profile recovery', async () => {
    jest.clearAllMocks();
    const { service, backgroundApi, simpleDbPrime } = createService();
    const expiredAccessToken = buildFakeJwt({
      sub: 'legacy-auth-user-a',
      exp: 1,
    });
    const refreshedAccessToken = buildFakeJwt({
      sub: 'legacy-auth-user-a',
      exp: 4_102_444_800,
    });
    const onekeyAccount = {
      onekeyUserId: 'onekey-user-a',
      status: EOneKeyIdAccountStatus.Active,
      identities: [
        {
          identityType: EOneKeyIdIdentityType.LegacyEmail,
          legacyEmail: 'user-a@example.com',
        },
      ],
    };
    let authSessionSource:
      | typeof EPrimeAuthSessionSource.LegacyEmailSupabase
      | undefined;
    let oneKeyIdAuthState: 'loggedIn' | 'loggedOut' | undefined;
    const userInfo = {
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    };
    backgroundApi.serviceAccount.getKeylessWallet.mockResolvedValue({
      id: 'hd-keyless-a',
    });
    simpleDbPrime.getKeylessSupabaseAuthToken.mockResolvedValue(
      buildFakeJwt({ sub: 'keyless-auth-user-a' }),
    );
    simpleDbPrime.getAuthSessionSource.mockImplementation(
      async () => authSessionSource,
    );
    simpleDbPrime.getEffectiveAuthSessionSource.mockImplementation(
      async () => authSessionSource,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockImplementation(
      async () => oneKeyIdAuthState,
    );
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(0);
    simpleDbPrime.getIdentityLifecycleRevision.mockResolvedValue(0);
    simpleDbPrime.getActiveAuthToken.mockImplementation(async () =>
      authSessionSource === EPrimeAuthSessionSource.LegacyEmailSupabase
        ? refreshedAccessToken
        : '',
    );
    simpleDbPrime.setAuthSessionSourceWithCommitId.mockImplementation(
      async (...args: unknown[]) => {
        const [{ authSessionSource: nextAuthSessionSource }] = args as [
          {
            authSessionSource: typeof EPrimeAuthSessionSource.LegacyEmailSupabase;
          },
        ];
        authSessionSource = nextAuthSessionSource;
        oneKeyIdAuthState = 'loggedIn';
      },
    );
    mockReadPersistedAccessTokenBySessionSourceStrict
      .mockResolvedValueOnce({
        status: 'ok',
        accessToken: expiredAccessToken,
      })
      .mockResolvedValue({
        status: 'ok',
        accessToken: refreshedAccessToken,
      });
    mockGetAuthTokenBySessionSource.mockResolvedValueOnce(refreshedAccessToken);
    mockPrimePersistAtom.get.mockImplementation(async () => userInfo);
    const serverUserInfo = {
      userId: 'onekey-user-a',
      onekeyAccount,
    };
    const get = jest.fn(async (_url: string, config: unknown) => {
      const requestToken = (
        config as { headers?: { 'X-Onekey-Request-Token'?: string } }
      ).headers?.['X-Onekey-Request-Token'];
      if (requestToken !== refreshedAccessToken) {
        throw new OneKeyErrorPrimeLoginInvalidToken({
          message: 'expired access token',
          code: 90_002,
        });
      }
      return {
        status: 200,
        data: { code: 0, data: serverUserInfo },
      };
    });
    service.getPrimeClient = jest.fn(async () => ({ get }));

    await expect(
      service.apiFetchPrimeUserInfo({ forceRefresh: true }),
    ).resolves.toMatchObject({
      userInfo: {
        isLoggedIn: true,
        isLoggedInOnServer: true,
        onekeyUserId: 'onekey-user-a',
      },
      serverUserInfo: {
        userId: 'onekey-user-a',
      },
    });

    expect(mockGetAuthTokenBySessionSource).toHaveBeenCalledWith(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    expect(get).toHaveBeenCalledWith(
      '/prime/v1/account/profile',
      expect.objectContaining({
        headers: { 'X-Onekey-Request-Token': refreshedAccessToken },
      }),
    );
    expect(
      backgroundApi.serviceIdentityExit.reconcileMissingOneKeyIdSession,
    ).not.toHaveBeenCalled();
    expect(simpleDbPrime.getKeylessSupabaseAuthToken).not.toHaveBeenCalled();
  });

  it('treats a logged-out tombstone as authoritative instead of recovering a legacy session', async () => {
    jest.clearAllMocks();
    const { service, backgroundApi, simpleDbPrime } = createService();
    const legacyAccessToken = buildFakeJwt({ sub: 'legacy-auth-user-a' });
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedOut');
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(0);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: legacyAccessToken,
    });
    const get = jest.fn();
    service.getPrimeClient = jest.fn(async () => ({ get }));

    await expect(
      service.clearOneKeyIdAuthStateIfNoActiveToken({ callerName: 'test' }),
    ).resolves.toEqual({ cleared: true });

    expect(get).not.toHaveBeenCalled();
    expect(mockGetAuthTokenBySessionSource).not.toHaveBeenCalled();
    expect(
      mockReadPersistedAccessTokenBySessionSourceStrict,
    ).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.setAuthSessionSourceWithCommitId,
    ).not.toHaveBeenCalled();
    expect(
      backgroundApi.serviceIdentityExit.reconcileMissingOneKeyIdSession,
    ).not.toHaveBeenCalled();
    expect(mockPrimePersistAtom.set).toHaveBeenCalledWith(expect.any(Function));
  });

  it('does not clear a new login that commits after the tombstone probe', async () => {
    jest.clearAllMocks();
    const { service, backgroundApi, simpleDbPrime } = createService();
    const authState: {
      authSessionSource?: typeof EPrimeAuthSessionSource.LegacyEmailSupabase;
      oneKeyIdAuthState: 'loggedIn' | 'loggedOut';
    } = { oneKeyIdAuthState: 'loggedOut' };
    const initialProbeCompleted = createDeferred();
    let initialProbeReadCount = 0;
    const markInitialProbeRead = () => {
      initialProbeReadCount += 1;
      if (initialProbeReadCount === 2) {
        initialProbeCompleted.resolve();
      }
    };
    simpleDbPrime.getAuthSessionSource.mockImplementation(async () => {
      markInitialProbeRead();
      return authState.authSessionSource;
    });
    simpleDbPrime.getEffectiveAuthSessionSource.mockImplementation(
      async () => authState.authSessionSource,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockImplementation(async () => {
      markInitialProbeRead();
      return authState.oneKeyIdAuthState;
    });
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'new-onekey-user',
    });
    backgroundApi.serviceIdentityExit.reconcileMissingOneKeyIdSession.mockResolvedValue(
      { cleared: false },
    );

    const authCommitEntered = createDeferred();
    const releaseAuthCommit = createDeferred();
    const activeLoginCommit = (
      service as unknown as {
        authStateWriteMutex: {
          runExclusive: (callback: () => Promise<void>) => Promise<void>;
        };
      }
    ).authStateWriteMutex.runExclusive(async () => {
      authCommitEntered.resolve();
      await releaseAuthCommit.promise;
    });
    await authCommitEntered.promise;

    const clearResult = service.clearOneKeyIdAuthStateIfNoActiveToken({
      callerName: 'test',
    });
    await initialProbeCompleted.promise;
    authState.authSessionSource = EPrimeAuthSessionSource.LegacyEmailSupabase;
    authState.oneKeyIdAuthState = 'loggedIn';
    releaseAuthCommit.resolve();
    await activeLoginCommit;

    await expect(clearResult).resolves.toEqual({ cleared: false });
    expect(mockPrimePersistAtom.set).not.toHaveBeenCalled();
  });

  it('bypasses the short-TTL cache when fresh server truth is required', async () => {
    const { service } = createService();
    const fetchWithCache = Object.assign(
      jest.fn(async () => ({
        userInfo: {},
        serverUserInfo: undefined,
        primeSubscription: undefined,
      })),
      { clear: jest.fn() },
    );
    service._fetchPrimeUserInfoWithCache = fetchWithCache;

    await service.apiFetchPrimeUserInfo({ forceRefresh: true });

    expect(fetchWithCache.clear).toHaveBeenCalledTimes(1);
    expect(fetchWithCache).toHaveBeenCalledTimes(1);
  });
});

describe('ServicePrime.apiLogoutPrimeUserDevice logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs the initiator request and refresh without credential or device data', async () => {
    const { service, simpleDbPrime } = createService();
    const accessToken = 'sensitive-access-token';
    const instanceId = 'sensitive-device-instance';
    const post = jest.fn(async () => ({ $requestId: 'request-1' }));
    simpleDbPrime.getActiveAuthToken.mockResolvedValue(accessToken);
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    service.getPrimeClient = jest.fn(async () => ({ post }));
    service.apiLogin = jest.fn(async () => undefined);
    service.apiFetchPrimeUserInfo = jest.fn(async () => undefined);

    await service.apiLogoutPrimeUserDevice({
      instanceId,
      accessToken: '',
    });

    const flowId = mockOneKeyIdRemoteLogoutFlowLog.mock.calls[0]?.[0]?.flowId;
    expect(flowId).toEqual(
      expect.stringMatching(/^remoteDeviceLogoutInitiator:/),
    );
    expect(mockOneKeyIdRemoteLogoutFlowLog).toHaveBeenCalledWith({
      stage: 'initiatorRequest',
      status: 'started',
      flowId,
    });
    expect(mockOneKeyIdRemoteLogoutFlowLog).toHaveBeenCalledWith({
      stage: 'initiatorRequest',
      status: 'succeeded',
      flowId,
      requestId: 'request-1',
    });
    expect(mockOneKeyIdRemoteLogoutFlowLog).toHaveBeenCalledWith({
      stage: 'initiatorRefresh',
      status: 'succeeded',
      flowId,
    });
    expect(post).toHaveBeenCalledWith(
      `/prime/v1/user/device/${instanceId}`,
      {},
      {
        headers: {
          'X-Onekey-Request-Token': accessToken,
        },
      },
    );
    const serializedLogs = JSON.stringify(
      mockOneKeyIdRemoteLogoutFlowLog.mock.calls,
    );
    expect(serializedLogs).not.toContain(accessToken);
    expect(serializedLogs).not.toContain(instanceId);
  });

  it('logs an initiator request failure before rethrowing it', async () => {
    const { service } = createService();
    const requestError = new OneKeyLocalError('Device logout request failed');
    const post = jest.fn(async () => {
      throw requestError;
    });
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiLogoutPrimeUserDevice({
        instanceId: 'device-a',
        accessToken: 'token-a',
      }),
    ).rejects.toBe(requestError);

    expect(mockOneKeyIdRemoteLogoutFlowLog).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'initiatorRequest',
        status: 'failed',
        reason: expect.stringContaining('Device logout request failed'),
      }),
    );
  });

  it('refreshes a Keyless initiator without re-entering interactive login', async () => {
    const { service, simpleDbPrime } = createService();
    const accessToken = 'keyless-access-token';
    const post = jest.fn(async () => ({ $requestId: 'request-keyless' }));
    const refreshPersistedKeylessSession = jest.fn(async () => undefined);
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    service.getPrimeClient = jest.fn(async () => ({ post }));
    (service as any).apiOAuthLoginWithPersistedSession =
      refreshPersistedKeylessSession;
    service.apiFetchPrimeUserInfo = jest.fn(async () => undefined);

    await expect(
      service.apiLogoutPrimeUserDevice({
        instanceId: 'extension-device',
        accessToken,
      }),
    ).resolves.toBeUndefined();

    expect(refreshPersistedKeylessSession).toHaveBeenCalledWith({
      accessToken,
      callerName: 'ServicePrime.apiLogoutPrimeUserDevice',
      expectedOneKeyUserId: 'onekey-user-a',
    });
  });
});

describe('ServicePrime.apiResetInfiniSubscription', () => {
  const userA = {
    isLoggedIn: true,
    onekeyUserId: 'user-a',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrimePersistAtom.get.mockResolvedValue(userA);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: 'token-a',
    });
  });

  afterEach(() => {
    mockPrimePersistAtom.get.mockImplementation(async () => ({}));
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: 'persisted-access-token',
    });
  });

  function createResetService() {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getActiveAuthToken.mockResolvedValue('token-a');
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(3);
    const post = jest.fn(async () => undefined);
    service.getPrimeClient = jest.fn(async () => ({ post }));
    return { service, simpleDbPrime, post };
  }

  it('pins the confirming user session on the reset request', async () => {
    const { service, post } = createResetService();

    await service.apiResetInfiniSubscription(
      { $$devOnlyPassword: VALID_DEV_ONLY_PASSWORD },
      { expectedOneKeyUserId: 'user-a' },
    );

    expect(post).toHaveBeenCalledWith(
      '/prime/v1/infini/test/reset',
      undefined,
      {
        headers: {
          'X-Onekey-Request-Token': 'token-a',
        },
      },
    );
  });

  // An account switch between the confirmation and the send must abort the
  // delete, never redirect it onto the account that is current by then.
  it('rejects when the logged-in user is no longer the confirming user', async () => {
    const { service, post } = createResetService();
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-b',
    });

    await expect(
      service.apiResetInfiniSubscription(
        { $$devOnlyPassword: VALID_DEV_ONLY_PASSWORD },
        { expectedOneKeyUserId: 'user-a' },
      ),
    ).rejects.toThrow('Prime purchase user changed');

    expect(post).not.toHaveBeenCalled();
  });

  // The method is production-callable and no decorator guards it, so the method
  // body itself must reject a missing or wrong devOnlyPassword before the
  // destructive request is sent.
  it.each([
    ['missing devOnlyPassword', {} as any],
    ['wrong devOnlyPassword', { $$devOnlyPassword: 'wrong-password' } as any],
  ])('rejects a direct call with %s', async (_title, params) => {
    const { service, post } = createResetService();

    await expect(
      service.apiResetInfiniSubscription(params, {
        expectedOneKeyUserId: 'user-a',
      }),
    ).rejects.toThrow(/devOnlyPassword is wrong/);

    expect(post).not.toHaveBeenCalled();
  });
});

describe('ServicePrime.apiCancelInfiniSubscription', () => {
  const userA = {
    isLoggedIn: true,
    onekeyUserId: 'user-a',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrimePersistAtom.get.mockResolvedValue(userA);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: 'token-a',
    });
  });

  afterEach(() => {
    mockPrimePersistAtom.get.mockImplementation(async () => ({}));
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: 'persisted-access-token',
    });
  });

  it('pins the validated session token on the cancel request', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getActiveAuthToken.mockResolvedValue('token-a');
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(3);
    const post = jest.fn(async () => undefined);
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await service.apiCancelInfiniSubscription({
      note: 'No longer needed',
      expectedOneKeyUserId: 'user-a',
    });

    expect(post).toHaveBeenCalledWith(
      '/prime/v1/infini/subscription/cancel',
      { note: 'No longer needed' },
      {
        headers: {
          'X-Onekey-Request-Token': 'token-a',
        },
      },
    );
  });

  it('rejects before reading auth state when the expected user is not current', async () => {
    const { service, simpleDbPrime } = createService();
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-b',
    });
    const post = jest.fn(async () => undefined);
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiCancelInfiniSubscription({
        expectedOneKeyUserId: 'user-a',
      }),
    ).rejects.toThrow('Prime subscription user changed');

    expect(simpleDbPrime.getActiveAuthToken).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects a captured token that no longer matches the persisted session', async () => {
    const { service, simpleDbPrime } = createService();
    mockPrimePersistAtom.get.mockResolvedValue(userA);
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(3);
    simpleDbPrime.getActiveAuthToken.mockResolvedValue('token-b');
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: 'token-a',
    });
    const post = jest.fn(async () => undefined);
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiCancelInfiniSubscription({
        expectedOneKeyUserId: 'user-a',
      }),
    ).rejects.toThrow('Prime subscription user changed');

    expect(post).not.toHaveBeenCalled();
  });

  it('rejects a completed request when the user changes while it is in flight', async () => {
    const { service, simpleDbPrime } = createService();
    let currentUser = userA;
    let authStateGeneration = 3;
    let activeToken = 'token-a';
    mockPrimePersistAtom.get.mockImplementation(async () => currentUser);
    simpleDbPrime.getActiveAuthToken.mockImplementation(
      async () => activeToken,
    );
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    simpleDbPrime.getAuthStateGeneration.mockImplementation(
      async () => authStateGeneration,
    );
    const postStarted = createDeferred();
    const postResponse = createDeferred();
    const post = jest.fn(async () => {
      postStarted.resolve();
      await postResponse.promise;
    });
    service.getPrimeClient = jest.fn(async () => ({ post }));

    const cancelPromise = service.apiCancelInfiniSubscription({
      expectedOneKeyUserId: 'user-a',
    });
    const cancelResult = cancelPromise.then(
      () => undefined,
      (error: unknown) => error,
    );
    await postStarted.promise;
    currentUser = { isLoggedIn: true, onekeyUserId: 'user-b' };
    authStateGeneration = 4;
    activeToken = 'token-b';
    postResponse.resolve();

    await expect(cancelResult).resolves.toEqual(
      expect.objectContaining({
        message: 'Prime subscription user changed',
      }),
    );
    expect(post).toHaveBeenCalledWith(
      '/prime/v1/infini/subscription/cancel',
      { note: undefined },
      {
        headers: {
          'X-Onekey-Request-Token': 'token-a',
        },
      },
    );
  });
});

describe('ServicePrime Prime redemption API', () => {
  const userA = {
    isLoggedIn: true,
    onekeyUserId: 'user-a',
  };
  const redemption = {
    addedDays: 30,
    finalExpiresAt: 1_790_138_829_137,
  };
  const redemptionResponse = {
    code: 'OKP-PJ37L-DYXWR',
    daysAdded: redemption.addedDays,
    changeType: 'activate',
    primeExpiresAt: redemption.finalExpiresAt,
    primeExpiresAtIso: '2026-09-23T04:47:09.137Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrimePersistAtom.get.mockResolvedValue(userA);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: 'token-a',
    });
  });

  afterEach(() => {
    mockPrimePersistAtom.get.mockImplementation(async () => ({}));
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: 'persisted-access-token',
    });
  });

  function createRedemptionService() {
    const result = createService();
    result.simpleDbPrime.getActiveAuthToken.mockResolvedValue('token-a');
    result.simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    result.simpleDbPrime.getAuthStateGeneration.mockResolvedValue(3);
    return result;
  }

  it('redeems a trimmed code with the pinned OneKey ID session', async () => {
    const { service } = createRedemptionService();
    const post = jest.fn(async () => ({
      data: { data: redemptionResponse },
    }));
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiRedeemPrimeCode({
        code: '  OKP-PJ37L-DYXWR  ',
        expectedOneKeyUserId: 'user-a',
      }),
    ).resolves.toEqual(redemption);
    expect(post).toHaveBeenCalledWith(
      '/prime/v1/redemption/redeem',
      { code: 'OKP-PJ37L-DYXWR' },
      {
        headers: {
          'X-Onekey-Request-Token': 'token-a',
        },
      },
    );
  });

  it('rejects an empty code without making a request', async () => {
    const { service } = createRedemptionService();
    const post = jest.fn();
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiRedeemPrimeCode({
        code: '   ',
        expectedOneKeyUserId: 'user-a',
      }),
    ).rejects.toBeInstanceOf(OneKeyLocalError);
    expect(post).not.toHaveBeenCalled();
  });

  it.each([
    ['missing data', undefined],
    ['zero days', { ...redemptionResponse, daysAdded: 0 }],
    ['fractional days', { ...redemptionResponse, daysAdded: 1.5 }],
    [
      'seconds timestamp',
      { ...redemptionResponse, primeExpiresAt: 1_800_000_000 },
    ],
    [
      'invalid timestamp',
      { ...redemptionResponse, primeExpiresAt: Number.NaN },
    ],
  ])(
    'rejects a malformed redemption response with %s',
    async (_label, data) => {
      const { service } = createRedemptionService();
      const post = jest.fn(async () => ({ data: { data } }));
      service.getPrimeClient = jest.fn(async () => ({ post }));

      await expect(
        service.apiRedeemPrimeCode({
          code: 'OKP-PJ37L-DYXWR',
          expectedOneKeyUserId: 'user-a',
        }),
      ).rejects.toThrow('Invalid Prime redemption response');
    },
  );

  it('rejects before the request when the logged-in user changed', async () => {
    const { service } = createRedemptionService();
    const post = jest.fn();
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiRedeemPrimeCode({
        code: 'OKP-PJ37L-DYXWR',
        expectedOneKeyUserId: 'user-b',
      }),
    ).rejects.toBeInstanceOf(OneKeyLocalError);
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects the result when the logged-in user changes in flight', async () => {
    const { service } = createRedemptionService();
    const postStarted = createDeferred();
    const deferred = createDeferred<{
      data: { data: typeof redemptionResponse };
    }>();
    const post = jest.fn(() => {
      postStarted.resolve();
      return deferred.promise;
    });
    service.getPrimeClient = jest.fn(async () => ({ post }));

    const redemptionPromise = service.apiRedeemPrimeCode({
      code: 'OKP-PJ37L-DYXWR',
      expectedOneKeyUserId: 'user-a',
    });
    await postStarted.promise;
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-b',
    });
    deferred.resolve({ data: { data: redemptionResponse } });

    await expect(redemptionPromise).rejects.toBeInstanceOf(OneKeyLocalError);
  });

  it('rejects the result after an auth-session ABA change', async () => {
    const { service, simpleDbPrime } = createRedemptionService();
    const postStarted = createDeferred();
    const deferred = createDeferred<{
      data: { data: typeof redemptionResponse };
    }>();
    const post = jest.fn(() => {
      postStarted.resolve();
      return deferred.promise;
    });
    service.getPrimeClient = jest.fn(async () => ({ post }));

    const redemptionPromise = service.apiRedeemPrimeCode({
      code: 'OKP-PJ37L-DYXWR',
      expectedOneKeyUserId: 'user-a',
    });
    await postStarted.promise;
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(5);
    deferred.resolve({ data: { data: redemptionResponse } });

    await expect(redemptionPromise).rejects.toBeInstanceOf(OneKeyLocalError);
  });

  it('preserves the server error for inline display without a global toast', async () => {
    const { service } = createRedemptionService();
    const message = '当前订阅不支持兑换；不会影响订阅扣款日期';
    const error = Object.assign(new Error(message), {
      autoToast: true,
      code: 90_506,
      data: {
        code: 90_506,
        message,
        messageId: 'error__prime_redemption_code_unlimited_entitlement',
      },
    });
    const post = jest.fn(async () => Promise.reject(error));
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiRedeemPrimeCode({
        code: 'OKP-PJ37L-DYXWR',
        expectedOneKeyUserId: 'user-a',
      }),
    ).rejects.toBe(error);
    expect(error.autoToast).toBe(false);
  });

  it('keeps the invalid-session auto toast and existing logout flow', async () => {
    const { service } = createRedemptionService();
    const error = new OneKeyErrorPrimeLoginInvalidToken({
      autoToast: true,
      message: '用户认证失败，请重试登录。',
    });
    const post = jest.fn(async () => Promise.reject(error));
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiRedeemPrimeCode({
        code: 'OKP-PJ37L-DYXWR',
        expectedOneKeyUserId: 'user-a',
      }),
    ).rejects.toBe(error);
    expect(error.autoToast).toBe(true);
  });
});

describe('ServicePrime Infini payment APIs', () => {
  const userA = {
    isLoggedIn: true,
    onekeyUserId: 'user-a',
  };
  const payment = {
    paymentId: 'prime-payment-id',
    address: '0x1234',
    chain: 'ETHEREUM',
    token: 'USDC',
    amountDue: '29.99',
    expiresAt: 1_800_000_000_000,
    status: 'pending',
    infiniStatus: 'created',
    amountConfirmed: '0',
    amountConfirming: '0',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrimePersistAtom.get.mockResolvedValue(userA);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: 'token-a',
    });
  });

  afterEach(() => {
    mockPrimePersistAtom.get.mockImplementation(async () => ({}));
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: 'persisted-access-token',
    });
  });

  function createInfiniService() {
    const result = createService();
    result.simpleDbPrime.getActiveAuthToken.mockResolvedValue('token-a');
    result.simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    result.simpleDbPrime.getAuthStateGeneration.mockResolvedValue(3);
    return result;
  }

  it('loads supported payment options', async () => {
    const { service } = createInfiniService();
    const get = jest.fn(async () => ({
      data: {
        data: {
          chains: [
            {
              chain: ' ethereum ',
              networkId: 'evm--1',
              tokens: [
                {
                  symbol: ' usdt ',
                  contract: ' 0xdac17f958d2ee523a2206206994597c13d831ec7 ',
                },
                {
                  symbol: 'USDC',
                  contract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                },
              ],
            },
          ],
        },
      },
    }));
    service.getPrimeClient = jest.fn(async () => ({ get }));

    await expect(service.apiGetInfiniPaymentOptions()).resolves.toEqual([
      {
        chain: 'ETHEREUM',
        networkId: 'evm--1',
        tokens: [
          {
            symbol: 'USDT',
            contract: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          },
          {
            symbol: 'USDC',
            contract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
      },
    ]);
    expect(get).toHaveBeenCalledWith('/prime/v1/infini/payment/options');
  });

  it('drops malformed payment options at the service boundary', async () => {
    const { service } = createInfiniService();
    const get = jest.fn(async () => ({
      data: {
        data: {
          chains: [
            {
              chain: 'ETHEREUM',
              networkId: 'evm--1',
              tokens: [
                {
                  symbol: 'USDC',
                  contract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                },
                { symbol: 'USDT', contract: '' },
                123,
              ],
            },
            {
              chain: '',
              networkId: 'evm--1',
              tokens: [{ symbol: 'USDT', contract: '0x1234' }],
            },
            {
              chain: 'TRON',
              tokens: [{ symbol: 'USDT', contract: 'TR7NHq' }],
            },
            { chain: 'TRON', tokens: 'USDT' },
          ],
        },
      },
    }));
    service.getPrimeClient = jest.fn(async () => ({ get }));

    await expect(service.apiGetInfiniPaymentOptions()).resolves.toEqual([
      {
        chain: 'ETHEREUM',
        networkId: 'evm--1',
        tokens: [
          {
            symbol: 'USDC',
            contract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
      },
    ]);
  });

  it('creates a yearly payment with the annual wire plan', async () => {
    const { service } = createInfiniService();
    const post = jest.fn(async () => ({ data: { data: payment } }));
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiCreateInfiniPayment({
        plan: 'yearly',
        chain: 'ETHEREUM',
        token: 'USDC',
        expectedOneKeyUserId: 'user-a',
      }),
    ).resolves.toEqual(payment);
    expect(post).toHaveBeenCalledWith(
      '/prime/v1/infini/payment',
      {
        plan: 'annual',
        chain: 'ETHEREUM',
        token: 'USDC',
      },
      {
        headers: {
          'X-Onekey-Request-Token': 'token-a',
        },
      },
    );
  });

  it('normalizes the create response payAmount wire field', async () => {
    const { service } = createInfiniService();
    const createResponse = {
      paymentId: 'prime_69bc3e15-e1f7-4789-af76-e3583d40b314',
      address: '0x0cb9eb1954AFDfFe2c4bf25Fca9e3fFa37114D8C',
      chain: 'ETHEREUM',
      token: 'USDT',
      payAmount: '0.2',
      payCurrency: 'USDT',
      amountUsd: '0.2',
      tokenPriceUsdc: '0',
      expiresAt: 1_784_630_652_000,
    };
    const post = jest.fn(async () => ({ data: { data: createResponse } }));
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiCreateInfiniPayment({
        plan: 'monthly',
        chain: 'ETHEREUM',
        token: 'USDT',
        expectedOneKeyUserId: 'user-a',
      }),
    ).resolves.toEqual({
      paymentId: createResponse.paymentId,
      address: createResponse.address,
      chain: createResponse.chain,
      token: createResponse.token,
      amountDue: createResponse.payAmount,
      expiresAt: createResponse.expiresAt,
    });
  });

  it('rejects a create response whose payCurrency differs from token', async () => {
    const { service } = createInfiniService();
    const post = jest.fn(async () => ({
      data: {
        data: {
          ...payment,
          amountDue: undefined,
          payAmount: payment.amountDue,
          payCurrency: 'USDT',
        },
      },
    }));
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiCreateInfiniPayment({
        plan: 'monthly',
        chain: 'ETHEREUM',
        token: 'USDC',
        expectedOneKeyUserId: 'user-a',
      }),
    ).rejects.toThrow('Invalid Infini payment response');
  });

  it('rejects conflicting amountDue and payAmount fields', async () => {
    const { service } = createInfiniService();
    const post = jest.fn(async () => ({
      data: {
        data: {
          ...payment,
          payAmount: '30',
          payCurrency: payment.token,
        },
      },
    }));
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiCreateInfiniPayment({
        plan: 'monthly',
        chain: 'ETHEREUM',
        token: 'USDC',
        expectedOneKeyUserId: 'user-a',
      }),
    ).rejects.toThrow('Invalid Infini payment response');
  });

  it('queries a payment by paymentId', async () => {
    const { service } = createInfiniService();
    const get = jest.fn(async () => ({ data: { data: payment } }));
    service.getPrimeClient = jest.fn(async () => ({ get }));

    await expect(
      service.apiGetInfiniPayment({
        paymentId: payment.paymentId,
        expectedOneKeyUserId: 'user-a',
      }),
    ).resolves.toEqual(payment);
    expect(get).toHaveBeenCalledWith('/prime/v1/infini/payment', {
      params: { paymentId: payment.paymentId },
      headers: {
        'X-Onekey-Request-Token': 'token-a',
      },
    });
  });

  it('rejects a payment query response with a different paymentId', async () => {
    const { service } = createInfiniService();
    const get = jest.fn(async () => ({
      data: { data: { ...payment, paymentId: 'different-payment-id' } },
    }));
    service.getPrimeClient = jest.fn(async () => ({ get }));

    await expect(
      service.apiGetInfiniPayment({
        paymentId: payment.paymentId,
        expectedOneKeyUserId: 'user-a',
      }),
    ).rejects.toThrow('Invalid Infini payment response');
  });

  it('hydrates a paymentId-only create response from the query endpoint', async () => {
    const { service } = createInfiniService();
    const post = jest.fn(async () => ({
      data: { data: { paymentId: payment.paymentId } },
    }));
    const get = jest.fn(async () => ({ data: { data: payment } }));
    service.getPrimeClient = jest.fn(async () => ({ get, post }));

    await expect(
      service.apiCreateInfiniPayment({
        plan: 'monthly',
        chain: 'ETHEREUM',
        token: 'USDC',
        expectedOneKeyUserId: 'user-a',
      }),
    ).resolves.toEqual(payment);
    expect(post).toHaveBeenCalledWith(
      '/prime/v1/infini/payment',
      {
        plan: 'monthly',
        chain: 'ETHEREUM',
        token: 'USDC',
      },
      {
        headers: {
          'X-Onekey-Request-Token': 'token-a',
        },
      },
    );
    expect(get).toHaveBeenCalledWith('/prime/v1/infini/payment', {
      params: { paymentId: payment.paymentId },
      headers: {
        'X-Onekey-Request-Token': 'token-a',
      },
    });
  });

  it('rejects a malformed payment response', async () => {
    const { service } = createInfiniService();
    const post = jest.fn(async () => ({
      data: { data: { ...payment, paymentId: '' } },
    }));
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiCreateInfiniPayment({
        plan: 'monthly',
        chain: 'ETHEREUM',
        token: 'USDC',
        expectedOneKeyUserId: 'user-a',
      }),
    ).rejects.toThrow('Invalid Infini payment response');
  });

  it('rejects malformed optional payment progress fields', async () => {
    const { service } = createInfiniService();
    const get = jest.fn(async () => ({
      data: {
        data: {
          ...payment,
          status: 1,
          amountConfirming: null,
        },
      },
    }));
    service.getPrimeClient = jest.fn(async () => ({ get }));

    await expect(
      service.apiGetInfiniPayment({
        paymentId: payment.paymentId,
        expectedOneKeyUserId: 'user-a',
      }),
    ).rejects.toThrow('Invalid Infini payment response');
  });

  it('rejects a non-positive payment amount', async () => {
    const { service } = createInfiniService();
    const post = jest.fn(async () => ({
      data: { data: { ...payment, amountDue: '0' } },
    }));
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiCreateInfiniPayment({
        plan: 'monthly',
        chain: 'ETHEREUM',
        token: 'USDC',
        expectedOneKeyUserId: 'user-a',
      }),
    ).rejects.toThrow('Invalid Infini payment response');
  });

  it('pins the validated session token on hosted checkout creation', async () => {
    const { service } = createInfiniService();
    const post = jest.fn(async () => ({
      data: {
        data: {
          checkoutUrl:
            '  HTTPS://CHECKOUT.INFINI.MONEY:443/subscription/session?plan=monthly  ',
        },
      },
    }));
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiGetInfiniCheckoutUrl({
        plan: 'monthly',
        expectedOneKeyUserId: 'user-a',
      }),
    ).resolves.toEqual({
      checkoutUrl:
        'https://checkout.infini.money/subscription/session?plan=monthly',
    });
    expect(post).toHaveBeenCalledWith(
      '/prime/v1/infini/checkout',
      {
        plan: 'monthly',
      },
      {
        headers: {
          'X-Onekey-Request-Token': 'token-a',
        },
      },
    );
  });

  it('accepts a safe public checkout URL returned by the server', async () => {
    const { service } = createInfiniService();
    const post = jest.fn(async () => ({
      data: {
        data: {
          checkoutUrl:
            'https://payments.example.com/payment?order_id=test-order',
        },
      },
    }));
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiGetInfiniCheckoutUrl({
        plan: 'monthly',
        expectedOneKeyUserId: 'user-a',
      }),
    ).resolves.toEqual({
      checkoutUrl: 'https://payments.example.com/payment?order_id=test-order',
    });
  });

  it('accepts the Infini sandbox checkout URL', async () => {
    const { service } = createInfiniService();
    const post = jest.fn(async () => ({
      data: {
        data: {
          checkoutUrl:
            'https://checkout-sandbox.infini.money/payment?order_id=test-order',
        },
      },
    }));
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiGetInfiniCheckoutUrl({
        plan: 'monthly',
        expectedOneKeyUserId: 'user-a',
      }),
    ).resolves.toEqual({
      checkoutUrl:
        'https://checkout-sandbox.infini.money/payment?order_id=test-order',
    });
  });

  it.each([
    ['non-string', undefined],
    ['malformed', 'not a URL'],
    ['javascript scheme', ['java', 'script:', 'alert(1)'].join('')],
    ['HTTP scheme', 'http://checkout.infini.money/subscription/session'],
    [
      'credentials',
      'https://user:password@checkout.infini.money/subscription/session',
    ],
    ['localhost', 'https://localhost/subscription/session'],
    ['localhost subdomain', 'https://api.localhost/subscription/session'],
    ['private IPv4', 'https://192.168.1.1/subscription/session'],
    ['private IPv6', 'https://[fc00::1]/subscription/session'],
  ])('rejects a hosted checkout URL with %s', async (_label, checkoutUrl) => {
    const { service } = createInfiniService();
    const post = jest.fn(async () => ({
      data: {
        data: {
          checkoutUrl,
        },
      },
    }));
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiGetInfiniCheckoutUrl({
        plan: 'monthly',
        expectedOneKeyUserId: 'user-a',
      }),
    ).rejects.toThrow('Invalid Infini checkout URL');
  });

  it('pins the validated session token on subscription lookup', async () => {
    const { service } = createInfiniService();
    const subscription = {
      subscriptionId: 'infini-subscription-id',
      status: 'active',
      plan: 'monthly',
      currentPeriodEnd: 1_800_000_000_000,
    };
    const get = jest.fn(async () => ({
      data: {
        data: subscription,
      },
    }));
    service.getPrimeClient = jest.fn(async () => ({ get }));

    await expect(
      service.apiGetInfiniSubscription({
        expectedOneKeyUserId: 'user-a',
      }),
    ).resolves.toEqual(subscription);
    expect(get).toHaveBeenCalledWith('/prime/v1/infini/subscription', {
      headers: {
        'X-Onekey-Request-Token': 'token-a',
      },
    });
  });

  it('normalizes a missing Infini subscription status at the service boundary', async () => {
    const { service } = createInfiniService();
    const subscription = {
      subscriptionId: 'infini-subscription-id',
      plan: 'monthly',
      currentPeriodEnd: 1_800_000_000_000,
    };
    const get = jest.fn(async () => ({
      data: {
        data: subscription,
      },
    }));
    service.getPrimeClient = jest.fn(async () => ({ get }));

    await expect(
      service.apiGetInfiniSubscription({
        expectedOneKeyUserId: 'user-a',
      }),
    ).resolves.toEqual({
      ...subscription,
      status: '',
    });
  });

  it('pins the validated session token on webhook sync', async () => {
    const { service } = createInfiniService();
    const post = jest.fn(async () => undefined);
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await service.apiSyncInfiniWebhook({
      expectedOneKeyUserId: 'user-a',
    });

    expect(post).toHaveBeenCalledWith(
      '/prime/v1/infini/webhook/sync',
      undefined,
      {
        headers: {
          'X-Onekey-Request-Token': 'token-a',
        },
      },
    );
  });

  it('rejects webhook sync before the request for a different user', async () => {
    const { service } = createInfiniService();
    const post = jest.fn(async () => undefined);
    service.getPrimeClient = jest.fn(async () => ({ post }));

    await expect(
      service.apiSyncInfiniWebhook({
        expectedOneKeyUserId: 'user-b',
      }),
    ).rejects.toThrow('Prime purchase user changed');

    expect(post).not.toHaveBeenCalled();
  });

  it('returns an auth-bound purchase status snapshot from one pinned token', async () => {
    const { service } = createInfiniService();
    const subscription = {
      subscriptionId: 'infini-subscription-id',
      status: 'active',
      plan: 'monthly',
      currentPeriodEnd: 1_800_000_000_000,
    };
    const serverUserInfo = {
      userId: 'user-a',
      isPrime: true,
      primeExpiredAt: 1_800_000_000_000,
      willRenew: true,
      subscriptions: [{ id: 'prime-subscription-id', channel: 'infini' }],
    };
    const get = jest.fn(async (url: string) => {
      if (url === '/prime/v1/account/profile') {
        return { data: { code: 0, data: {} } };
      }
      if (url === '/prime/v1/user/info') {
        return { data: { code: 0, data: serverUserInfo } };
      }
      return { data: { data: subscription } };
    });
    service.getPrimeClient = jest.fn(async () => ({ get }));

    await expect(
      service.apiGetInfiniPurchaseStatusSnapshot({
        expectedOneKeyUserId: 'user-a',
      }),
    ).resolves.toEqual({
      onekeyUserId: 'user-a',
      primeSubscription: {
        isActive: true,
        expiresAt: serverUserInfo.primeExpiredAt,
        willRenew: true,
        subscriptions: serverUserInfo.subscriptions,
      },
      infiniSubscription: subscription,
    });
    expect(get).toHaveBeenCalledWith('/prime/v1/account/profile', {
      autoHandleError: false,
      headers: {
        'X-Onekey-Request-Token': 'token-a',
      },
    });
    expect(get).toHaveBeenCalledWith('/prime/v1/user/info', {
      autoHandleError: false,
      headers: {
        'X-Onekey-Request-Token': 'token-a',
      },
    });
    expect(get).toHaveBeenCalledWith('/prime/v1/infini/subscription', {
      headers: {
        'X-Onekey-Request-Token': 'token-a',
      },
    });
  });

  it('returns payment and purchase status from one pre-broadcast auth snapshot', async () => {
    const { service } = createInfiniService();
    const subscription = {
      subscriptionId: 'infini-subscription-id',
      status: 'active',
      plan: 'monthly',
      currentPeriodEnd: 1_800_000_000_000,
    };
    const serverUserInfo = {
      userId: 'user-a',
      isPrime: false,
      primeExpiredAt: 0,
    };
    const get = jest.fn(async (url: string) => {
      if (url === '/prime/v1/account/profile') {
        return { data: { code: 0, data: {} } };
      }
      if (url === '/prime/v1/user/info') {
        return { data: { code: 0, data: serverUserInfo } };
      }
      if (url === '/prime/v1/infini/payment') {
        return { data: { data: payment } };
      }
      return { data: { data: subscription } };
    });
    service.getPrimeClient = jest.fn(async () => ({ get }));

    await expect(
      service.apiGetInfiniPaymentPreBroadcastSnapshot({
        paymentId: payment.paymentId,
        expectedOneKeyUserId: 'user-a',
      }),
    ).resolves.toEqual({
      payment,
      purchaseStatusSnapshot: {
        onekeyUserId: 'user-a',
        primeSubscription: undefined,
        infiniSubscription: subscription,
      },
    });
    const pinnedRequestConfig = {
      headers: {
        'X-Onekey-Request-Token': 'token-a',
      },
    };
    expect(get).toHaveBeenCalledWith('/prime/v1/infini/payment', {
      params: { paymentId: payment.paymentId },
      ...pinnedRequestConfig,
    });
    expect(get).toHaveBeenCalledWith(
      '/prime/v1/infini/subscription',
      pinnedRequestConfig,
    );
    expect(get).toHaveBeenCalledWith('/prime/v1/account/profile', {
      autoHandleError: false,
      ...pinnedRequestConfig,
    });
    expect(get).toHaveBeenCalledWith('/prime/v1/user/info', {
      autoHandleError: false,
      ...pinnedRequestConfig,
    });
  });

  it('rejects a pre-broadcast snapshot after an auth-session ABA change', async () => {
    const { service, simpleDbPrime } = createInfiniService();
    const paymentRequestStarted = createDeferred();
    const paymentResponse = createDeferred<{
      data: { data: typeof payment };
    }>();
    const get = jest.fn((url: string) => {
      if (url === '/prime/v1/account/profile') {
        return Promise.resolve({ data: { code: 0, data: {} } });
      }
      if (url === '/prime/v1/user/info') {
        return Promise.resolve({
          data: {
            code: 0,
            data: {
              userId: 'user-a',
              isPrime: false,
              primeExpiredAt: 0,
            },
          },
        });
      }
      if (url === '/prime/v1/infini/subscription') {
        return Promise.resolve({ data: { data: undefined } });
      }
      paymentRequestStarted.resolve();
      return paymentResponse.promise;
    });
    service.getPrimeClient = jest.fn(async () => ({ get }));

    const snapshotPromise = service.apiGetInfiniPaymentPreBroadcastSnapshot({
      paymentId: payment.paymentId,
      expectedOneKeyUserId: 'user-a',
    });
    await paymentRequestStarted.promise;
    mockPrimePersistAtom.get.mockResolvedValue(userA);
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(5);
    paymentResponse.resolve({ data: { data: payment } });

    await expect(snapshotPromise).rejects.toThrow(
      'Prime purchase user changed',
    );
  });

  it('rejects a create response after an auth-session ABA change', async () => {
    const { service, simpleDbPrime } = createInfiniService();
    const postStarted = createDeferred();
    const deferred = createDeferred<{ data: { data: typeof payment } }>();
    const post = jest.fn(() => {
      postStarted.resolve();
      return deferred.promise;
    });
    service.getPrimeClient = jest.fn(async () => ({ post }));

    const createPromise = service.apiCreateInfiniPayment({
      plan: 'monthly',
      chain: 'ETHEREUM',
      token: 'USDC',
      expectedOneKeyUserId: 'user-a',
    });
    await postStarted.promise;
    expect(post).toHaveBeenCalledTimes(1);

    // The visible user returns to A, but the auth generation proves that an
    // A -> B -> A session replacement happened while the request was running.
    mockPrimePersistAtom.get.mockResolvedValue(userA);
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(5);
    deferred.resolve({ data: { data: payment } });

    await expect(createPromise).rejects.toThrow('Prime purchase user changed');
  });

  it('rejects a checkout response after an auth-session ABA change', async () => {
    const { service, simpleDbPrime } = createInfiniService();
    const postStarted = createDeferred();
    const deferred = createDeferred<{
      data: { data: { checkoutUrl: string } };
    }>();
    const post = jest.fn(() => {
      postStarted.resolve();
      return deferred.promise;
    });
    service.getPrimeClient = jest.fn(async () => ({ post }));

    const checkoutPromise = service.apiGetInfiniCheckoutUrl({
      plan: 'monthly',
      expectedOneKeyUserId: 'user-a',
    });
    await postStarted.promise;

    mockPrimePersistAtom.get.mockResolvedValue(userA);
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(5);
    deferred.resolve({
      data: {
        data: {
          checkoutUrl: 'https://checkout.infini.money/checkout',
        },
      },
    });

    await expect(checkoutPromise).rejects.toThrow(
      'Prime purchase user changed',
    );
  });

  it('rejects a subscription response after an auth-session ABA change', async () => {
    const { service, simpleDbPrime } = createInfiniService();
    const getStarted = createDeferred();
    const deferred = createDeferred<{
      data: {
        data: {
          subscriptionId: string;
          status: string;
          plan: string;
          currentPeriodEnd: number;
        };
      };
    }>();
    const get = jest.fn(() => {
      getStarted.resolve();
      return deferred.promise;
    });
    service.getPrimeClient = jest.fn(async () => ({ get }));

    const subscriptionPromise = service.apiGetInfiniSubscription({
      expectedOneKeyUserId: 'user-a',
    });
    await getStarted.promise;

    mockPrimePersistAtom.get.mockResolvedValue(userA);
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(5);
    deferred.resolve({
      data: {
        data: {
          subscriptionId: 'infini-subscription-id',
          status: 'active',
          plan: 'monthly',
          currentPeriodEnd: 1_800_000_000_000,
        },
      },
    });

    await expect(subscriptionPromise).rejects.toThrow(
      'Prime purchase user changed',
    );
  });

  it('rejects webhook sync after an auth-session ABA change', async () => {
    const { service, simpleDbPrime } = createInfiniService();
    const postStarted = createDeferred();
    const postResponse = createDeferred<void>();
    const post = jest.fn(async () => {
      postStarted.resolve();
      await postResponse.promise;
    });
    service.getPrimeClient = jest.fn(async () => ({ post }));

    const syncPromise = service.apiSyncInfiniWebhook({
      expectedOneKeyUserId: 'user-a',
    });
    await postStarted.promise;

    mockPrimePersistAtom.get.mockResolvedValue(userA);
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(5);
    postResponse.resolve();

    await expect(syncPromise).rejects.toThrow('Prime purchase user changed');
    expect(post).toHaveBeenCalledWith(
      '/prime/v1/infini/webhook/sync',
      undefined,
      {
        headers: {
          'X-Onekey-Request-Token': 'token-a',
        },
      },
    );
  });

  it('rejects a purchase status snapshot after an auth-session ABA change', async () => {
    const { service, simpleDbPrime } = createInfiniService();
    const subscriptionRequestStarted = createDeferred();
    const subscriptionResponse = createDeferred<{
      data: {
        data: {
          subscriptionId: string;
          status: string;
          plan: string;
          currentPeriodEnd: number;
        };
      };
    }>();
    const get = jest.fn((url: string) => {
      if (url === '/prime/v1/account/profile') {
        return Promise.resolve({ data: { code: 0, data: {} } });
      }
      if (url === '/prime/v1/user/info') {
        return Promise.resolve({
          data: {
            code: 0,
            data: {
              userId: 'user-a',
              isPrime: false,
              primeExpiredAt: 0,
            },
          },
        });
      }
      subscriptionRequestStarted.resolve();
      return subscriptionResponse.promise;
    });
    service.getPrimeClient = jest.fn(async () => ({ get }));

    const snapshotPromise = service.apiGetInfiniPurchaseStatusSnapshot({
      expectedOneKeyUserId: 'user-a',
    });
    await subscriptionRequestStarted.promise;

    mockPrimePersistAtom.get.mockResolvedValue(userA);
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(5);
    subscriptionResponse.resolve({
      data: {
        data: {
          subscriptionId: 'infini-subscription-id',
          status: 'active',
          plan: 'monthly',
          currentPeriodEnd: 1_800_000_000_000,
        },
      },
    });

    await expect(snapshotPromise).rejects.toThrow(
      'Prime purchase user changed',
    );
  });
});

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

  it('clears OneKey ID and shared OAuth cache while preserving legacy Keyless credentials', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    const logoutPrimeServerSessionBestEffort = jest
      .spyOn(service, 'logoutPrimeServerSessionBestEffort')
      .mockResolvedValue(undefined);
    simpleDbPrime.clearAllIdentityAuthMetadataAndBumpRevision.mockResolvedValue(
      8,
    );
    mockReadPersistedAccessTokenBySessionSourceStrict
      .mockResolvedValueOnce({
        status: 'ok',
        accessToken: 'legacy-access-token',
      })
      .mockResolvedValueOnce({
        status: 'ok',
        accessToken: 'keyless-access-token',
      });

    await expect(service.clearOneKeyIdLocalAuthCache()).resolves.toEqual({
      revision: 8,
    });

    expect(
      mockReadPersistedAccessTokenBySessionSourceStrict,
    ).toHaveBeenCalledWith(EPrimeAuthSessionSource.LegacyEmailSupabase);
    expect(
      mockReadPersistedAccessTokenBySessionSourceStrict,
    ).toHaveBeenCalledWith(EPrimeAuthSessionSource.KeylessOAuth);
    expect(logoutPrimeServerSessionBestEffort).toHaveBeenCalledWith({
      accessToken: 'legacy-access-token',
      callerName: 'ServicePrime.clearOneKeyIdLocalAuthCache',
    });
    expect(logoutPrimeServerSessionBestEffort).toHaveBeenCalledWith({
      accessToken: 'keyless-access-token',
      callerName: 'ServicePrime.clearOneKeyIdLocalAuthCache',
    });
    expect(mockRevokeAuthSessionTokenOnServerBestEffort).toHaveBeenCalledWith({
      authSessionSource: EPrimeAuthSessionSource.LegacyEmailSupabase,
      accessToken: 'legacy-access-token',
    });
    expect(mockRevokeAuthSessionTokenOnServerBestEffort).toHaveBeenCalledWith({
      authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
      accessToken: 'keyless-access-token',
    });
    expect(mockClearAllSupabaseAuthSessions).toHaveBeenCalledTimes(1);
    expect(
      Math.max(
        ...logoutPrimeServerSessionBestEffort.mock.invocationCallOrder,
        ...mockRevokeAuthSessionTokenOnServerBestEffort.mock
          .invocationCallOrder,
      ),
    ).toBeLessThan(
      mockClearAllSupabaseAuthSessions.mock.invocationCallOrder[0],
    );
    expect(
      backgroundApi.serviceKeylessWallet.cleanupLocalKeylessOAuthTokens,
    ).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.clearAllIdentityAuthMetadataAndBumpRevision,
    ).toHaveBeenCalledTimes(1);
    expect(mockPrimePersistAtom.set).toHaveBeenCalledWith(expect.any(Function));
    expect(
      backgroundApi.serviceKeylessWallet.cleanupKeylessWalletCredentialStorage,
    ).not.toHaveBeenCalled();
  });

  it('preserves local sessions when a strict token read fails transiently', async () => {
    const { service, simpleDbPrime } = createService();
    const readError = new OneKeyLocalError('secure storage unavailable');
    const logoutPrimeServerSessionBestEffort = jest
      .spyOn(service, 'logoutPrimeServerSessionBestEffort')
      .mockResolvedValue(undefined);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockRejectedValueOnce(
      readError,
    );

    await expect(service.clearOneKeyIdLocalAuthCache()).rejects.toBe(readError);

    expect(logoutPrimeServerSessionBestEffort).not.toHaveBeenCalled();
    expect(mockRevokeAuthSessionTokenOnServerBestEffort).not.toHaveBeenCalled();
    expect(mockClearAllSupabaseAuthSessions).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.clearAllIdentityAuthMetadataAndBumpRevision,
    ).not.toHaveBeenCalled();
  });

  it('preserves local sessions when a persisted session slot is corrupt', async () => {
    const { service, simpleDbPrime } = createService();
    const logoutPrimeServerSessionBestEffort = jest
      .spyOn(service, 'logoutPrimeServerSessionBestEffort')
      .mockResolvedValue(undefined);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValueOnce({
      status: 'corrupt',
    });

    await expect(service.clearOneKeyIdLocalAuthCache()).rejects.toThrow(
      'session slot is corrupt',
    );

    expect(logoutPrimeServerSessionBestEffort).not.toHaveBeenCalled();
    expect(mockRevokeAuthSessionTokenOnServerBestEffort).not.toHaveBeenCalled();
    expect(mockClearAllSupabaseAuthSessions).not.toHaveBeenCalled();
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

  it('commits an explicit local logout without deleting unattributed sessions', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getIdentityLifecycleRevision.mockResolvedValue(7);
    simpleDbPrime.bumpIdentityLifecycleRevision.mockResolvedValue(8);
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    const atomResetSpy = jest
      .spyOn(service, 'setPrimePersistAtomNotLoggedIn')
      .mockResolvedValue(undefined);

    await expect(
      service.commitExplicitLocalOneKeyIdLogout({
        expectedIdentityLifecycleRevision: 7,
        expectedProjection: {
          authSessionSource: undefined,
          oneKeyIdAuthState: 'loggedIn',
          isLoggedIn: true,
          isLoggedInOnServer: true,
          onekeyUserId: 'onekey-user-a',
        },
      }),
    ).resolves.toEqual({ status: 'committed', revision: 8 });

    expect(
      simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions,
    ).toHaveBeenCalledTimes(1);
    expect(atomResetSpy).toHaveBeenCalledTimes(1);
    expect(simpleDbPrime.clearAuthTokens).not.toHaveBeenCalled();
    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.clearKeylessSessionCommitIdIfMatches,
    ).not.toHaveBeenCalled();
  });

  it('finishes an explicit local logout after metadata cleared before the atom', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getIdentityLifecycleRevision.mockResolvedValue(7);
    simpleDbPrime.bumpIdentityLifecycleRevision.mockResolvedValue(8);
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedOut');
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    const atomResetSpy = jest
      .spyOn(service, 'setPrimePersistAtomNotLoggedIn')
      .mockResolvedValue(undefined);

    await expect(
      service.commitExplicitLocalOneKeyIdLogout({
        expectedIdentityLifecycleRevision: 7,
        expectedProjection: {
          authSessionSource: undefined,
          oneKeyIdAuthState: 'loggedIn',
          isLoggedIn: true,
          isLoggedInOnServer: true,
          onekeyUserId: 'onekey-user-a',
        },
      }),
    ).resolves.toEqual({ status: 'committed', revision: 8 });

    expect(
      simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions,
    ).not.toHaveBeenCalled();
    expect(atomResetSpy).toHaveBeenCalledTimes(1);
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

  it('commits a journaled cleanup for the exact source-less pre-upgrade projection', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getIdentityLifecycleRevision.mockResolvedValue(7);
    simpleDbPrime.bumpIdentityLifecycleRevision.mockResolvedValue(8);
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue(undefined);
    simpleDbPrime.getAuthSessionCommitId.mockResolvedValue(undefined);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: buildFakeJwt({ sub: 'keyless-user-a' }),
    });
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });

    await expect(
      service.commitIdentityExitLocalState({
        expectedIdentityLifecycleRevision: 7,
        oneKeyId: {
          onekeyUserId: 'onekey-user-a',
          source: EPrimeAuthSessionSource.KeylessOAuth,
          sessionCommitId: 'source-less-repair',
          sessionTokenSub: 'keyless-user-a',
          allowSourceLessPreUpgrade: true,
        },
        keylessSession: {
          sessionCommitId: 'source-less-repair',
          sessionTokenSub: 'keyless-user-a',
        },
      }),
    ).resolves.toEqual({ status: 'committed', revision: 8 });

    expect(mockRemoveAuthSessionStorageBySessionSource).toHaveBeenCalledWith(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    expect(simpleDbPrime.clearAuthTokens).toHaveBeenCalledTimes(1);
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

  afterEach(() => {
    mockPrimePersistAtom.get.mockImplementation(async () => ({}));
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: 'persisted-access-token',
    });
    resetIdentityRecoveryStateForTest('ready');
  });

  it('finishes an interrupted logout instead of restoring stale login metadata', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: false,
      isLoggedInOnServer: false,
      onekeyUserId: 'stale-onekey-user',
    });
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');

    await expect(
      service.clearOneKeyIdAuthStateIfNoActiveToken({ callerName: 'startup' }),
    ).resolves.toEqual({ cleared: true });

    expect(
      simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions,
    ).toHaveBeenCalledTimes(1);
    expect(mockPrimePersistAtom.set).toHaveBeenCalledWith(expect.any(Function));
    expect(
      backgroundApi.serviceIdentityExit.reconcileMissingOneKeyIdSession,
    ).not.toHaveBeenCalled();
    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();
  });

  it('waits for identity recovery before repairing an incomplete logout', async () => {
    const { service, simpleDbPrime } = createService();
    setupV650LoggedOutProjectionWithStaleLegacySession(simpleDbPrime);
    resetIdentityRecoveryStateForTest('pending');

    const resultPromise = service.clearOneKeyIdAuthStateIfNoActiveToken({
      callerName: 'startup',
    });
    await Promise.resolve();

    expect(
      simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions,
    ).not.toHaveBeenCalled();

    markIdentityRecoveryReady();
    await expect(resultPromise).resolves.toEqual({ cleared: true });
    expect(
      simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions,
    ).toHaveBeenCalledTimes(1);
  });

  it('fails closed without mutating state when identity recovery failed', async () => {
    const { service, simpleDbPrime } = createService();
    setupV650LoggedOutProjectionWithStaleLegacySession(simpleDbPrime);
    resetIdentityRecoveryStateForTest('failed');

    await expect(
      service.clearOneKeyIdAuthStateIfNoActiveToken({ callerName: 'startup' }),
    ).rejects.toThrow('Identity recovery did not complete');

    expect(
      simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions,
    ).not.toHaveBeenCalled();
    expect(mockPrimePersistAtom.set).not.toHaveBeenCalled();
  });

  it('reserves the identity lifecycle while committing a standalone repair', async () => {
    const { service, simpleDbPrime } = createService();
    setupV650LoggedOutProjectionWithStaleLegacySession(simpleDbPrime);
    simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions.mockImplementation(
      async () => {
        expect(getActiveIdentityLifecycleOperationId()).toMatch(
          /^repairIncompleteOneKeyIdLogout:/,
        );
      },
    );

    await expect(
      service.clearOneKeyIdAuthStateIfNoActiveToken({ callerName: 'startup' }),
    ).resolves.toEqual({ cleared: true });

    expect(getActiveIdentityLifecycleOperationId()).toBeUndefined();
  });

  it('migrates a v6.5.0 logged-out projection before a stale legacy session can be restored', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    const legacyAccessToken = buildFakeJwt({ sub: 'legacy-auth-user-a' });
    const v650LoggedOutState =
      setupV650LoggedOutProjectionWithStaleLegacySession(simpleDbPrime);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: legacyAccessToken,
    });

    await expect(
      service.clearOneKeyIdAuthStateIfNoActiveToken({ callerName: 'startup' }),
    ).resolves.toEqual({ cleared: true });

    expect(v650LoggedOutState.getOneKeyIdAuthState()).toBe('loggedOut');
    expect(v650LoggedOutState.getAuthSessionSource()).toBeUndefined();
    expect(v650LoggedOutState.didRestoreLegacySession()).toBe(false);
    expect(simpleDbPrime.getEffectiveAuthSessionSource).not.toHaveBeenCalled();
    expect(
      mockReadPersistedAccessTokenBySessionSourceStrict,
    ).not.toHaveBeenCalled();
    expect(
      backgroundApi.serviceIdentityExit.reconcileMissingOneKeyIdSession,
    ).not.toHaveBeenCalled();
    expect(mockOneKeyIdAuthStateRepairLog).toHaveBeenNthCalledWith(1, {
      stage: 'candidateDetected',
      status: 'started',
      repairType: 'legacyLoggedOutWithoutTombstone',
    });
    expect(mockOneKeyIdAuthStateRepairLog).toHaveBeenNthCalledWith(2, {
      stage: 'stateCommit',
      status: 'succeeded',
      repairType: 'legacyLoggedOutWithoutTombstone',
    });
    expect(
      JSON.stringify(mockOneKeyIdAuthStateRepairLog.mock.calls),
    ).not.toContain(legacyAccessToken);
  });

  it('repairs logged-in flags when the required OneKey ID is missing', async () => {
    const { service, simpleDbPrime } = createService();
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: undefined,
    });
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(1);

    await expect(
      service.clearOneKeyIdAuthStateIfNoActiveToken({ callerName: 'startup' }),
    ).resolves.toEqual({ cleared: true });

    expect(
      simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions,
    ).toHaveBeenCalledTimes(1);
    expect(mockPrimePersistAtom.set).toHaveBeenCalledWith(expect.any(Function));
    expect(mockOneKeyIdAuthStateRepairLog).toHaveBeenCalledWith({
      stage: 'stateCommit',
      status: 'succeeded',
      repairType: 'invalidLoggedInProjection',
    });
  });

  it('logs a fixed failure stage without including repair error details', async () => {
    const { service, simpleDbPrime } = createService();
    const sensitiveErrorText =
      'repair failed for user-a@example.com with eyJheader.payload.signature';
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: false,
      isLoggedInOnServer: false,
      onekeyUserId: undefined,
    });
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions.mockRejectedValue(
      new Error(sensitiveErrorText),
    );

    await expect(
      service.clearOneKeyIdAuthStateIfNoActiveToken({ callerName: 'startup' }),
    ).rejects.toThrow(sensitiveErrorText);

    expect(mockOneKeyIdAuthStateRepairLog).toHaveBeenLastCalledWith({
      stage: 'stateCommit',
      status: 'failed',
      repairType: 'incompleteLogoutProjection',
    });
    expect(
      JSON.stringify(mockOneKeyIdAuthStateRepairLog.mock.calls),
    ).not.toContain(sensitiveErrorText);
  });

  it('keeps a legacy upgrade session when profile validation is temporarily unavailable', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    const accessToken = buildFakeJwt({ sub: 'legacy-user-a' });
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue(undefined);
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(0);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken,
    });
    service.getPrimeClient = jest.fn(async () => ({
      get: jest.fn(async () => {
        throw new OneKeyLocalError('network unavailable');
      }),
    }));

    await expect(
      service.clearOneKeyIdAuthStateIfNoActiveToken({ callerName: 'test' }),
    ).resolves.toEqual({ cleared: false, retryScheduled: true });

    expect(
      simpleDbPrime.setAuthSessionSourceWithCommitId,
    ).not.toHaveBeenCalled();
    expect(
      backgroundApi.serviceIdentityExit.reconcileMissingOneKeyIdSession,
    ).not.toHaveBeenCalled();
    expect(mockPrimePersistAtom.set).not.toHaveBeenCalled();
    (
      service as unknown as {
        resetSourceLessOneKeyIdRecoveryRetry: () => void;
      }
    ).resetSourceLessOneKeyIdRecoveryRetry();
  });

  it('preserves a legacy upgrade session when SDK refresh is temporarily unavailable', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    const accessToken = buildFakeJwt({ sub: 'legacy-user-a', exp: 1 });
    const refreshError = Object.assign(
      new OneKeyLocalError('session refresh temporarily unavailable'),
      { $$retryable: true },
    );
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue(undefined);
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(0);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken,
    });
    mockGetAuthTokenBySessionSource.mockRejectedValueOnce(refreshError);
    const getPrimeClientSpy = jest.spyOn(service, 'getPrimeClient');

    await expect(
      service.clearOneKeyIdAuthStateIfNoActiveToken({ callerName: 'test' }),
    ).resolves.toEqual({ cleared: false, retryScheduled: true });

    expect(getPrimeClientSpy).not.toHaveBeenCalled();
    expect(
      backgroundApi.serviceIdentityExit.reconcileMissingOneKeyIdSession,
    ).not.toHaveBeenCalled();
    (
      service as unknown as {
        resetSourceLessOneKeyIdRecoveryRetry: () => void;
      }
    ).resetSourceLessOneKeyIdRecoveryRetry();
  });

  it('logs out a legacy upgrade session only after the SDK reports no refreshable session', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    const accessToken = buildFakeJwt({ sub: 'legacy-user-a', exp: 1 });
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue(undefined);
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(0);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken,
    });
    mockGetAuthTokenBySessionSource.mockResolvedValueOnce('');
    const getPrimeClientSpy = jest.spyOn(service, 'getPrimeClient');

    await expect(
      service.clearOneKeyIdAuthStateIfNoActiveToken({ callerName: 'test' }),
    ).resolves.toEqual({ cleared: true });

    expect(getPrimeClientSpy).not.toHaveBeenCalled();
    expect(
      backgroundApi.serviceIdentityExit.reconcileMissingOneKeyIdSession,
    ).toHaveBeenCalledWith({ callerName: 'test' });
  });

  it('does not resurrect a legacy slot after a new auth-state commit', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue(undefined);
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(1);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: buildFakeJwt({ sub: 'legacy-user-a' }),
    });
    const get = jest.fn();
    service.getPrimeClient = jest.fn(async () => ({ get }));

    await expect(
      service.clearOneKeyIdAuthStateIfNoActiveToken({ callerName: 'test' }),
    ).resolves.toEqual({ cleared: true });

    expect(get).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.setAuthSessionSourceWithCommitId,
    ).not.toHaveBeenCalled();
    expect(
      backgroundApi.serviceIdentityExit.reconcileMissingOneKeyIdSession,
    ).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions,
    ).toHaveBeenCalledTimes(1);
    expect(mockOneKeyIdAuthStateRepairLog).toHaveBeenCalledWith({
      stage: 'stateCommit',
      status: 'succeeded',
      repairType: 'invalidLoggedInProjection',
    });
  });

  it('recovers a source-less pre-upgrade OneKey ID from its matching Keyless OAuth session', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    const accessToken = buildFakeJwt({ sub: 'keyless-user-a' });
    const onekeyAccount = {
      onekeyUserId: 'onekey-user-a',
      status: EOneKeyIdAccountStatus.Active,
      identities: [],
    };
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue(undefined);
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(0);
    simpleDbPrime.getKeylessSupabaseAuthToken.mockResolvedValue(accessToken);
    backgroundApi.serviceAccount.getKeylessWallet.mockResolvedValue({
      id: 'hd-keyless-a',
    });
    mockReadPersistedAccessTokenBySessionSourceStrict.mockImplementation(
      async (source) =>
        source === EPrimeAuthSessionSource.LegacyEmailSupabase
          ? { status: 'empty' }
          : { status: 'ok', accessToken },
    );
    const get = jest.fn(async () => ({
      status: 200,
      data: { code: 0, data: { onekeyAccount } },
    }));
    service.getPrimeClient = jest.fn(async () => ({ get }));
    service.updatePrimeAtomByOneKeyIdAccount = jest.fn(async () => undefined);
    backgroundApi.serviceIdentityExit.reconcileMissingOneKeyIdSession.mockRejectedValue(
      new OneKeyLocalError(
        'OneKey ID projection is inconsistent while reconciling an empty session slot.',
      ),
    );

    await expect(
      service.clearOneKeyIdAuthStateIfNoActiveToken({
        callerName: 'test',
      }),
    ).resolves.toEqual({ cleared: false });

    expect(get).toHaveBeenCalledWith('/prime/v1/account/profile', {
      autoHandleError: false,
      headers: {
        'X-Onekey-Request-Token': accessToken,
      },
    });
    expect(
      backgroundApi.serviceKeylessWallet.validateTokenMatchesKeylessWallet,
    ).toHaveBeenCalledWith({
      token: accessToken,
      skipFixProvider: true,
    });
    expect(simpleDbPrime.setAuthSessionSourceWithCommitId).toHaveBeenCalledWith(
      {
        authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
        sessionCommitId: expect.any(String),
      },
    );
    expect(service.updatePrimeAtomByOneKeyIdAccount).toHaveBeenCalledWith({
      onekeyAccount,
    });
    expect(
      backgroundApi.serviceIdentityExit.reconcileMissingOneKeyIdSession,
    ).not.toHaveBeenCalled();
    const migrationOperationId =
      mockOneKeyIdAuthStateMigrationLog.mock.calls[0]?.[0]?.operationId;
    expect(migrationOperationId).toEqual(
      expect.stringMatching(/^sourceLessOneKeyIdRecovery:/),
    );
    expect(mockOneKeyIdAuthStateMigrationLog).toHaveBeenCalledWith({
      stage: 'candidateDetected',
      status: 'succeeded',
      operationId: migrationOperationId,
    });
    expect(mockOneKeyIdAuthStateMigrationLog).toHaveBeenCalledWith({
      stage: 'walletSessionValidation',
      status: 'succeeded',
      operationId: migrationOperationId,
    });
    expect(mockOneKeyIdAuthStateMigrationLog).toHaveBeenCalledWith({
      stage: 'profileValidation',
      status: 'succeeded',
      operationId: migrationOperationId,
    });
    expect(mockOneKeyIdAuthStateMigrationLog).toHaveBeenCalledWith({
      stage: 'stateCommit',
      status: 'succeeded',
      operationId: migrationOperationId,
    });
    expect(
      JSON.stringify(mockOneKeyIdAuthStateMigrationLog.mock.calls),
    ).not.toContain(accessToken);
    expect(
      JSON.stringify(mockOneKeyIdAuthStateMigrationLog.mock.calls),
    ).not.toContain('onekey-user-a');
  });

  it('anchors source-less cleanup to the empty Keyless session observed by the probe', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue(undefined);
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(0);
    simpleDbPrime.getKeylessSupabaseAuthToken.mockResolvedValue('');
    backgroundApi.serviceAccount.getKeylessWallet.mockResolvedValue({
      id: 'hd-keyless-a',
    });
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'empty',
    });

    await expect(
      service.clearOneKeyIdAuthStateIfNoActiveToken({
        callerName: 'test',
      }),
    ).resolves.toEqual({ cleared: true });

    expect(
      backgroundApi.serviceIdentityExit.reconcileMissingOneKeyIdSession,
    ).toHaveBeenCalledWith({
      callerName: 'test',
      sourceLessPreUpgradeRepair: {
        expectedOneKeyUserId: 'onekey-user-a',
        expectedEmptyKeylessSessionSlot: true,
      },
    });
  });

  it('does not recover when the Keyless OAuth profile belongs to another OneKey ID', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    const accessToken = buildFakeJwt({ sub: 'keyless-user-b' });
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue(undefined);
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(0);
    simpleDbPrime.getKeylessSupabaseAuthToken.mockResolvedValue(accessToken);
    backgroundApi.serviceAccount.getKeylessWallet.mockResolvedValue({
      id: 'hd-keyless-b',
    });
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'empty',
    });
    service.getPrimeClient = jest.fn(async () => ({
      get: jest.fn(async () => ({
        status: 200,
        data: {
          code: 0,
          data: {
            onekeyAccount: {
              onekeyUserId: 'onekey-user-b',
              status: EOneKeyIdAccountStatus.Active,
              identities: [],
            },
          },
        },
      })),
    }));

    await expect(
      service.clearOneKeyIdAuthStateIfNoActiveToken({
        callerName: 'test',
      }),
    ).resolves.toEqual({ cleared: true });

    expect(
      simpleDbPrime.setAuthSessionSourceWithCommitId,
    ).not.toHaveBeenCalled();
    expect(
      backgroundApi.serviceIdentityExit.reconcileMissingOneKeyIdSession,
    ).toHaveBeenCalledWith({
      callerName: 'test',
      sourceLessPreUpgradeRepair: {
        expectedOneKeyUserId: 'onekey-user-a',
        expectedSessionTokenSub: 'keyless-user-b',
      },
    });
    expect(mockOneKeyIdAuthStateMigrationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'profileValidation',
        status: 'blocked',
        reason: 'Keyless OAuth profile does not match the persisted OneKey ID',
      }),
    );
  });

  it('preserves source-less state and schedules a retry when the recovery probe fails transiently', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    const accessToken = buildFakeJwt({ sub: 'keyless-user-a' });
    const profileError = new OneKeyLocalError('profile request failed');
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue(undefined);
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(0);
    simpleDbPrime.getKeylessSupabaseAuthToken.mockResolvedValue(accessToken);
    backgroundApi.serviceAccount.getKeylessWallet.mockResolvedValue({
      id: 'hd-keyless-a',
    });
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'empty',
    });
    service.getPrimeClient = jest.fn(async () => ({
      get: jest.fn(async () => {
        throw profileError;
      }),
    }));

    await expect(
      service.clearOneKeyIdAuthStateIfNoActiveToken({
        callerName: 'test',
      }),
    ).resolves.toEqual({ cleared: false, retryScheduled: true });

    expect(
      simpleDbPrime.setAuthSessionSourceWithCommitId,
    ).not.toHaveBeenCalled();
    expect(
      backgroundApi.serviceIdentityExit.reconcileMissingOneKeyIdSession,
    ).not.toHaveBeenCalled();
    expect(mockOneKeyIdAuthStateMigrationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'profileValidation',
        status: 'failed',
      }),
    );
    (
      service as unknown as {
        resetSourceLessOneKeyIdRecoveryRetry: () => void;
      }
    ).resetSourceLessOneKeyIdRecoveryRetry();
  });

  it('routes a source-less retry through guarded recovery without inferring a source', async () => {
    jest.useFakeTimers();
    try {
      const { service, simpleDbPrime } = createService();
      simpleDbPrime.getAuthSessionSource.mockResolvedValue(undefined);
      const retryReachedGuardedRecovery = createDeferred();
      const clearSpy = jest
        .spyOn(service, 'clearOneKeyIdAuthStateIfNoActiveToken')
        .mockImplementation(async () => {
          retryReachedGuardedRecovery.resolve();
          return { cleared: false };
        });

      (
        service as unknown as {
          scheduleSourceLessOneKeyIdRecoveryRetry: (params: {
            callerName: string;
          }) => void;
        }
      ).scheduleSourceLessOneKeyIdRecoveryRetry({ callerName: 'test' });
      jest.advanceTimersByTime(1000);
      await retryReachedGuardedRecovery.promise;

      expect(simpleDbPrime.getActiveAuthToken).not.toHaveBeenCalled();
      expect(clearSpy).toHaveBeenCalledWith({
        callerName: 'test.sourceLessRecoveryRetry',
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not probe Keyless OAuth for a non-upgrade inconsistent state', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(undefined);
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(1);
    backgroundApi.serviceAccount.getKeylessWallet.mockResolvedValue({
      id: 'hd-keyless-a',
    });

    await expect(
      service.clearOneKeyIdAuthStateIfNoActiveToken({
        callerName: 'test',
      }),
    ).resolves.toEqual({ cleared: true });

    expect(simpleDbPrime.getKeylessSupabaseAuthToken).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.setAuthSessionSourceWithCommitId,
    ).not.toHaveBeenCalled();
    expect(
      backgroundApi.serviceIdentityExit.reconcileMissingOneKeyIdSession,
    ).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions,
    ).toHaveBeenCalledTimes(1);
    expect(mockOneKeyIdAuthStateRepairLog).toHaveBeenCalledWith({
      stage: 'stateCommit',
      status: 'succeeded',
      repairType: 'invalidLoggedInProjection',
    });
  });

  it('delegates missing-session cleanup to the durable identity coordinator', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');

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

  it('records an email OTP verification failure once in the background runtime', async () => {
    const { service } = createService();
    mockVerifyEmailOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: {
        name: 'AuthApiError',
        message: 'Invalid verification code',
        code: 'otp_expired',
        status: 400,
      },
    });

    const error = await service
      .apiEmailOtpLogin({
        email: 'next@example.com',
        otp: '111111',
      })
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(Error);
    expect((error as { message?: string }).message).toBe(
      'Invalid verification code',
    );
    expect(
      (
        error as {
          data?: { $$oneKeyIdFailureServerLogged?: boolean };
        }
      ).data?.$$oneKeyIdFailureServerLogged,
    ).toBe(true);

    expect(mockOneKeyIdLoginFailedReasonLog).toHaveBeenCalledTimes(1);
    expect(mockOneKeyIdLoginFailedReasonLog).toHaveBeenCalledWith({
      reason: expect.stringContaining(
        'ServicePrime.apiEmailOtpLogin email OTP verification failed',
      ),
    });
  });

  it('records a post-verification login failure once and marks it for the UI runtime', async () => {
    const { service } = createService();
    mockVerifyEmailOtp.mockResolvedValue({
      data: { session: { access_token: 'next-email-token' } },
      error: null,
    });
    service.apiLoginWithPersistedLegacySession = jest.fn(async () => {
      throw new OneKeyLocalError('Prime login commit failed');
    });

    const error = await service
      .apiEmailOtpLogin({
        email: 'next@example.com',
        otp: '111111',
      })
      .catch((caughtError: unknown) => caughtError);

    expect((error as { message?: string }).message).toBe(
      'Prime login commit failed',
    );
    expect(
      (
        error as {
          data?: { $$oneKeyIdFailureServerLogged?: boolean };
        }
      ).data?.$$oneKeyIdFailureServerLogged,
    ).toBe(true);
    expect(mockOneKeyIdLoginFailedReasonLog).toHaveBeenCalledTimes(1);
    expect(mockOneKeyIdLoginFailedReasonLog).toHaveBeenCalledWith({
      reason: expect.stringContaining('ServicePrime.apiEmailOtpLogin failed'),
    });
  });

  it('repairs a v6.5.0 logged-out projection before the Email login guard', async () => {
    const { service, simpleDbPrime } = createService();
    const v650LoggedOutState =
      setupV650LoggedOutProjectionWithStaleLegacySession(simpleDbPrime);
    mockVerifyEmailOtp.mockResolvedValue({
      data: { session: { access_token: 'next-email-token' } },
      error: null,
    });
    service.apiLoginWithPersistedLegacySession = jest.fn(async () => undefined);

    await expect(
      service.apiEmailOtpLogin({
        email: 'next@example.com',
        otp: '111111',
      }),
    ).resolves.toEqual({ success: true });

    expect(v650LoggedOutState.didRestoreLegacySession()).toBe(false);
    expect(mockVerifyEmailOtp).toHaveBeenCalledTimes(1);
    expect(service.apiLoginWithPersistedLegacySession).toHaveBeenCalledWith({
      accessToken: 'next-email-token',
    });
  });

  it('stops Email login when the auth state changes during repair', async () => {
    const { service, simpleDbPrime } = createService();
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: false,
      isLoggedInOnServer: false,
      onekeyUserId: undefined,
    });
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(1);
    simpleDbPrime.getIdentityLifecycleRevision
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(8);

    await expect(
      service.apiEmailOtpLogin({
        email: 'next@example.com',
        otp: '111111',
      }),
    ).rejects.toThrow('auth state changed during recovery');

    expect(mockVerifyEmailOtp).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions,
    ).not.toHaveBeenCalled();
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

describe('ServicePrime.claimOneKeyIdOAuthBindPrompt', () => {
  function mockOneKeyIdCredentialReady(
    service: ReturnType<typeof createService>['service'],
  ) {
    return jest.spyOn(service, 'apiFetchPrimeUserInfo').mockResolvedValue({
      userInfo: {
        onekeyUserId: 'user-1',
        isLoggedIn: true,
        isLoggedInOnServer: true,
      } as any,
      serverUserInfo: undefined,
      primeSubscription: undefined,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('still upgrades credentials without rechecking bind state when already reminded', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    const fetchUserInfoSpy = jest.spyOn(service, 'apiFetchPrimeUserInfo');
    simpleDbPrime.getOneKeyIdOAuthBindPromptUpgradeState.mockResolvedValue({
      hasShown: true,
      credentialUpgradeCompleted: false,
      identityLifecycleRevision: 7,
    });
    const bindRequiredSpy = jest.spyOn(
      service,
      'isLegacyOneKeyIdOAuthBindRequired',
    );

    await expect(
      service.claimOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toEqual({ status: 'skip' });

    expect(bindRequiredSpy).not.toHaveBeenCalled();
    expect(fetchUserInfoSpy).not.toHaveBeenCalled();
    expect(
      backgroundApi.serviceKeylessWallet
        .ensureKeylessCredentialReadyForOneKeyIdBind,
    ).toHaveBeenCalledTimes(1);
    expect(
      simpleDbPrime.markOneKeyIdKeylessCredentialUpgradeCompleted,
    ).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      expectedIdentityLifecycleRevision: 7,
    });
    expect(
      simpleDbPrime.markOneKeyIdOAuthBindPromptShown,
    ).not.toHaveBeenCalled();
  });

  it('skips profile and credential work after both upgrade gates complete', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    const fetchUserInfoSpy = jest.spyOn(service, 'apiFetchPrimeUserInfo');
    simpleDbPrime.getOneKeyIdOAuthBindPromptUpgradeState.mockResolvedValue({
      hasShown: true,
      credentialUpgradeCompleted: true,
      identityLifecycleRevision: 7,
    });
    const bindRequiredSpy = jest.spyOn(
      service,
      'isLegacyOneKeyIdOAuthBindRequired',
    );

    await expect(
      service.claimOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toEqual({ status: 'skip' });

    expect(fetchUserInfoSpy).not.toHaveBeenCalled();
    expect(bindRequiredSpy).not.toHaveBeenCalled();
    expect(
      backgroundApi.serviceKeylessWallet
        .ensureKeylessCredentialReadyForOneKeyIdBind,
    ).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.markOneKeyIdKeylessCredentialUpgradeCompleted,
    ).not.toHaveBeenCalled();
  });

  it('does not fetch profile or mark completion when an old reminder still needs passcode', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    const fetchUserInfoSpy = jest.spyOn(service, 'apiFetchPrimeUserInfo');
    simpleDbPrime.getOneKeyIdOAuthBindPromptUpgradeState.mockResolvedValue({
      hasShown: true,
      credentialUpgradeCompleted: false,
      identityLifecycleRevision: 7,
    });
    backgroundApi.serviceKeylessWallet.ensureKeylessCredentialReadyForOneKeyIdBind.mockResolvedValue(
      {
        status: 'requiresPasscode',
        hasLocalKeylessWallet: true,
      },
    );

    await expect(
      service.claimOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toEqual({ status: 'skip' });

    expect(fetchUserInfoSpy).not.toHaveBeenCalled();
    expect(
      backgroundApi.serviceKeylessWallet
        .ensureKeylessCredentialReadyForOneKeyIdBind,
    ).toHaveBeenCalledTimes(1);
    expect(
      simpleDbPrime.markOneKeyIdKeylessCredentialUpgradeCompleted,
    ).not.toHaveBeenCalled();
  });

  it('retries when the identity lifecycle changes during credential readiness', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    simpleDbPrime.getOneKeyIdOAuthBindPromptUpgradeState.mockResolvedValue({
      hasShown: false,
      credentialUpgradeCompleted: false,
      identityLifecycleRevision: 7,
    });
    mockOneKeyIdCredentialReady(service);
    backgroundApi.serviceKeylessWallet.ensureKeylessCredentialReadyForOneKeyIdBind.mockResolvedValue(
      {
        status: 'ready',
        hasLocalKeylessWallet: true,
      },
    );
    simpleDbPrime.markOneKeyIdKeylessCredentialUpgradeCompleted.mockResolvedValue(
      false,
    );
    const bindRequiredSpy = jest.spyOn(
      service,
      'isLegacyOneKeyIdOAuthBindRequired',
    );

    await expect(
      service.claimOneKeyIdOAuthBindPrompt({ onekeyUserId: 'user-1' }),
    ).resolves.toEqual({ status: 'retryable' });

    expect(
      simpleDbPrime.markOneKeyIdKeylessCredentialUpgradeCompleted,
    ).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      expectedIdentityLifecycleRevision: 7,
    });
    expect(bindRequiredSpy).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.markOneKeyIdOAuthBindPromptShown,
    ).not.toHaveBeenCalled();
  });

  it('claims the reminder without consuming it when binding is required', async () => {
    const { service, simpleDbPrime } = createService();
    mockOneKeyIdCredentialReady(service);
    jest
      .spyOn(service, 'isLegacyOneKeyIdOAuthBindRequired')
      .mockResolvedValue(true);

    await expect(
      service.claimOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toEqual({
      status: 'claimed',
      claimId: expect.any(String),
    });

    expect(simpleDbPrime.tryClaimOneKeyIdOAuthBindPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        onekeyUserId: 'user-1',
        claimId: expect.any(String),
      }),
    );
    expect(
      simpleDbPrime.markOneKeyIdOAuthBindPromptShown,
    ).not.toHaveBeenCalled();
  });

  it('consumes the decision when binding is not required', async () => {
    const { service, simpleDbPrime } = createService();
    mockOneKeyIdCredentialReady(service);
    jest
      .spyOn(service, 'isLegacyOneKeyIdOAuthBindRequired')
      .mockResolvedValue(false);

    await expect(
      service.claimOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toEqual({ status: 'skip' });

    expect(simpleDbPrime.markOneKeyIdOAuthBindPromptShown).toHaveBeenCalledWith(
      { onekeyUserId: 'user-1' },
    );
    expect(
      simpleDbPrime.tryClaimOneKeyIdOAuthBindPrompt,
    ).not.toHaveBeenCalled();
  });

  it('shows the bind reminder when only the legacy OneKey ID credential exists', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    mockOneKeyIdCredentialReady(service);
    backgroundApi.serviceKeylessWallet.ensureKeylessCredentialReadyForOneKeyIdBind.mockResolvedValue(
      {
        status: 'noLocalKeyless',
        hasLocalKeylessWallet: false,
      },
    );
    jest
      .spyOn(service, 'isLegacyOneKeyIdOAuthBindRequired')
      .mockResolvedValue(true);

    await expect(
      service.claimOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toEqual({
      status: 'claimed',
      claimId: expect.any(String),
    });
    expect(simpleDbPrime.tryClaimOneKeyIdOAuthBindPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ onekeyUserId: 'user-1' }),
    );
    expect(
      simpleDbPrime.markOneKeyIdOAuthBindPromptShown,
    ).not.toHaveBeenCalled();
  });

  it('does not consume the reminder when the profile check fails', async () => {
    const { service, simpleDbPrime } = createService();
    mockOneKeyIdCredentialReady(service);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    jest
      .spyOn(service, 'isLegacyOneKeyIdOAuthBindRequired')
      .mockRejectedValue(new Error('network failed'));

    await expect(
      service.claimOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toEqual({ status: 'retryable' });

    expect(
      simpleDbPrime.markOneKeyIdOAuthBindPromptShown,
    ).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('waits for the OneKey ID credential upgrade before probing Keyless', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    jest.spyOn(service, 'apiFetchPrimeUserInfo').mockResolvedValue({
      userInfo: {
        onekeyUserId: 'user-1',
        isLoggedIn: false,
        isLoggedInOnServer: false,
      } as any,
      serverUserInfo: undefined,
      primeSubscription: undefined,
    });

    await expect(
      service.claimOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toEqual({ status: 'skip' });
    expect(
      backgroundApi.serviceKeylessWallet
        .ensureKeylessCredentialReadyForOneKeyIdBind,
    ).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.markOneKeyIdOAuthBindPromptShown,
    ).not.toHaveBeenCalled();
  });

  it('does not consume the optional reminder while Keyless migration is retryable', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    mockOneKeyIdCredentialReady(service);
    backgroundApi.serviceKeylessWallet.ensureKeylessCredentialReadyForOneKeyIdBind.mockResolvedValue(
      {
        status: 'retryableIndeterminate',
        hasLocalKeylessWallet: true,
      },
    );
    const bindRequiredSpy = jest.spyOn(
      service,
      'isLegacyOneKeyIdOAuthBindRequired',
    );

    await expect(
      service.claimOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toEqual({ status: 'retryable' });
    expect(bindRequiredSpy).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.markOneKeyIdOAuthBindPromptShown,
    ).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.markOneKeyIdKeylessCredentialUpgradeCompleted,
    ).not.toHaveBeenCalled();
  });

  it('allows the reminder when Keyless migration requires passcode on click', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    mockOneKeyIdCredentialReady(service);
    backgroundApi.serviceKeylessWallet.ensureKeylessCredentialReadyForOneKeyIdBind.mockResolvedValue(
      {
        status: 'requiresPasscode',
        hasLocalKeylessWallet: true,
      },
    );
    jest
      .spyOn(service, 'isLegacyOneKeyIdOAuthBindRequired')
      .mockResolvedValue(true);

    await expect(
      service.claimOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toEqual({
      status: 'claimed',
      claimId: expect.any(String),
    });
    expect(simpleDbPrime.tryClaimOneKeyIdOAuthBindPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ onekeyUserId: 'user-1' }),
    );
    expect(
      simpleDbPrime.markOneKeyIdOAuthBindPromptShown,
    ).not.toHaveBeenCalled();
  });

  it('waits for the legacy Keyless credential before consuming the upgrade reminder', async () => {
    const { service, backgroundApi, simpleDbPrime } = createService();
    mockOneKeyIdCredentialReady(service);
    const bindRequiredSpy = jest
      .spyOn(service, 'isLegacyOneKeyIdOAuthBindRequired')
      .mockResolvedValue(true);
    backgroundApi.serviceKeylessWallet.ensureKeylessCredentialReadyForOneKeyIdBind
      .mockResolvedValueOnce({
        status: 'retryableIndeterminate',
        hasLocalKeylessWallet: true,
      })
      .mockResolvedValueOnce({
        status: 'ready',
        hasLocalKeylessWallet: true,
      });

    await expect(
      service.claimOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toEqual({ status: 'retryable' });
    expect(bindRequiredSpy).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.markOneKeyIdOAuthBindPromptShown,
    ).not.toHaveBeenCalled();

    await expect(
      service.claimOneKeyIdOAuthBindPrompt({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toEqual({
      status: 'claimed',
      claimId: expect.any(String),
    });
    expect(bindRequiredSpy).toHaveBeenCalledTimes(1);
    expect(simpleDbPrime.tryClaimOneKeyIdOAuthBindPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ onekeyUserId: 'user-1' }),
    );
    expect(
      simpleDbPrime.markOneKeyIdOAuthBindPromptShown,
    ).not.toHaveBeenCalled();
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
      service.getBoundOAuthProvidersForCurrentOneKeyId(),
    ).resolves.toEqual([EOAuthSocialLoginProvider.Google]);
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

describe('ServicePrime.apiPromoteBoundOAuthSessionForLegacyOneKeyId', () => {
  const LEGACY_TOKEN = 'legacy-token-a';
  const OAUTH_TOKEN = buildFakeJwt({
    sub: 'keyless-user-a',
    session_id: 'keyless-session-a',
    user_metadata: { sub: 'google-sub-a' },
  });

  function buildAccount({
    onekeyUserId = 'onekey-user-a',
    oauthSubject = 'google-sub-a',
  }: {
    onekeyUserId?: string;
    oauthSubject?: string;
  } = {}) {
    return {
      onekeyUserId,
      status: EOneKeyIdAccountStatus.Active,
      normalizedEmail: 'a@example.com',
      displayEmail: 'a@example.com',
      identities: [
        {
          identityType: EOneKeyIdIdentityType.LegacyEmail,
          legacyEmail: 'a@example.com',
        },
        {
          identityType: EOneKeyIdIdentityType.OAuth,
          oauthProvider: EOneKeyIdOAuthProvider.Google,
          oauthSubject,
        },
      ],
    };
  }

  function setupPromotion() {
    const { service, simpleDbPrime } = createService();
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    simpleDbPrime.getActiveAuthToken.mockResolvedValue(LEGACY_TOKEN);
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(3);
    mockReadPersistedAccessTokenBySessionSourceStrict.mockImplementation(
      async (source: unknown) => ({
        status: 'ok',
        accessToken:
          source === EPrimeAuthSessionSource.LegacyEmailSupabase
            ? LEGACY_TOKEN
            : OAUTH_TOKEN,
      }),
    );
    const get = jest.fn(async () => ({
      data: { data: { onekeyAccount: buildAccount() } },
    }));
    const post = jest.fn(async () => ({
      data: {
        data: {
          userId: 'onekey-user-a',
          onekeyAccount: buildAccount(),
        },
      },
    }));
    service.getPrimeClient = jest.fn(async () => ({ get, post }));
    return { service, simpleDbPrime, get, post };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockReadPersistedAccessTokenBySessionSourceStrict.mockReset();
  });

  afterEach(() => {
    mockPrimePersistAtom.get.mockImplementation(async () => ({}));
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: 'persisted-access-token',
    });
  });

  it('promotes an already-bound OAuth identity from the legacy Email session', async () => {
    const { service, simpleDbPrime, get, post } = setupPromotion();

    await service.apiPromoteBoundOAuthSessionForLegacyOneKeyId({
      accessToken: OAUTH_TOKEN,
      provider: EOAuthSocialLoginProvider.Google,
      expectedOnekeyUserId: 'onekey-user-a',
    });

    expect(get).toHaveBeenCalledWith('/prime/v1/account/profile', {
      headers: {
        'X-Onekey-Request-Token': LEGACY_TOKEN,
      },
    });
    expect(post).toHaveBeenCalledWith(
      '/prime/v1/account/oauth/login',
      {},
      {
        headers: {
          'X-Onekey-Request-Token': OAUTH_TOKEN,
        },
      },
    );
    expect(simpleDbPrime.setAuthSessionSourceWithCommitId).toHaveBeenCalledWith(
      {
        authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
        sessionCommitId: expect.any(String),
      },
    );
    expect(simpleDbPrime.clearLegacyAuthSession).toHaveBeenCalledTimes(1);
  });

  it('rejects an OAuth identity that is not bound to the current OneKey ID', async () => {
    const { service, simpleDbPrime, get, post } = setupPromotion();
    get.mockResolvedValueOnce({
      data: {
        data: {
          onekeyAccount: buildAccount({
            oauthSubject: 'different-google-sub',
          }),
        },
      },
    });

    await expect(
      service.apiPromoteBoundOAuthSessionForLegacyOneKeyId({
        accessToken: OAUTH_TOKEN,
        provider: EOAuthSocialLoginProvider.Google,
        expectedOnekeyUserId: 'onekey-user-a',
      }),
    ).rejects.toThrow('OAuth identity is not bound');

    expect(post).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.setAuthSessionSourceWithCommitId,
    ).not.toHaveBeenCalled();
  });

  it('rejects an inconsistent OneKey ID login projection', async () => {
    const { service, simpleDbPrime, get, post } = setupPromotion();
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: false,
      onekeyUserId: 'onekey-user-a',
    });

    await expect(
      service.apiPromoteBoundOAuthSessionForLegacyOneKeyId({
        accessToken: OAUTH_TOKEN,
        provider: EOAuthSocialLoginProvider.Google,
        expectedOnekeyUserId: 'onekey-user-a',
      }),
    ).rejects.toThrow('login changed during OAuth verification');

    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(simpleDbPrime.getActiveAuthToken).not.toHaveBeenCalled();
  });

  it('rejects when the legacy OneKey ID changes during the profile check', async () => {
    const { service, simpleDbPrime, get, post } = setupPromotion();
    let authStateGeneration = 3;
    simpleDbPrime.getAuthStateGeneration.mockImplementation(
      async () => authStateGeneration,
    );
    get.mockImplementationOnce(async () => {
      authStateGeneration = 4;
      return {
        data: { data: { onekeyAccount: buildAccount() } },
      };
    });

    await expect(
      service.apiPromoteBoundOAuthSessionForLegacyOneKeyId({
        accessToken: OAUTH_TOKEN,
        provider: EOAuthSocialLoginProvider.Google,
        expectedOnekeyUserId: 'onekey-user-a',
      }),
    ).rejects.toThrow('login changed during OAuth verification');

    expect(post).not.toHaveBeenCalled();
    expect(
      simpleDbPrime.setAuthSessionSourceWithCommitId,
    ).not.toHaveBeenCalled();
  });

  it('rejects a login response resolving to a different OneKey ID', async () => {
    const { service, simpleDbPrime, post } = setupPromotion();
    post.mockResolvedValueOnce({
      data: {
        data: {
          userId: 'onekey-user-b',
          onekeyAccount: buildAccount({ onekeyUserId: 'onekey-user-b' }),
        },
      },
    });

    await expect(
      service.apiPromoteBoundOAuthSessionForLegacyOneKeyId({
        accessToken: OAUTH_TOKEN,
        provider: EOAuthSocialLoginProvider.Google,
        expectedOnekeyUserId: 'onekey-user-a',
      }),
    ).rejects.toThrow('OAuth login resolved a different OneKey ID');

    expect(
      simpleDbPrime.setAuthSessionSourceWithCommitId,
    ).not.toHaveBeenCalled();
    expect(simpleDbPrime.clearLegacyAuthSession).not.toHaveBeenCalled();
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

  it('repairs a v6.5.0 logged-out projection before the OAuth login guard', async () => {
    const { service, simpleDbPrime } = createService();
    const post = mockOAuthLoginClient(service);
    const v650LoggedOutState =
      setupV650LoggedOutProjectionWithStaleLegacySession(simpleDbPrime);

    await expect(
      service.apiOAuthLogin({
        accessToken: buildFakeJwt({ sub: 'user-a' }),
      }),
    ).resolves.toBeDefined();

    expect(v650LoggedOutState.didRestoreLegacySession()).toBe(false);
    expect(post).toHaveBeenCalledTimes(1);
    expect(
      simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions,
    ).toHaveBeenCalledTimes(1);
  });

  it('keeps the ordinary OAuth login blocked while OneKey ID is already logged in', async () => {
    const { service, simpleDbPrime } = createService();
    const post = mockOAuthLoginClient(service);
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'onekey-user-a',
    });
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(1);

    await expect(
      service.apiOAuthLogin({
        accessToken: buildFakeJwt({ sub: 'user-a' }),
      }),
    ).rejects.toThrow('OneKey ID is already logged in');

    expect(post).not.toHaveBeenCalled();
    expect(mockToastIfErrorMethods).toContain('apiOAuthLogin');
    expect(mockOneKeyIdLoginFailedReasonLog).toHaveBeenCalledWith({
      reason: expect.stringContaining('OneKey ID is already logged in'),
    });
    expect(
      simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions,
    ).not.toHaveBeenCalled();
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

  it('repairs stale logged-in metadata before persisting a new login session', async () => {
    const { service, simpleDbPrime } = createService();
    let authSessionSource:
      | typeof EPrimeAuthSessionSource.KeylessOAuth
      | undefined = EPrimeAuthSessionSource.KeylessOAuth;
    let oneKeyIdAuthState: 'loggedIn' | 'loggedOut' = 'loggedIn';
    let identityLifecycleRevision = 7;
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: false,
      isLoggedInOnServer: false,
      onekeyUserId: undefined,
    });
    simpleDbPrime.getAuthSessionSource.mockImplementation(
      async () => authSessionSource,
    );
    simpleDbPrime.getEffectiveAuthSessionSource.mockImplementation(
      async () => authSessionSource,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockImplementation(
      async () => oneKeyIdAuthState,
    );
    simpleDbPrime.getIdentityLifecycleRevision.mockImplementation(
      async () => identityLifecycleRevision,
    );
    simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions.mockImplementation(
      async () => {
        authSessionSource = undefined;
        oneKeyIdAuthState = 'loggedOut';
      },
    );
    simpleDbPrime.bumpIdentityLifecycleRevision.mockImplementation(async () => {
      identityLifecycleRevision += 1;
      return identityLifecycleRevision;
    });
    const nextAccessToken = buildFakeJwt({ sub: 'user-b' });

    await expect(
      service.persistKeylessOAuthSession({
        accessToken: nextAccessToken,
        refreshToken: 'refresh-b',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        identityLifecycleRevision: expect.any(Number),
        rollbackHandle: expect.any(String),
      }),
    );

    expect(
      simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions,
    ).toHaveBeenCalledTimes(1);
    expect(mockPersistKeylessAuthSession).toHaveBeenCalledWith({
      accessToken: nextAccessToken,
      refreshToken: 'refresh-b',
    });
  });

  it('persists a new Keyless session from the exact v6.5.0 logged-out data shape', async () => {
    const { service, simpleDbPrime } = createService();
    const v650LoggedOutState =
      setupV650LoggedOutProjectionWithStaleLegacySession(simpleDbPrime);
    const nextAccessToken = buildFakeJwt({ sub: 'user-b' });

    await expect(
      service.persistKeylessOAuthSession({
        accessToken: nextAccessToken,
        refreshToken: 'refresh-b',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        identityLifecycleRevision: expect.any(Number),
        rollbackHandle: expect.any(String),
      }),
    );

    expect(v650LoggedOutState.didRestoreLegacySession()).toBe(false);
    expect(mockPersistKeylessAuthSession).toHaveBeenCalledWith({
      accessToken: nextAccessToken,
      refreshToken: 'refresh-b',
    });
    expect(mockOneKeyIdAuthStateRepairLog).toHaveBeenCalledWith({
      stage: 'stateCommit',
      status: 'succeeded',
      repairType: 'legacyLoggedOutWithoutTombstone',
    });
  });

  it('does not repair stale metadata after the identity lifecycle changes', async () => {
    const { service, simpleDbPrime } = createService();
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: false,
      isLoggedInOnServer: false,
      onekeyUserId: undefined,
    });
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    simpleDbPrime.getIdentityLifecycleRevision
      .mockResolvedValueOnce(7)
      .mockResolvedValue(8);

    await expect(
      service.persistKeylessOAuthSession({
        accessToken: buildFakeJwt({ sub: 'user-b' }),
        refreshToken: 'refresh-b',
      }),
    ).rejects.toThrow('auth state changed during recovery');

    expect(
      simpleDbPrime.markOneKeyIdLoggedOutPreservingSessions,
    ).not.toHaveBeenCalled();
    expect(mockPersistKeylessAuthSession).not.toHaveBeenCalled();
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

  it('waits for an active identity mutation before reserving and journaling persistence', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    let releaseMutation: (() => void) | undefined;
    let markMutationEntered: (() => void) | undefined;
    const mutationEntered = new Promise<void>((resolve) => {
      markMutationEntered = resolve;
    });
    const mutationRelease = new Promise<void>((resolve) => {
      releaseMutation = resolve;
    });
    const activeMutation = identityLifecycleMutex.runExclusive(async () => {
      markMutationEntered?.();
      await mutationRelease;
    });
    await mutationEntered;

    const persistence = (
      service as unknown as {
        persistKeylessOAuthSessionWithinLifecycle: (params: {
          accessToken: string;
          refreshToken: string;
        }) => Promise<unknown>;
      }
    ).persistKeylessOAuthSessionWithinLifecycle({
      accessToken: buildFakeJwt({ sub: 'independent-keyless-user' }),
      refreshToken: 'refresh-independent',
    });

    expect(getActiveIdentityLifecycleOperationId()).toBeUndefined();
    expect(
      simpleDbPrime.setKeylessOAuthSessionPersistenceJournal,
    ).not.toHaveBeenCalled();
    releaseMutation?.();
    await activeMutation;
    await persistence;
    expect(
      simpleDbPrime.setKeylessOAuthSessionPersistenceJournal,
    ).toHaveBeenCalledTimes(1);
    expect(getActiveIdentityLifecycleOperationId()).toBeUndefined();
  });

  it('keeps the lifecycle reservation active through the session-slot write', async () => {
    const { service, simpleDbPrime } = createService();
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    simpleDbPrime.getOneKeyIdAuthState.mockResolvedValue('loggedIn');
    mockPersistKeylessAuthSession.mockImplementationOnce(
      async (params: unknown) => {
        expect(getActiveIdentityLifecycleOperationId()).toMatch(
          /^keylessSession:/,
        );
        const { accessToken } = params as { accessToken: string };
        mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
          status: 'ok',
          accessToken,
        });
      },
    );

    await service.persistKeylessOAuthSession({
      accessToken: buildFakeJwt({ sub: 'independent-keyless-user' }),
      refreshToken: 'refresh-independent',
    });

    expect(getActiveIdentityLifecycleOperationId()).toBeUndefined();
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

  it('clears this flow own provisional session on a guarded rollback', async () => {
    // The legacy-bind abort path relies on this: since the rollback is
    // ownership-guarded, the caller must NOT be exempted from cleanup.
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

    await expect(
      service.rollbackProvisionalKeylessOAuthSession({ rollbackHandle }),
    ).resolves.toEqual({ cleared: true });
    expect(mockRemoveAuthSessionStorageBySessionSource).toHaveBeenCalledTimes(
      1,
    );
  });

  it('preserves a session that now backs a committed KeylessOAuth login', async () => {
    // The concurrent-flow case the cleanup exemption used to protect: the
    // rollback itself refuses once the slot backs a committed login, so no
    // caller-side exemption is needed to keep the winning session.
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
    // A concurrent KeylessOAuth login committed while the bind was aborting.
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.KeylessOAuth,
    );

    await expect(
      service.rollbackProvisionalKeylessOAuthSession({ rollbackHandle }),
    ).resolves.toEqual({ cleared: false });
    expect(mockRemoveAuthSessionStorageBySessionSource).not.toHaveBeenCalled();
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
      allowRevisionRebase: true,
    });
  });

  it('abandons a conflicted journal and removes only its exact persisted session', async () => {
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
        status: 'stateChanged',
      },
    );
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: buildFakeJwt({ sub: 'user-a' }),
    });

    await expect(
      service.recoverInterruptedKeylessOAuthSessionPersistence(),
    ).resolves.toEqual({ recovered: false, abandoned: true });
    expect(mockRemoveAuthSessionStorageBySessionSource).toHaveBeenCalledWith(
      EPrimeAuthSessionSource.KeylessOAuth,
    );
    expect(
      simpleDbPrime.removeKeylessOAuthSessionPersistenceJournal,
    ).toHaveBeenCalledWith({ operationId: 'operation-1' });
    expect(isIdentityRecoveryReady()).toBe(true);
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

  it('repairs a v6.5.0 logged-out projection before a fresh OAuth login', async () => {
    const { service, simpleDbPrime } = createService();
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
    const v650LoggedOutState =
      setupV650LoggedOutProjectionWithStaleLegacySession(simpleDbPrime);

    await expect(
      service.apiOAuthLoginWithFreshSessionForLoggedOutState({
        accessToken,
        refreshToken: 'refresh-a',
      }),
    ).resolves.toBeDefined();

    expect(v650LoggedOutState.didRestoreLegacySession()).toBe(false);
    expect(mockPersistKeylessAuthSession).toHaveBeenCalledWith({
      accessToken,
      refreshToken: 'refresh-a',
    });
    expect(post).toHaveBeenCalledTimes(1);
  });

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

describe('ServicePrime.apiBindLegacyOneKeyIdOAuth legacy identity guard', () => {
  const LEGACY_TOKEN = 'legacy-token-a';
  const OAUTH_TOKEN = buildFakeJwt({ sub: 'oauth-sub-a' });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-a',
    });
    mockReadPersistedAccessTokenBySessionSourceStrict.mockReset();
  });

  afterEach(() => {
    mockPrimePersistAtom.get.mockImplementation(async () => ({}));
    mockReadPersistedAccessTokenBySessionSourceStrict.mockResolvedValue({
      status: 'ok',
      accessToken: 'persisted-access-token',
    });
  });

  // Source-aware slot reads: the legacy snapshot reads the LegacyEmailSupabase
  // slot while the keyless guard (and the post-POST commit) read the shared
  // KeylessOAuth slot.
  function mockSlots({ legacyToken = LEGACY_TOKEN } = {}) {
    mockReadPersistedAccessTokenBySessionSourceStrict.mockImplementation(
      async (source: unknown) => ({
        status: 'ok',
        accessToken:
          source === EPrimeAuthSessionSource.LegacyEmailSupabase
            ? legacyToken
            : OAUTH_TOKEN,
      }),
    );
  }

  function createBindService({
    tokenOwnerOnekeyUserId = 'user-a',
    authSessionSource = EPrimeAuthSessionSource.LegacyEmailSupabase,
    authStateGeneration = 7,
  }: {
    tokenOwnerOnekeyUserId?: string;
    authSessionSource?: unknown;
    authStateGeneration?: number;
  } = {}) {
    const { service, simpleDbPrime, backgroundApi } = createService();
    simpleDbPrime.getActiveAuthToken.mockResolvedValue(LEGACY_TOKEN);
    simpleDbPrime.getAuthSessionSource.mockResolvedValue(authSessionSource);
    // The invalid-token coordinator resolves the source through the
    // effective-source reader, so keep both in sync.
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(
      authSessionSource,
    );
    simpleDbPrime.getAuthStateGeneration.mockResolvedValue(authStateGeneration);
    mockSlots();

    const get = jest.fn(async () => ({
      status: 200,
      data: {
        code: 0,
        data: {
          onekeyAccount: { onekeyUserId: tokenOwnerOnekeyUserId },
        },
      },
    }));
    const post = jest.fn(async () => ({
      data: {
        data: {
          onekeyAccount: {
            onekeyUserId: 'user-a',
            normalizedEmail: 'a@example.com',
            displayEmail: 'a@example.com',
          },
        },
      },
    }));
    service.getPrimeClient = jest.fn(async () => ({ get, post }));
    service.apiFetchPrimeUserInfo = jest.fn(async () => undefined);
    return { service, simpleDbPrime, backgroundApi, get, post };
  }

  function bind(service: any, expectedOnekeyUserId = 'user-a') {
    return service.apiBindLegacyOneKeyIdOAuth({
      oauthAccessToken: OAUTH_TOKEN,
      expectedOnekeyUserId,
    });
  }

  it('binds with the token bytes whose server-side owner is the consented account', async () => {
    const { service, get, post } = createBindService();

    await expect(bind(service)).resolves.toEqual(
      expect.objectContaining({
        onekeyAccount: expect.objectContaining({ onekeyUserId: 'user-a' }),
      }),
    );

    // Ownership probe pinned to the exact captured legacy token, and the
    // bind POST carries those same bytes (never a re-read).
    expect(get).toHaveBeenCalledWith('/prime/v1/account/profile', {
      autoHandleError: false,
      headers: {
        'X-Onekey-Request-Token': LEGACY_TOKEN,
      },
    });
    // The POST must be pinned to the same verified bytes: without an
    // explicit header the client interceptor would inject a fresh slot read,
    // so a slot swap after the probe would authenticate the irreversible
    // bind as a different account than the one just verified.
    expect(post).toHaveBeenCalledWith(
      '/prime/v1/account/identities/oauth/bind',
      {
        token: OAUTH_TOKEN,
        legacyOneKeyIdAuthToken: LEGACY_TOKEN,
      },
      {
        headers: {
          'X-Onekey-Request-Token': LEGACY_TOKEN,
        },
      },
    );
  });

  it('aborts when the live login already flipped to KeylessOAuth (stale legacy slot)', async () => {
    // Post-commit legacy cleanup failures are deliberately tolerated, so a
    // residual legacy token can coexist with a live KeylessOAuth login.
    const { service, get, post } = createBindService({
      authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
    });

    await expect(bind(service)).rejects.toMatchObject({
      className:
        EOneKeyErrorClassNames.OneKeyErrorOneKeyIdLegacyBindStateChanged,
    });

    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('aborts when the logged-in account changed since the user consented', async () => {
    const { service, get, post } = createBindService();
    mockPrimePersistAtom.get.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-b',
    });

    await expect(bind(service, 'user-a')).rejects.toMatchObject({
      className:
        EOneKeyErrorClassNames.OneKeyErrorOneKeyIdLegacyBindStateChanged,
    });

    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('aborts when OneKey ID is logged out', async () => {
    const { service, get, post } = createBindService();
    mockPrimePersistAtom.get.mockResolvedValue({ isLoggedIn: false });

    await expect(bind(service)).rejects.toMatchObject({
      className:
        EOneKeyErrorClassNames.OneKeyErrorOneKeyIdLegacyBindStateChanged,
    });

    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('aborts when the captured legacy token is not the bytes persisted in the slot', async () => {
    const { service, get, post } = createBindService();
    mockSlots({ legacyToken: 'another-legacy-token' });

    await expect(bind(service)).rejects.toMatchObject({
      className:
        EOneKeyErrorClassNames.OneKeyErrorOneKeyIdLegacyBindStateChanged,
    });

    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('aborts when the server says the captured token belongs to another account', async () => {
    // Split-runtime TOCTOU: the main runtime wrote account B's session into
    // the shared legacy slot (verifyOtp) while its apiLogin is still queued
    // on this loginMutex, so the bg atom/generation still show the consented
    // account A and every local check is self-consistent. Only the server can
    // tell whose token this is.
    const { service, get, post } = createBindService({
      tokenOwnerOnekeyUserId: 'user-b',
    });

    await expect(bind(service, 'user-a')).rejects.toMatchObject({
      className:
        EOneKeyErrorClassNames.OneKeyErrorOneKeyIdLegacyBindStateChanged,
    });

    expect(get).toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('aborts when the token owner cannot be resolved', async () => {
    const { service, post } = createBindService();
    service.getPrimeClient = jest.fn(async () => ({
      get: jest.fn(async () => ({
        status: 200,
        data: { code: 0, data: {} },
      })),
      post,
    }));

    await expect(bind(service)).rejects.toMatchObject({
      className:
        EOneKeyErrorClassNames.OneKeyErrorOneKeyIdLegacyBindStateChanged,
    });

    expect(post).not.toHaveBeenCalled();
  });

  it('aborts when the auth state generation advances across the ownership probe', async () => {
    const { service, simpleDbPrime, post } = createBindService();
    let probed = false;
    service.getPrimeClient = jest.fn(async () => ({
      get: jest.fn(async () => {
        probed = true;
        // A login commit landed while the probe was in flight.
        simpleDbPrime.getAuthStateGeneration.mockResolvedValue(8);
        return {
          status: 200,
          data: {
            code: 0,
            data: { onekeyAccount: { onekeyUserId: 'user-a' } },
          },
        };
      }),
      post,
    }));

    await expect(bind(service)).rejects.toMatchObject({
      className:
        EOneKeyErrorClassNames.OneKeyErrorOneKeyIdLegacyBindStateChanged,
    });

    expect(probed).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it('reclassifies an invalid legacy token instead of reporting a login change', async () => {
    // autoHandleError: false makes the interceptor skip its code!==0 branch,
    // so a rejected token resolves normally. Collapsing that into the
    // state-changed error would tell the user to retry something that can
    // never succeed, skip the invalid-token teardown, and (via the cleanup
    // exemption) strand this flow's provisional keyless session.
    const { service, post, backgroundApi } = createBindService();
    service.getPrimeClient = jest.fn(async () => ({
      get: jest.fn(async () => ({
        status: 200,
        data: { code: 90_002, message: 'token expired', data: undefined },
      })),
      post,
    }));

    // This class carries no className override, so match the type itself —
    // that is what handlePrimeLoginInvalidToken keys off.
    await expect(bind(service)).rejects.toBeInstanceOf(
      OneKeyErrorPrimeLoginInvalidToken,
    );

    expect(post).not.toHaveBeenCalled();
    // autoHandleError:false bypasses the client's invalid-token interceptor,
    // so the bind must hand the CAPTURED token to the coordinator itself —
    // otherwise the dead session stays logged in after the abort.
    expect(
      backgroundApi.serviceIdentityExit.stageRemoteOneKeyIdLogoutReconciliation,
    ).toHaveBeenCalledWith({ expectedAccessToken: LEGACY_TOKEN });
  });

  it('still surfaces the invalid-token cause when reconciliation itself fails', async () => {
    // The coordinator is a best-effort side effect; letting its failure
    // escape would replace the real cause with a confusing secondary error.
    const { service, post, simpleDbPrime } = createBindService();
    simpleDbPrime.getEffectiveAuthSessionSource.mockResolvedValue(undefined);
    service.getPrimeClient = jest.fn(async () => ({
      get: jest.fn(async () => ({
        status: 200,
        data: { code: 90_002, message: 'token expired', data: undefined },
      })),
      post,
    }));

    await expect(bind(service)).rejects.toBeInstanceOf(
      OneKeyErrorPrimeLoginInvalidToken,
    );

    expect(post).not.toHaveBeenCalled();
  });

  it('surfaces a non-auth server error from the probe as a server error', async () => {
    const { service, post } = createBindService();
    service.getPrimeClient = jest.fn(async () => ({
      get: jest.fn(async () => ({
        status: 200,
        data: { code: 50_000, message: 'boom', data: undefined },
      })),
      post,
    }));

    await expect(bind(service)).rejects.toMatchObject({
      className: EOneKeyErrorClassNames.OneKeyServerApiError,
    });

    expect(post).not.toHaveBeenCalled();
  });

  it('checks the keyless slot after the probe to keep the guard->POST window at one request', async () => {
    // The probe added a round-trip; running the keyless guard before it would
    // stretch the uncovered window from one POST to GET + POST, and the
    // snapshot re-check only re-validates the legacy side.
    const { service } = createBindService();
    const calls: string[] = [];
    const keylessGuard = jest
      .spyOn(service, 'assertKeylessSessionPersistedBeforeLogin')
      .mockImplementation(async () => {
        calls.push('keylessGuard');
        return { verifiedTokenSub: 'oauth-sub-a' };
      });
    service.getPrimeClient = jest.fn(async () => ({
      get: jest.fn(async () => {
        calls.push('probe');
        return {
          status: 200,
          data: {
            code: 0,
            data: { onekeyAccount: { onekeyUserId: 'user-a' } },
          },
        };
      }),
      post: jest.fn(async () => {
        calls.push('bindPost');
        return {
          data: {
            data: {
              onekeyAccount: {
                onekeyUserId: 'user-a',
                normalizedEmail: 'a@example.com',
                displayEmail: 'a@example.com',
              },
            },
          },
        };
      }),
    }));

    await expect(bind(service)).resolves.toBeDefined();

    expect(calls).toEqual(['probe', 'keylessGuard', 'bindPost']);
    expect(keylessGuard).toHaveBeenCalledTimes(1);
  });

  it('runs the legacy guard before the keyless slot guard', async () => {
    // The legacy precondition is the cheap, definitive one: it must fail
    // before the keyless slot is even read, so a bind aborted by a login
    // change never reports a keyless-slot problem instead.
    const { service } = createBindService({
      authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
    });
    const keylessGuard = jest.spyOn(
      service,
      'assertKeylessSessionPersistedBeforeLogin',
    );

    await expect(bind(service)).rejects.toMatchObject({
      className:
        EOneKeyErrorClassNames.OneKeyErrorOneKeyIdLegacyBindStateChanged,
    });

    expect(keylessGuard).not.toHaveBeenCalled();
  });

  it('rejects an empty expectedOnekeyUserId instead of binding unconditionally', async () => {
    const { service, get, post } = createBindService();

    await expect(bind(service, '')).rejects.toMatchObject({
      className:
        EOneKeyErrorClassNames.OneKeyErrorOneKeyIdLegacyBindStateChanged,
    });

    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});
