/* eslint-disable import/first, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

import type { IKeylessBackendShare } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';

type IMigrationPersistForTest = {
  byWalletId: Record<
    string,
    {
      ownerId?: string;
      keylessProvider?: string;
      socialUserIdHash?: string;
      lastPassiveAttemptAt?: number;
      lastPassiveFailedAt?: number;
      succeededAt?: number;
    }
  >;
};

const mockMigrationAtom = {
  get: jest.fn(),
  set: jest.fn(),
};
const mockDevSettingsAtom = {
  get: jest.fn(),
  set: jest.fn(),
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
  decryptRevealableSeed: jest.fn(),
  decryptStringAsync: jest.fn(),
  encryptStringAsync: jest.fn(),
  generateMnemonic: jest.fn(),
  mnemonicToEntropy: jest.fn(),
  revealEntropyToMnemonic: jest.fn(),
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

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getCredential: jest.fn(),
    getCredentialInner: jest.fn(),
    updateKeylessWalletDetailsInfo: jest.fn(),
  },
}));

jest.mock('../../states/jotai/atoms', () => ({
  keylessBackendShareV2MigrationPersistAtom: mockMigrationAtom,
  keylessPinConfirmStatusAtom: {
    get: jest.fn(),
    set: jest.fn(),
  },
  primePersistAtom: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('../../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: mockDevSettingsAtom,
}));

jest.mock('../../endpoints', () => ({
  getEndpointInfo: jest.fn(async () => ({
    endpoint: 'https://test.onekey.so',
  })),
}));

const mockSupabaseGetSession = jest.fn();
const mockSupabaseRefreshSession = jest.fn();
const mockSupabaseSetSession = jest.fn();

jest.mock('@onekeyhq/shared/src/utils/supabaseClientUtils', () => ({
  __esModule: true,
  getKeylessSupabaseClient: () => ({
    client: {
      auth: {
        getSession: mockSupabaseGetSession,
        refreshSession: mockSupabaseRefreshSession,
        setSession: mockSupabaseSetSession,
      },
    },
  }),
}));

jest.mock('./utils/keylessMnemonicPasswordStorage', () => ({
  __esModule: true,
  default: {
    getMnemonicPasswordFromStorage: jest.fn(),
    saveMnemonicPasswordToStorage: jest.fn(),
    removeMnemonicPasswordFromStorage: jest.fn(),
    getMnemonicPasswordFromStorageWithPassword: jest.fn(),
    saveMnemonicPasswordToStorageWithPassword: jest.fn(),
  },
}));

jest.mock('./utils/keylessSyncCredentialStorage', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../ServicePrimeCloudSync/keylessCloudSyncUtils', () => ({
  __esModule: true,
  default: {
    deriveKeylessCredential: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/keylessWallet/shamirUtils', () => ({
  __esModule: true,
  default: {
    combine: jest.fn(async () => new Uint8Array([1, 2, 3])),
    split: jest.fn(async () => [new Uint8Array([1]), new Uint8Array([2])]),
  },
}));

const {
  decryptRevealableSeed,
  decryptStringAsync,
  encryptStringAsync,
  generateMnemonic,
  revealEntropyToMnemonic,
} =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@onekeyhq/core/src/secret');
const {
  EOAuthSocialLoginProvider,
  KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_PREFIX_V2,
  KEYLESS_BACKEND_SHARE_PAYLOAD_OWNER_V2_PASSWORD_FIXED_UUID,
  KEYLESS_SUPABASE_PROJECT_URL,
} =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@onekeyhq/shared/src/consts/authConsts');
const { KeylessDataCorruptedError, OneKeyLocalError } =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@onekeyhq/shared/src/errors');
const {
  EKeylessCreateWithOneKeyIdPrepareStatus,
  EOneKeyIdLoginWithLocalKeylessPrepareStatus,
} =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@onekeyhq/shared/src/keylessWallet/keylessWalletTypes');
const { EPrimeAuthSessionSource } =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@onekeyhq/shared/types/prime/primeTypes');

const localDb =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('../../dbs/local/localDb').default;

const ServiceKeylessWallet =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./ServiceKeylessWallet').default;
const keylessMnemonicPasswordStorage =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./utils/keylessMnemonicPasswordStorage').default;

const NOW = 1_800_000_000_000;
const TOKEN = 'access-token';
const PASSWORD = 'encoded-password';
const PIN = '1234';
const WALLET_ID = 'keyless-wallet-1';
const OWNER_ID = 'owner-1';
const SOCIAL_USER_ID_HASH = 'social-user-hash-1';
const HASH_ID = 'server-hash-id-1';

const backendShareData: IKeylessBackendShare = {
  encryptedMnemonic: 'encrypted-mnemonic',
  backendShare: 'backend-share',
  juiceboxShareX: 2,
};

const backendSharePayloadV2Password = `keyless-backend-share-v2:${OWNER_ID}:${KEYLESS_BACKEND_SHARE_PAYLOAD_OWNER_V2_PASSWORD_FIXED_UUID}`;

let migrationPersist: IMigrationPersistForTest;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function waitForScheduledBackgroundTask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

// Minimal unsigned JWT whose payload only carries `exp`, enough for
// stringUtils.decodeJWT() used by isKeylessAccessTokenValid().
function buildFakeSupabaseJwt(expSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString(
    'base64',
  );
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString(
    'base64',
  );
  return `${header}.${payload}.signature`;
}

function createKeylessWallet(overrides: Record<string, unknown> = {}) {
  return {
    id: WALLET_ID,
    isKeyless: true,
    keylessDetailsInfo: {
      keylessOwnerId: OWNER_ID,
      keylessProvider: EOAuthSocialLoginProvider.Google,
      socialUserIdHash: SOCIAL_USER_ID_HASH,
    },
    ...overrides,
  };
}

function createService(params: { wallet?: any; password?: string } = {}) {
  const wallet = 'wallet' in params ? params.wallet : createKeylessWallet();
  const backgroundApi: any = {
    simpleDb: {
      prime: {
        getEffectiveAuthSessionSource: jest.fn(async () => undefined),
        getKeylessSupabaseAuthToken: jest.fn(async () => ''),
      },
    },
    serviceAccount: {
      getKeylessWallet: jest.fn(async () => wallet),
    },
    servicePrime: {
      getLocalUserInfo: jest.fn(async () => ({
        displayEmail: 'legacy@example.com',
      })),
      isLoggedIn: jest.fn(async () => true),
      isOAuthProviderBoundToCurrentOneKeyId: jest.fn(async () => false),
    },
    servicePassword: {
      getCachedPassword: jest.fn(async () => params.password ?? PASSWORD),
      promptPasswordVerify: jest.fn(async () => ({ password: PASSWORD })),
      encodeSensitiveText: jest.fn(async ({ text }: { text: string }) => text),
    },
  };
  const service = new ServiceKeylessWallet({ backgroundApi });
  backgroundApi.serviceKeylessWallet = service;
  return { service, serviceAny: service, backgroundApi, wallet };
}

function mockPassiveV1HappyPath(serviceAny: any) {
  serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
    async () => ({
      accessToken: TOKEN,
    }),
  );
  serviceAny.validateKeylessAccessTokenMatchesLocalWallet = jest.fn(
    async () => undefined,
  );
  serviceAny.apiGetKeylessBackendShareMeta = jest.fn(async () => ({
    backendShare: 'backend-share-raw-v1',
    hashId: HASH_ID,
    revision: 1,
    canonicalFormat: 'v1',
  }));
  serviceAny.buildKeylessOwnerIdFromSocialToken = jest.fn(async () => OWNER_ID);
  serviceAny.decryptKeylessBackendSharePayloadV1 = jest.fn(
    async () => backendShareData,
  );
  serviceAny.validateKeylessBackendShareMatchesLocalWallet = jest.fn(
    async () => undefined,
  );
  serviceAny.migrateKeylessBackendShareToV2 = jest.fn(async () => undefined);
}

function mockResetPinHappyPath(
  serviceAny: any,
  params: {
    backendOwnerId?: string;
    canonicalFormat?: 'v1' | 'v2';
  } = {},
) {
  const resetBackendShareData: IKeylessBackendShare = {
    ...backendShareData,
    backendShare: 'AQ==',
  };
  serviceAny.apiGetKeylessBackendShare = jest.fn(async () => ({
    backendShare: 'backend-share-raw-v2',
    hashId: HASH_ID,
    revision: 2,
    canonicalFormat: params.canonicalFormat ?? 'v2',
    backendShareData: resetBackendShareData,
    // Mirror apiGetKeylessBackendShare: only v2 shares carry an ownerId; v1
    // shares leave it undefined.
    ownerId:
      (params.canonicalFormat ?? 'v2') === 'v1'
        ? undefined
        : (params.backendOwnerId ?? OWNER_ID),
    ownerProvider: EOAuthSocialLoginProvider.Google,
  }));
  serviceAny.buildKeylessProviderFromSocialToken = jest.fn(
    () => EOAuthSocialLoginProvider.Google,
  );
  serviceAny.buildKeylessOwnerIdFromSocialToken = jest.fn(async () => OWNER_ID);
  keylessMnemonicPasswordStorage.getMnemonicPasswordFromStorage.mockResolvedValue(
    'mnemonic-password',
  );
  keylessMnemonicPasswordStorage.saveMnemonicPasswordToStorage.mockResolvedValue(
    undefined,
  );
  serviceAny.decryptKeylessMnemonic = jest.fn(async () => 'mnemonic');
  localDb.getCredential.mockResolvedValue({ credential: 'credential' });
  localDb.getCredentialInner.mockResolvedValue({ credential: 'credential' });
  localDb.updateKeylessWalletDetailsInfo.mockResolvedValue(undefined);
  decryptRevealableSeed.mockResolvedValue({
    entropyWithLangPrefixed: 'entropy',
  });
  revealEntropyToMnemonic.mockReturnValue('mnemonic');
  serviceAny.recoverMissingShareFromSecret = jest.fn(async () => 'Ag==');
  serviceAny.apiUploadKeylessJuiceboxShare = jest.fn(async () => undefined);
  serviceAny.migrateKeylessBackendShareToV2 = jest.fn(async () => undefined);
  serviceAny.buildKeylessSocialUserIdFromToken = jest.fn(() => 'social-id');

  return resetBackendShareData;
}

beforeEach(() => {
  mockDevSettingsAtom.get.mockResolvedValue({
    enabled: false,
    settings: {},
  });
});

describe('ServiceKeylessWallet.apiResetKeylessBackendShare', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test('requires the destructive Keyless reset developer setting', async () => {
    const { service } = createService();

    mockDevSettingsAtom.get.mockResolvedValue({
      enabled: true,
      settings: { allowDeleteKeylessKey: false },
    });

    await expect(
      service.apiResetKeylessBackendShare({ token: TOKEN }),
    ).rejects.toThrow('Keyless wallet reset is not allowed');
  });

  test('resets with the temporary OAuth token when explicitly allowed', async () => {
    const { service, serviceAny } = createService();
    const post = jest.fn(async () => ({
      data: { code: 0, message: 'success' },
    }));

    mockDevSettingsAtom.get.mockResolvedValue({
      enabled: true,
      settings: { allowDeleteKeylessKey: true },
    });
    serviceAny.getClient = jest.fn(async () => ({ post }));
    serviceAny.apiGetPinConfirmStatus = jest.fn(async () => undefined);

    await expect(
      service.apiResetKeylessBackendShare({ token: TOKEN }),
    ).resolves.toEqual({ ok: true });
    expect(post).toHaveBeenCalledWith(
      '/prime/v1/keyless-wallet/resetKeylessBackendShare',
      { token: TOKEN },
    );
  });
});

describe('ServiceKeylessWallet passive backend share v2 migration', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    migrationPersist = { byWalletId: {} };
    mockMigrationAtom.get.mockImplementation(async () => migrationPersist);
    mockMigrationAtom.set.mockImplementation(async (updater: any) => {
      migrationPersist =
        typeof updater === 'function' ? updater(migrationPersist) : updater;
    });
    mockSupabaseGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockSupabaseRefreshSession.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  test('deduplicates concurrent passive migration calls in background service', async () => {
    const { service, serviceAny } = createService();
    const deferred = createDeferred<{
      migrated: boolean;
      checked: boolean;
      skipped: boolean;
      reason?: string;
    }>();
    serviceAny.migrateLocalExistingKeylessBackendShareToV2Passive = jest.fn(
      () => deferred.promise,
    );

    const calls = Array.from({ length: 5 }, () =>
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    );

    expect(
      serviceAny.migrateLocalExistingKeylessBackendShareToV2Passive,
    ).toHaveBeenCalledTimes(1);

    const result = {
      migrated: true,
      checked: true,
      skipped: false,
    };
    deferred.resolve(result);

    await expect(Promise.all(calls)).resolves.toEqual(
      Array.from({ length: 5 }, () => result),
    );
  });

  test('throttles passive migration for 24 hours after a failed attempt', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => null,
    );

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'token_missing',
    });

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'passive_throttled',
    });

    expect(
      serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive,
    ).toHaveBeenCalledTimes(1);
  });

  test('does not consume the 24-hour throttle when the refresh fetch fails with a network error', async () => {
    const { service, serviceAny } = createService();
    const { KeylessPassiveMigrationNetworkError } =
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('./keylessPassiveMigrationErrors');
    // First call: simulate offline by throwing a network error.
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest
      .fn()
      .mockImplementationOnce(async () => {
        throw new KeylessPassiveMigrationNetworkError();
      })
      .mockImplementationOnce(async () => null);

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'network_unavailable',
    });

    // Throttle should NOT be set — the next trigger must retry immediately.
    expect(migrationPersist.byWalletId[WALLET_ID]).toBeUndefined();

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'token_missing',
    });

    expect(
      serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive,
    ).toHaveBeenCalledTimes(2);
  });

  test('rolls back to previous record on network error for a record-matched wallet', async () => {
    const PREVIOUS_ATTEMPT_AT = NOW - 25 * 60 * 60 * 1000;
    migrationPersist = {
      byWalletId: {
        [WALLET_ID]: {
          ownerId: OWNER_ID,
          keylessProvider: EOAuthSocialLoginProvider.Google,
          socialUserIdHash: SOCIAL_USER_ID_HASH,
          lastPassiveAttemptAt: PREVIOUS_ATTEMPT_AT,
          lastPassiveFailedAt: PREVIOUS_ATTEMPT_AT,
        },
      },
    };
    const { service, serviceAny } = createService();
    const { KeylessPassiveMigrationNetworkError } =
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('./keylessPassiveMigrationErrors');
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => {
        throw new KeylessPassiveMigrationNetworkError();
      },
    );

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'network_unavailable',
    });

    // Previous record must be restored — the throttle write done at NOW
    // before the network attempt must be undone, so that the next natural
    // trigger can retry immediately without waiting another 24h.
    expect(migrationPersist.byWalletId[WALLET_ID]).toEqual({
      ownerId: OWNER_ID,
      keylessProvider: EOAuthSocialLoginProvider.Google,
      socialUserIdHash: SOCIAL_USER_ID_HASH,
      lastPassiveAttemptAt: PREVIOUS_ATTEMPT_AT,
      lastPassiveFailedAt: PREVIOUS_ATTEMPT_AT,
    });
  });

  // Legacy fallback: pre-OneKey-ID-unification builds stored a per-owner
  // encrypted refresh token instead of a global Supabase session. The passive
  // migration is the only non-interactive flow allowed to consume it.
  function mockLegacyRefreshTokenFallback(serviceAny: any) {
    serviceAny.hasLegacyKeylessOAuthRefreshToken = jest.fn(async () => true);
    serviceAny.getLegacyKeylessOAuthRefreshToken = jest.fn(
      async () => 'legacy-refresh-token',
    );
    serviceAny.saveLegacyKeylessOAuthRefreshToken = jest.fn(
      async () => undefined,
    );
    serviceAny.removeLegacyKeylessOAuthTokens = jest.fn(async () => undefined);
  }

  test('falls back to the legacy refresh token when the global session is empty and saves the rotated token back', async () => {
    const { service, serviceAny } = createService();
    mockPassiveV1HappyPath(serviceAny);
    // Use the real token-acquisition step so the legacy fallback is
    // exercised (the mocked global Supabase session yields no session).
    delete serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive;
    mockLegacyRefreshTokenFallback(serviceAny);
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: TOKEN,
        refresh_token: 'rotated-refresh-token',
      }),
    } as any);

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      migrated: true,
      skipped: false,
    });

    expect(serviceAny.getLegacyKeylessOAuthRefreshToken).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      password: PASSWORD,
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      `${KEYLESS_SUPABASE_PROJECT_URL}/auth/v1/token?grant_type=refresh_token`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refresh_token: 'legacy-refresh-token' }),
      }),
    );
    // Supabase rotates refresh tokens on use — the rotated token must be
    // persisted back, and the blob must NOT be deleted on successful passive
    // use (it remains the ongoing passive credential until an interactive
    // OneKey ID / keyless flow migrates and removes it).
    expect(serviceAny.saveLegacyKeylessOAuthRefreshToken).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      refreshToken: 'rotated-refresh-token',
      password: PASSWORD,
    });
    expect(serviceAny.removeLegacyKeylessOAuthTokens).not.toHaveBeenCalled();
    expect(migrationPersist.byWalletId[WALLET_ID]).toMatchObject({
      succeededAt: NOW,
    });
  });

  test('persists the rotated legacy token before the Prime meta call so a transient meta failure cannot burn it', async () => {
    const { service, serviceAny } = createService();
    mockPassiveV1HappyPath(serviceAny);
    delete serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive;
    mockLegacyRefreshTokenFallback(serviceAny);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: TOKEN,
        refresh_token: 'rotated-refresh-token',
      }),
    } as any);
    // The refresh-grant exchange above already consumed the single-use blob
    // token. If the Prime meta call (different host from GoTrue) then fails
    // transiently, the rotated token must already be persisted — otherwise
    // the blob keeps the consumed token and the next attempt's definitive
    // GoTrue rejection deletes the credential for good.
    serviceAny.apiGetKeylessBackendShareMeta = jest.fn(async () => {
      const error: Error & { className?: string } = new Error('Network Error');
      error.className = 'AxiosNetworkError';
      throw error;
    });

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'network_unavailable',
    });

    expect(serviceAny.saveLegacyKeylessOAuthRefreshToken).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      refreshToken: 'rotated-refresh-token',
      password: PASSWORD,
    });
    expect(
      serviceAny.saveLegacyKeylessOAuthRefreshToken.mock.invocationCallOrder[0],
    ).toBeLessThan(
      serviceAny.apiGetKeylessBackendShareMeta.mock.invocationCallOrder[0],
    );
    expect(serviceAny.removeLegacyKeylessOAuthTokens).not.toHaveBeenCalled();
    // Throttle rolled back so the next natural trigger retries promptly with
    // the freshly persisted rotated token.
    expect(migrationPersist.byWalletId[WALLET_ID]).toBeUndefined();
  });

  test('persists the rotated legacy token even when the exchanged token mismatches the local wallet', async () => {
    const { service, serviceAny } = createService();
    mockLegacyRefreshTokenFallback(serviceAny);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: TOKEN,
        refresh_token: 'rotated-refresh-token',
      }),
    } as any);
    // e.g. a same-email wallet whose local provider was rewritten by
    // fixedKeylessProviderMap, or a transient hash failure classified as a
    // mismatch — NOT a GoTrue verdict on the credential itself.
    serviceAny.validateKeylessAccessTokenMatchesLocalWallet = jest.fn(
      async () => 'token_provider_mismatch',
    );
    serviceAny.apiGetKeylessBackendShareMeta = jest.fn();

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'token_provider_mismatch',
    });

    // The exchange consumed the stored single-use token, so the rotated
    // replacement must be persisted regardless of the mismatch verdict —
    // otherwise the blob keeps the consumed token and the next attempt's
    // definitive GoTrue rejection deletes the credential for good.
    expect(serviceAny.saveLegacyKeylessOAuthRefreshToken).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      refreshToken: 'rotated-refresh-token',
      password: PASSWORD,
    });
    expect(serviceAny.removeLegacyKeylessOAuthTokens).not.toHaveBeenCalled();
    expect(serviceAny.apiGetKeylessBackendShareMeta).not.toHaveBeenCalled();
  });

  test('does not consume the 24-hour throttle when the legacy refresh is rate limited with 429', async () => {
    const { service, serviceAny } = createService();
    mockLegacyRefreshTokenFallback(serviceAny);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    } as any);

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'network_unavailable',
    });

    // Throttle must be rolled back so the next natural trigger retries, and
    // the blob must survive the transient failure.
    expect(migrationPersist.byWalletId[WALLET_ID]).toBeUndefined();
    expect(serviceAny.removeLegacyKeylessOAuthTokens).not.toHaveBeenCalled();
    expect(
      serviceAny.saveLegacyKeylessOAuthRefreshToken,
    ).not.toHaveBeenCalled();
  });

  test('keeps the blob and stays retryable when the refresh gets a non-OK response with an unparseable body', async () => {
    const { service, serviceAny } = createService();
    mockLegacyRefreshTokenFallback(serviceAny);
    // e.g. a corporate proxy / Cloudflare bot-challenge 403 with an HTML
    // body — not a GoTrue verdict on the token, so the blob must survive.
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    } as any);

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'network_unavailable',
    });

    expect(migrationPersist.byWalletId[WALLET_ID]).toBeUndefined();
    expect(serviceAny.removeLegacyKeylessOAuthTokens).not.toHaveBeenCalled();
  });

  test('removes the legacy refresh token blob when the refresh is definitively rejected (invalid_grant)', async () => {
    const { service, serviceAny } = createService();
    mockLegacyRefreshTokenFallback(serviceAny);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error_code: 'invalid_grant' }),
    } as any);

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'token_missing',
    });

    // The refresh token was revoked/expired — the blob is dead and must be
    // dropped; the attempt fails normally, consuming the 24h throttle.
    expect(serviceAny.removeLegacyKeylessOAuthTokens).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
    });
    expect(migrationPersist.byWalletId[WALLET_ID]).toMatchObject({
      lastPassiveAttemptAt: NOW,
      lastPassiveFailedAt: NOW,
    });
  });

  test('removes the legacy refresh token blob when it can no longer be decrypted', async () => {
    const { service, serviceAny } = createService();
    mockLegacyRefreshTokenFallback(serviceAny);
    serviceAny.getLegacyKeylessOAuthRefreshToken = jest.fn(async () => {
      throw new KeylessDataCorruptedError();
    });
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'token_missing',
    });

    expect(serviceAny.removeLegacyKeylessOAuthTokens).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('fast-yields with network-error semantics while the legacy exchange lock is held, without touching the blob', async () => {
    const { service, serviceAny } = createService();
    mockLegacyRefreshTokenFallback(serviceAny);
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: TOKEN,
        refresh_token: 'rotated-refresh-token',
      }),
    } as any);

    // Simulate the interactive OneKey ID login flow holding the shared
    // legacy-blob exchange lock (e.g. mid refresh-grant exchange).
    const [, releaseExchangeLock] =
      await serviceAny.legacyKeylessOAuthTokenExchangeMutex.acquire();
    try {
      await expect(
        service.tryMigrateLocalExistingKeylessBackendShareToV2(),
      ).resolves.toMatchObject({
        skipped: true,
        reason: 'network_unavailable',
      });
    } finally {
      releaseExchangeLock();
    }

    // Contention is treated exactly like a transient network failure: the
    // 24h throttle write is rolled back so a later trigger retries…
    expect(migrationPersist.byWalletId[WALLET_ID]).toBeUndefined();
    // …and the single-use blob token is neither read, exchanged, rotated
    // nor deleted while the interactive path owns it.
    expect(serviceAny.getLegacyKeylessOAuthRefreshToken).not.toHaveBeenCalled();
    expect(
      serviceAny.saveLegacyKeylessOAuthRefreshToken,
    ).not.toHaveBeenCalled();
    expect(serviceAny.removeLegacyKeylessOAuthTokens).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    // Once the lock is free again, the same trigger succeeds normally.
    mockPassiveV1HappyPath(serviceAny);
    delete serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive;
    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      migrated: true,
      skipped: false,
    });
    expect(serviceAny.saveLegacyKeylessOAuthRefreshToken).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      refreshToken: 'rotated-refresh-token',
      password: PASSWORD,
    });
  });

  test('does not consume the 24-hour throttle when Prime API meta call fails with AxiosNetworkError', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => ({ accessToken: TOKEN }),
    );
    serviceAny.validateKeylessAccessTokenMatchesLocalWallet = jest.fn(
      async () => undefined,
    );
    // Cached-token path: refresh skipped, Prime API fails with axios
    // network error (offline / DNS / TLS). Must not consume the 24h throttle.
    serviceAny.apiGetKeylessBackendShareMeta = jest.fn(async () => {
      const error: Error & { className?: string } = new Error('Network Error');
      error.className = 'AxiosNetworkError';
      throw error;
    });

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'network_unavailable',
    });

    expect(migrationPersist.byWalletId[WALLET_ID]).toBeUndefined();
  });

  test('does not consume the 24-hour throttle when Prime API meta call fails with 5xx', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => ({ accessToken: TOKEN }),
    );
    serviceAny.validateKeylessAccessTokenMatchesLocalWallet = jest.fn(
      async () => undefined,
    );
    serviceAny.apiGetKeylessBackendShareMeta = jest.fn(async () => {
      const error: Error & { httpStatusCode?: number } = new Error(
        'server error',
      );
      error.httpStatusCode = 503;
      throw error;
    });

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'network_unavailable',
    });

    expect(migrationPersist.byWalletId[WALLET_ID]).toBeUndefined();
  });

  test('does not consume the 24-hour throttle when Prime API call fails with 429 rate limit', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => ({ accessToken: TOKEN }),
    );
    serviceAny.validateKeylessAccessTokenMatchesLocalWallet = jest.fn(
      async () => undefined,
    );
    serviceAny.apiGetKeylessBackendShareMeta = jest.fn(async () => {
      const error: Error & { httpStatusCode?: number } = new Error(
        'rate limited',
      );
      error.httpStatusCode = 429;
      throw error;
    });

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'network_unavailable',
    });

    expect(migrationPersist.byWalletId[WALLET_ID]).toBeUndefined();
  });

  test('surfaces 429 from Supabase auth getSession as retryable so the throttle is not consumed', async () => {
    const { service, serviceAny } = createService();
    // In @supabase/auth-js, a 429 during the getSession() internal refresh
    // becomes an AuthApiError (not AuthRetryableFetchError), carrying a
    // numeric `status`.
    const rateLimitError = Object.assign(new Error('rate limited'), {
      name: 'AuthApiError',
      status: 429,
    });
    mockSupabaseGetSession.mockResolvedValue({
      data: { session: null },
      error: rateLimitError,
    });

    // Retryable classification must throw instead of returning null…
    await expect(serviceAny.getActiveKeylessOAuthAccessToken()).rejects.toBe(
      rateLimitError,
    );

    // …so the passive migration rolls back the throttle write instead of
    // burning the 24h window with reason `token_missing`.
    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'network_unavailable',
    });

    expect(migrationPersist.byWalletId[WALLET_ID]).toBeUndefined();
  });

  test('refreshes a near-expiry keyless oauth token instead of discarding the session', async () => {
    const { serviceAny } = createService();
    // Expires in 2 minutes: outside supabase-js's own ~90s auto-refresh
    // margin (so getSession returns it unrefreshed), but inside our 5-minute
    // validity buffer (so it fails isKeylessAccessTokenValid).
    const nearExpiryToken = buildFakeSupabaseJwt(NOW / 1000 + 120);
    const refreshedToken = buildFakeSupabaseJwt(NOW / 1000 + 3600);
    mockSupabaseGetSession.mockResolvedValue({
      data: { session: { access_token: nearExpiryToken } },
      error: null,
    });
    mockSupabaseRefreshSession.mockResolvedValue({
      data: { session: { access_token: refreshedToken }, user: null },
      error: null,
    });

    await expect(serviceAny.getActiveKeylessOAuthAccessToken()).resolves.toBe(
      refreshedToken,
    );
    expect(mockSupabaseRefreshSession).toHaveBeenCalledTimes(1);
  });

  test('returns null when the near-expiry refresh fails with a non-retryable auth error', async () => {
    const { serviceAny } = createService();
    const nearExpiryToken = buildFakeSupabaseJwt(NOW / 1000 + 120);
    mockSupabaseGetSession.mockResolvedValue({
      data: { session: { access_token: nearExpiryToken } },
      error: null,
    });
    mockSupabaseRefreshSession.mockResolvedValue({
      data: { session: null, user: null },
      error: Object.assign(new Error('Invalid Refresh Token'), {
        name: 'AuthApiError',
        status: 400,
      }),
    });

    await expect(
      serviceAny.getActiveKeylessOAuthAccessToken(),
    ).resolves.toBeNull();
  });

  test('does not consume the 24-hour throttle when Prime API call fails with a client-side timeout', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => ({ accessToken: TOKEN }),
    );
    serviceAny.validateKeylessAccessTokenMatchesLocalWallet = jest.fn(
      async () => undefined,
    );
    serviceAny.apiGetKeylessBackendShareMeta = jest.fn(async () => {
      const error: Error & { code?: string } = new Error('timeout of 30000ms');
      error.code = 'ECONNABORTED';
      throw error;
    });

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'network_unavailable',
    });

    expect(migrationPersist.byWalletId[WALLET_ID]).toBeUndefined();
  });

  test('still throttles for 24h when Prime API meta call fails with a 4xx (real auth failure)', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => ({ accessToken: TOKEN }),
    );
    serviceAny.validateKeylessAccessTokenMatchesLocalWallet = jest.fn(
      async () => undefined,
    );
    serviceAny.apiGetKeylessBackendShareMeta = jest.fn(async () => {
      const error: Error & { httpStatusCode?: number } = new Error(
        'unauthorized',
      );
      error.httpStatusCode = 401;
      throw error;
    });

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: false,
      reason: 'upgrade_failed',
    });

    // 4xx is a real failure — throttle must be set so we don't hammer the
    // server on every wake.
    expect(migrationPersist.byWalletId[WALLET_ID]).toMatchObject({
      ownerId: OWNER_ID,
      lastPassiveAttemptAt: NOW,
      lastPassiveFailedAt: NOW,
    });
  });

  test('retries passive migration after the 24-hour failure throttle window', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => null,
    );

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'token_missing',
    });

    jest.spyOn(Date, 'now').mockReturnValue(NOW + 24 * 60 * 60 * 1000 + 1);

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'token_missing',
    });

    expect(
      serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive,
    ).toHaveBeenCalledTimes(2);
  });

  test('skips permanently after successful migration for the same identity', async () => {
    const { service, serviceAny } = createService();
    mockPassiveV1HappyPath(serviceAny);

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      migrated: true,
      skipped: false,
    });

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'already_succeeded',
    });

    expect(serviceAny.migrateKeylessBackendShareToV2).toHaveBeenCalledTimes(1);
    expect(migrationPersist.byWalletId[WALLET_ID]).toMatchObject({
      ownerId: OWNER_ID,
      keylessProvider: EOAuthSocialLoginProvider.Google,
      socialUserIdHash: SOCIAL_USER_ID_HASH,
      succeededAt: NOW,
    });
  });

  test('does not reuse succeeded migration state across different local identities', async () => {
    migrationPersist = {
      byWalletId: {
        [WALLET_ID]: {
          ownerId: 'old-owner-id',
          keylessProvider: EOAuthSocialLoginProvider.Google,
          socialUserIdHash: 'old-social-user-hash',
          succeededAt: NOW - 1,
          lastPassiveAttemptAt: NOW - 1,
        },
      },
    };
    const { service, serviceAny } = createService();
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => null,
    );

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'token_missing',
    });

    expect(
      serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive,
    ).toHaveBeenCalledTimes(1);
    expect(migrationPersist.byWalletId[WALLET_ID]).toMatchObject({
      ownerId: OWNER_ID,
      socialUserIdHash: SOCIAL_USER_ID_HASH,
      succeededAt: undefined,
    });
  });

  test('does not write server when token social identity mismatches local wallet', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => ({
        accessToken: TOKEN,
      }),
    );
    serviceAny.validateKeylessAccessTokenMatchesLocalWallet = jest.fn(
      async () => 'token_identity_mismatch',
    );
    serviceAny.migrateKeylessBackendShareToV2 = jest.fn();
    serviceAny.apiGetKeylessBackendShareMeta = jest.fn();

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'token_identity_mismatch',
    });

    expect(serviceAny.apiGetKeylessBackendShareMeta).not.toHaveBeenCalled();
    expect(serviceAny.migrateKeylessBackendShareToV2).not.toHaveBeenCalled();
  });

  test('does not write server when token provider mismatches local wallet', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => ({
        accessToken: TOKEN,
      }),
    );
    serviceAny.validateKeylessAccessTokenMatchesLocalWallet = jest.fn(
      async () => 'token_provider_mismatch',
    );
    serviceAny.migrateKeylessBackendShareToV2 = jest.fn();
    serviceAny.apiGetKeylessBackendShareMeta = jest.fn();

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'token_provider_mismatch',
    });

    expect(serviceAny.apiGetKeylessBackendShareMeta).not.toHaveBeenCalled();
    expect(serviceAny.migrateKeylessBackendShareToV2).not.toHaveBeenCalled();
  });

  test('does not write server when token and server hash derive a different ownerId', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => ({
        accessToken: TOKEN,
      }),
    );
    serviceAny.validateKeylessAccessTokenMatchesLocalWallet = jest.fn(
      async () => undefined,
    );
    serviceAny.apiGetKeylessBackendShareMeta = jest.fn(async () => ({
      backendShare: 'backend-share-raw-v1',
      hashId: HASH_ID,
      revision: 1,
      canonicalFormat: 'v1',
    }));
    serviceAny.buildKeylessOwnerIdFromSocialToken = jest.fn(
      async () => 'other-owner-id',
    );
    serviceAny.decryptKeylessBackendSharePayloadV1 = jest.fn();
    serviceAny.migrateKeylessBackendShareToV2 = jest.fn();

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'owner_id_mismatch',
    });

    expect(
      serviceAny.decryptKeylessBackendSharePayloadV1,
    ).not.toHaveBeenCalled();
    expect(serviceAny.migrateKeylessBackendShareToV2).not.toHaveBeenCalled();
  });

  test('does not mark success when existing v2 server data does not match local mnemonic', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => ({
        accessToken: TOKEN,
      }),
    );
    serviceAny.validateKeylessAccessTokenMatchesLocalWallet = jest.fn(
      async () => undefined,
    );
    serviceAny.apiGetKeylessBackendShareMeta = jest.fn(async () => ({
      backendShare: 'backend-share-raw-v2',
      hashId: HASH_ID,
      revision: 2,
      canonicalFormat: 'v2',
    }));
    serviceAny.buildKeylessOwnerIdFromSocialToken = jest.fn(
      async () => OWNER_ID,
    );
    serviceAny.apiGetKeylessBackendShare = jest.fn(async () => ({
      backendShare: 'backend-share-raw-v2',
      hashId: HASH_ID,
      revision: 2,
      canonicalFormat: 'v2',
      backendShareData,
      ownerId: OWNER_ID,
    }));
    serviceAny.validateKeylessBackendShareMatchesLocalWallet = jest.fn(
      async () => 'mnemonic_mismatch',
    );
    serviceAny.migrateKeylessBackendShareToV2 = jest.fn();

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'mnemonic_mismatch',
    });

    expect(serviceAny.migrateKeylessBackendShareToV2).not.toHaveBeenCalled();
    expect(migrationPersist.byWalletId[WALLET_ID]?.succeededAt).toBeUndefined();
  });

  test('migrates v1 backend share after identity and owner checks pass', async () => {
    const { service, serviceAny } = createService();
    mockPassiveV1HappyPath(serviceAny);

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      migrated: true,
      skipped: false,
    });

    expect(serviceAny.migrateKeylessBackendShareToV2).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: OWNER_ID,
        token: TOKEN,
      }),
    );
  });

  test('does not write v2 if the v1 payload changes after acquiring the server lock', async () => {
    const { serviceAny } = createService();
    const changedBackendShareData = {
      ...backendShareData,
      backendShare: 'changed-backend-share',
    };
    serviceAny.apiAcquireCreationLock = jest.fn(async () => ({
      lockId: 'lock-1',
      hashId: HASH_ID,
      expiresAt: NOW + 60_000,
    }));
    serviceAny.apiReleaseCreationLock = jest.fn(async () => undefined);
    serviceAny.apiGetKeylessBackendShare = jest.fn(async () => ({
      backendShare: 'backend-share-raw-v1',
      hashId: HASH_ID,
      revision: 2,
      canonicalFormat: 'v1',
      backendShareData: changedBackendShareData,
    }));
    serviceAny.uploadKeylessBackendShare = jest.fn(
      async () => backendShareData,
    );

    await expect(
      serviceAny.migrateKeylessBackendShareToV2({
        token: TOKEN,
        ownerId: OWNER_ID,
        expectedHashId: HASH_ID,
        expectedBackendShareData: backendShareData,
      }),
    ).rejects.toThrow('Keyless backend share changed before migration');

    expect(serviceAny.uploadKeylessBackendShare).not.toHaveBeenCalled();
  });

  test('normalizes creation lock expire_time from backend response', async () => {
    const { serviceAny } = createService();
    const post = jest.fn(async () => ({
      data: {
        code: 0,
        message: 'success',
        data: {
          lockId: 'lock-1',
          hashId: HASH_ID,
          expire_time: NOW + 60_000,
        },
      },
    }));
    serviceAny.getClient = jest.fn(async () => ({ post }));

    await expect(
      serviceAny.apiAcquireCreationLock({ token: TOKEN }),
    ).resolves.toEqual({
      lockId: 'lock-1',
      hashId: HASH_ID,
      expiresAt: NOW + 60_000,
    });
  });

  test('uses server revision as base revision when creating keyless wallet', async () => {
    const { service, serviceAny } = createService({ wallet: null });
    generateMnemonic.mockReturnValue('mnemonic');
    serviceAny.apiAcquireCreationLock = jest.fn(async () => ({
      lockId: 'lock-1',
      hashId: HASH_ID,
      expiresAt: NOW + 60_000,
    }));
    serviceAny.apiReleaseCreationLock = jest.fn(async () => undefined);
    serviceAny.apiGetKeylessBackendShareMeta = jest.fn(async () => ({
      backendShare: '',
      hashId: HASH_ID,
      revision: 5,
      canonicalFormat: 'v2',
    }));
    serviceAny.buildKeylessOwnerIdFromSocialToken = jest.fn(
      async () => OWNER_ID,
    );
    serviceAny.encryptKeylessMnemonic = jest.fn(
      async () => backendShareData.encryptedMnemonic,
    );
    serviceAny.apiUploadKeylessJuiceboxShare = jest.fn(async () => undefined);
    serviceAny.encryptKeylessBackendSharePayloadV1 = jest.fn(
      async () => 'backend-share-raw-v1-mirror',
    );
    serviceAny.uploadKeylessBackendShare = jest.fn(
      async () => backendShareData,
    );
    serviceAny.buildKeylessProviderFromSocialToken = jest.fn(
      () => EOAuthSocialLoginProvider.Google,
    );
    serviceAny.buildKeylessSocialUserIdFromToken = jest.fn(() => 'social-id');
    keylessMnemonicPasswordStorage.saveMnemonicPasswordToStorage.mockResolvedValue(
      undefined,
    );

    await expect(
      service.createKeylessWalletToServer({
        token: TOKEN,
        pin: PIN,
      }),
    ).resolves.toMatchObject({
      ownerId: OWNER_ID,
      mnemonic: 'mnemonic',
    });

    expect(serviceAny.uploadKeylessBackendShare).toHaveBeenCalledWith(
      expect.objectContaining({
        baseRevision: 5,
        keylessBackendShareV1Mirror: 'backend-share-raw-v1-mirror',
      }),
    );
  });

  test('encrypts backend share v2 with owner password and fixed uuid', async () => {
    const { serviceAny } = createService();
    encryptStringAsync.mockResolvedValue('encrypted-payload');

    await expect(
      serviceAny.encryptKeylessBackendSharePayloadV2({
        hashId: HASH_ID,
        ownerId: OWNER_ID,
        backendShareData,
      }),
    ).resolves.toBe(
      `${KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_PREFIX_V2}encrypted-payload`,
    );

    expect(encryptStringAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        password: backendSharePayloadV2Password,
      }),
    );
  });

  test('decrypts backend share v2 only with owner password and fixed uuid', async () => {
    const { serviceAny } = createService();
    serviceAny.buildKeylessBackendShareOwnerIdCandidates = jest.fn(async () => [
      {
        ownerId: OWNER_ID,
        provider: EOAuthSocialLoginProvider.Google,
      },
    ]);
    decryptStringAsync.mockRejectedValue(new Error('decrypt failed'));

    await expect(
      serviceAny.decryptKeylessBackendSharePayloadV2({
        token: TOKEN,
        hashId: HASH_ID,
        backendShare: `${KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_PREFIX_V2}cipher`,
      }),
    ).rejects.toThrow('Failed to decrypt keyless backend share');

    expect(decryptStringAsync).toHaveBeenCalledTimes(1);
    expect(decryptStringAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        password: backendSharePayloadV2Password,
      }),
    );
  });

  test('submits caller-provided v1 mirror when uploading keyless backend share v2', async () => {
    const { serviceAny } = createService();
    const post = jest.fn(async () => ({
      data: {
        code: 0,
        message: 'success',
        data: {
          ok: true,
          revision: 1,
          hashId: HASH_ID,
        },
      },
    }));
    serviceAny.getClient = jest.fn(async () => ({ post }));
    serviceAny.encryptKeylessBackendSharePayloadV2 = jest.fn(
      async () => 'backend-share-raw-v2',
    );
    serviceAny.decryptKeylessBackendSharePayloadV2 = jest.fn(async () => ({
      backendShareData,
      ownerId: OWNER_ID,
      ownerProvider: EOAuthSocialLoginProvider.Google,
    }));
    serviceAny.decryptKeylessBackendSharePayloadV1 = jest.fn(
      async () => backendShareData,
    );

    await expect(
      serviceAny.uploadKeylessBackendShare({
        token: TOKEN,
        lockId: 'lock-1',
        hashId: HASH_ID,
        ownerId: OWNER_ID,
        baseRevision: 0,
        encryptedMnemonic: backendShareData.encryptedMnemonic,
        backendShare: backendShareData.backendShare,
        juiceboxShareX: backendShareData.juiceboxShareX,
        keylessBackendShareV1Mirror: 'backend-share-raw-v1-mirror',
      }),
    ).resolves.toEqual(backendShareData);

    expect(post).toHaveBeenCalledWith(
      '/prime/v1/keyless-wallet/createKeylessBackendShareV2',
      {
        token: TOKEN,
        lockId: 'lock-1',
        baseRevision: 0,
        keylessBackendShareV2: 'backend-share-raw-v2',
        keylessBackendShareV1Mirror: 'backend-share-raw-v1-mirror',
      },
    );
  });

  test('rejects supplied v1 mirror when it does not match upload payload', async () => {
    const { serviceAny } = createService();
    const post = jest.fn();
    serviceAny.getClient = jest.fn(async () => ({ post }));
    serviceAny.encryptKeylessBackendSharePayloadV2 = jest.fn(
      async () => 'backend-share-raw-v2',
    );
    serviceAny.decryptKeylessBackendSharePayloadV2 = jest.fn(async () => ({
      backendShareData,
      ownerId: OWNER_ID,
      ownerProvider: EOAuthSocialLoginProvider.Google,
    }));
    serviceAny.decryptKeylessBackendSharePayloadV1 = jest.fn(async () => ({
      ...backendShareData,
      backendShare: 'changed-backend-share',
    }));

    await expect(
      serviceAny.uploadKeylessBackendShare({
        token: TOKEN,
        lockId: 'lock-1',
        hashId: HASH_ID,
        ownerId: OWNER_ID,
        baseRevision: 0,
        encryptedMnemonic: backendShareData.encryptedMnemonic,
        backendShare: backendShareData.backendShare,
        juiceboxShareX: backendShareData.juiceboxShareX,
        keylessBackendShareV1Mirror: 'backend-share-raw-v1',
      }),
    ).rejects.toThrow('Keyless backend share v1 mirror verification mismatch');

    expect(post).not.toHaveBeenCalled();
  });

  test('rejects upload when server response hash or revision is inconsistent', async () => {
    const { serviceAny } = createService();
    const post = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: 'success',
          data: {
            ok: true,
            revision: 1,
            hashId: 'other-hash-id',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: 'success',
          data: {
            ok: true,
            revision: 0,
            hashId: HASH_ID,
          },
        },
      });
    serviceAny.getClient = jest.fn(async () => ({ post }));
    serviceAny.encryptKeylessBackendSharePayloadV2 = jest.fn(
      async () => 'backend-share-raw-v2',
    );
    serviceAny.decryptKeylessBackendSharePayloadV2 = jest.fn(async () => ({
      backendShareData,
      ownerId: OWNER_ID,
      ownerProvider: EOAuthSocialLoginProvider.Google,
    }));
    serviceAny.decryptKeylessBackendSharePayloadV1 = jest.fn(
      async () => backendShareData,
    );

    const params = {
      token: TOKEN,
      lockId: 'lock-1',
      hashId: HASH_ID,
      ownerId: OWNER_ID,
      baseRevision: 0,
      encryptedMnemonic: backendShareData.encryptedMnemonic,
      backendShare: backendShareData.backendShare,
      juiceboxShareX: backendShareData.juiceboxShareX,
      keylessBackendShareV1Mirror: 'backend-share-raw-v1-mirror',
    };

    await expect(serviceAny.uploadKeylessBackendShare(params)).rejects.toThrow(
      'Failed to upload keyless backend share',
    );
    await expect(serviceAny.uploadKeylessBackendShare(params)).rejects.toThrow(
      'Failed to upload keyless backend share',
    );

    expect(post).toHaveBeenCalledTimes(2);
  });

  test('reuses existing v1 payload as mirror when migrating to v2', async () => {
    const { serviceAny } = createService();
    serviceAny.apiAcquireCreationLock = jest.fn(async () => ({
      lockId: 'lock-1',
      hashId: HASH_ID,
      expiresAt: NOW + 60_000,
    }));
    serviceAny.apiReleaseCreationLock = jest.fn(async () => undefined);
    serviceAny.apiGetKeylessBackendShare = jest.fn(async () => ({
      backendShare: 'backend-share-raw-v1',
      hashId: HASH_ID,
      revision: 2,
      canonicalFormat: 'v1',
      backendShareData,
    }));
    serviceAny.uploadKeylessBackendShare = jest.fn(
      async () => backendShareData,
    );

    await expect(
      serviceAny.migrateKeylessBackendShareToV2({
        token: TOKEN,
        ownerId: OWNER_ID,
        expectedHashId: HASH_ID,
        expectedBackendShareData: backendShareData,
      }),
    ).resolves.toBeUndefined();

    expect(serviceAny.uploadKeylessBackendShare).toHaveBeenCalledWith(
      expect.objectContaining({
        baseRevision: 2,
        keylessBackendShareV1Mirror: 'backend-share-raw-v1',
      }),
    );
  });

  test('waits for pin confirm status update and holds the status mutex', async () => {
    const { serviceAny } = createService();
    const deferred = createDeferred<void>();
    serviceAny.apiUpdatePinConfirmStatus = jest.fn(() => deferred.promise);

    let syncResolved = false;
    const syncPromise = serviceAny
      .updatePinConfirmStatusAfterSuccessfulPin({ token: TOKEN })
      .then((result: boolean) => {
        syncResolved = true;
        return result;
      });

    await Promise.resolve();

    expect(serviceAny.apiUpdatePinConfirmStatus).toHaveBeenCalledWith({
      token: TOKEN,
    });
    expect(syncResolved).toBe(false);

    let mutexReleased = false;
    const mutexPromise = serviceAny.updatePinConfirmStatusMutex
      .waitForUnlock()
      .then(() => {
        mutexReleased = true;
      });

    await Promise.resolve();

    expect(mutexReleased).toBe(false);

    deferred.resolve(undefined);

    await expect(syncPromise).resolves.toBe(true);
    await mutexPromise;
    expect(mutexReleased).toBe(true);
  });

  test('does not reject successful pin flow when pin confirm status update fails', async () => {
    const { serviceAny } = createService();
    serviceAny.apiUpdatePinConfirmStatus = jest.fn(async () => {
      throw new OneKeyLocalError('network error');
    });

    await expect(
      serviceAny.updatePinConfirmStatusAfterSuccessfulPin({ token: TOKEN }),
    ).resolves.toBe(false);
  });

  test('waits for reset pin confirm status before reporting success', async () => {
    const { serviceAny } = createService();
    mockResetPinHappyPath(serviceAny);
    const deferred = createDeferred<void>();
    serviceAny.apiResetPinConfirmStatus = jest.fn(() => deferred.promise);

    let resetResolved = false;
    const resetPromise = serviceAny
      .resetKeylessWalletPin({
        token: TOKEN,
        newPin: PIN,
      })
      .then((result: { success: true }) => {
        resetResolved = true;
        return result;
      });

    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(serviceAny.apiResetPinConfirmStatus).toHaveBeenCalledWith({
      token: TOKEN,
    });
    expect(resetResolved).toBe(false);

    deferred.resolve(undefined);

    await expect(resetPromise).resolves.toEqual({ success: true });
    expect(resetResolved).toBe(true);
  });

  test('rejects reset pin when reset pin confirm status update fails', async () => {
    const { serviceAny } = createService();
    mockResetPinHappyPath(serviceAny);
    serviceAny.apiResetPinConfirmStatus = jest.fn(async () => {
      throw new OneKeyLocalError('reset pin confirm status failed');
    });

    await expect(
      serviceAny.resetKeylessWalletPin({
        token: TOKEN,
        newPin: PIN,
      }),
    ).rejects.toThrow('reset pin confirm status failed');
  });

  test('awaits backend share owner rewrite when reset pin target owner changes', async () => {
    const { serviceAny } = createService();
    const resetBackendShareData = mockResetPinHappyPath(serviceAny, {
      backendOwnerId: 'legacy-owner-id',
    });
    serviceAny.apiResetPinConfirmStatus = jest.fn(async () => undefined);

    await expect(
      serviceAny.resetKeylessWalletPin({
        token: TOKEN,
        newPin: PIN,
      }),
    ).resolves.toEqual({ success: true });

    expect(serviceAny.migrateKeylessBackendShareToV2).toHaveBeenCalledWith({
      token: TOKEN,
      ownerId: OWNER_ID,
      expectedHashId: HASH_ID,
      expectedBackendShareData: resetBackendShareData,
    });
  });

  test('rejects reset pin when backend share owner rewrite fails (owner changed)', async () => {
    const { serviceAny } = createService();
    const resetBackendShareData = mockResetPinHappyPath(serviceAny, {
      backendOwnerId: 'legacy-owner-id',
    });
    serviceAny.apiResetPinConfirmStatus = jest.fn(async () => undefined);
    serviceAny.migrateKeylessBackendShareToV2 = jest.fn(async () => {
      throw new OneKeyLocalError('migration failed');
    });

    // When the backend share owner changes, the rewrite is a consistency
    // requirement (juicebox is already under the new owner), so a failure must
    // surface and fail reset rather than being swallowed as background work.
    await expect(
      serviceAny.resetKeylessWalletPin({
        token: TOKEN,
        newPin: PIN,
      }),
    ).rejects.toThrow('migration failed');

    expect(serviceAny.migrateKeylessBackendShareToV2).toHaveBeenCalledWith({
      token: TOKEN,
      ownerId: OWNER_ID,
      expectedHashId: HASH_ID,
      expectedBackendShareData: resetBackendShareData,
    });
    // The owner rewrite runs before any local persistence / pin-confirm reset,
    // so its failure must not leave a mixed local(new owner)/server(old owner)
    // state.
    expect(localDb.updateKeylessWalletDetailsInfo).not.toHaveBeenCalled();
    expect(serviceAny.apiResetPinConfirmStatus).not.toHaveBeenCalled();
  });

  test('keeps v1 backend migration non-blocking even though v1 has no ownerId', async () => {
    const { serviceAny } = createService();
    const resetBackendShareData = mockResetPinHappyPath(serviceAny, {
      canonicalFormat: 'v1',
    });
    serviceAny.apiResetPinConfirmStatus = jest.fn(async () => undefined);
    serviceAny.migrateKeylessBackendShareToV2 = jest.fn(async () => {
      throw new OneKeyLocalError('migration failed');
    });

    // A v1 share has no ownerId, so it must not be misclassified as an owner
    // change. A pure v1 -> v2 upgrade is best-effort background work that
    // self-heals via passive migration, so its failure must not block reset.
    await expect(
      serviceAny.resetKeylessWalletPin({
        token: TOKEN,
        newPin: PIN,
      }),
    ).resolves.toEqual({ success: true });

    await waitForScheduledBackgroundTask();

    expect(serviceAny.migrateKeylessBackendShareToV2).toHaveBeenCalledWith({
      token: TOKEN,
      ownerId: OWNER_ID,
      expectedHashId: HASH_ID,
      expectedBackendShareData: resetBackendShareData,
    });
  });

  test('returns whether verify pin updated confirm status', async () => {
    const { serviceAny } = createService();
    serviceAny.apiGetKeylessBackendShare = jest.fn(async () => ({
      backendShare: 'backend-share-raw-v2',
      hashId: HASH_ID,
      revision: 2,
      canonicalFormat: 'v2',
      backendShareData,
    }));
    serviceAny.buildKeylessProviderFromSocialToken = jest.fn(
      () => EOAuthSocialLoginProvider.Google,
    );
    serviceAny.buildKeylessOwnerIdFromSocialToken = jest.fn(
      async () => OWNER_ID,
    );
    serviceAny.buildKeylessSocialUserIdFromToken = jest.fn(() => 'social-id');
    serviceAny.apiGetKeylessJuiceboxShare = jest.fn(async () => ({
      ownerId: OWNER_ID,
      pin: PIN,
      juiceboxShare: 'juicebox-share',
      backendShareX: 1,
    }));
    serviceAny.updatePinConfirmStatusAfterSuccessfulPin = jest.fn(
      async () => true,
    );

    await expect(
      serviceAny.apiVerifyKeylessJuiceboxPin({
        token: TOKEN,
        pin: PIN,
        dangerousRetryByFixedProvider: false,
      }),
    ).resolves.toEqual({ pinConfirmStatusUpdated: true });
    expect(
      serviceAny.updatePinConfirmStatusAfterSuccessfulPin,
    ).toHaveBeenCalledWith({ token: TOKEN });
  });

  test('skips restore pin confirm status update only when it was already updated', async () => {
    const { serviceAny } = createService();
    const restoreBackendShareData: IKeylessBackendShare = {
      ...backendShareData,
      backendShare: 'AQ==',
    };

    serviceAny.apiGetKeylessBackendShare = jest.fn(async () => ({
      backendShare: 'backend-share-raw-v2',
      hashId: HASH_ID,
      revision: 2,
      canonicalFormat: 'v2',
      backendShareData: restoreBackendShareData,
      ownerId: OWNER_ID,
      ownerProvider: EOAuthSocialLoginProvider.Google,
    }));
    serviceAny.apiGetKeylessJuiceboxShare = jest.fn(async () => ({
      ownerId: OWNER_ID,
      pin: PIN,
      juiceboxShare: 'Ag==',
      backendShareX: 1,
    }));
    serviceAny.decryptKeylessMnemonic = jest.fn(async () => 'mnemonic');
    serviceAny.buildKeylessSocialUserIdFromToken = jest.fn(() => 'social-id');
    serviceAny.updatePinConfirmStatusAfterSuccessfulPin = jest.fn(
      async () => true,
    );

    await expect(
      serviceAny.restoreKeylessWalletFromServer({
        token: TOKEN,
        pin: PIN,
        pinConfirmStatusAlreadyUpdated: true,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ownerId: OWNER_ID,
        mnemonic: 'mnemonic',
      }),
    );
    expect(
      serviceAny.updatePinConfirmStatusAfterSuccessfulPin,
    ).not.toHaveBeenCalled();

    await serviceAny.restoreKeylessWalletFromServer({
      token: TOKEN,
      pin: PIN,
      pinConfirmStatusAlreadyUpdated: false,
    });
    expect(
      serviceAny.updatePinConfirmStatusAfterSuccessfulPin,
    ).toHaveBeenCalledTimes(1);
    expect(
      serviceAny.updatePinConfirmStatusAfterSuccessfulPin,
    ).toHaveBeenCalledWith({ token: TOKEN });
  });

  test('does not reject restore when backend share v2 migration fails', async () => {
    const { serviceAny } = createService();
    const restoreBackendShareData: IKeylessBackendShare = {
      ...backendShareData,
      backendShare: 'AQ==',
    };

    serviceAny.apiGetKeylessBackendShare = jest.fn(async () => ({
      backendShare: 'backend-share-raw-v1',
      hashId: HASH_ID,
      revision: 1,
      canonicalFormat: 'v1',
      backendShareData: restoreBackendShareData,
      ownerId: OWNER_ID,
      ownerProvider: EOAuthSocialLoginProvider.Google,
    }));
    serviceAny.apiGetKeylessJuiceboxShare = jest.fn(async () => ({
      ownerId: OWNER_ID,
      pin: PIN,
      juiceboxShare: 'Ag==',
      backendShareX: 1,
    }));
    serviceAny.decryptKeylessMnemonic = jest.fn(async () => 'mnemonic');
    serviceAny.buildKeylessSocialUserIdFromToken = jest.fn(() => 'social-id');
    serviceAny.migrateKeylessBackendShareToV2 = jest.fn(async () => {
      throw new OneKeyLocalError('migration failed');
    });

    await expect(
      serviceAny.restoreKeylessWalletFromServer({
        token: TOKEN,
        pin: PIN,
        pinConfirmStatusAlreadyUpdated: true,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ownerId: OWNER_ID,
        mnemonic: 'mnemonic',
      }),
    );

    await waitForScheduledBackgroundTask();

    expect(serviceAny.migrateKeylessBackendShareToV2).toHaveBeenCalledWith({
      token: TOKEN,
      ownerId: OWNER_ID,
      expectedHashId: HASH_ID,
      expectedBackendShareData: restoreBackendShareData,
    });
  });
});

describe('ServiceKeylessWallet legacy keyless OAuth token passcode handling', () => {
  const OLD_PASSWORD = 'encoded-old-password';
  const NEW_PASSWORD = 'encoded-new-password';

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  function createServiceForPasscodeUpdate() {
    const created = createService();
    created.backgroundApi.serviceAccount.getAllWallets = jest.fn(async () => ({
      wallets: [created.wallet],
    }));
    keylessMnemonicPasswordStorage.getMnemonicPasswordFromStorageWithPassword.mockResolvedValue(
      'mnemonic-password',
    );
    keylessMnemonicPasswordStorage.saveMnemonicPasswordToStorageWithPassword.mockResolvedValue(
      undefined,
    );
    return created;
  }

  test('updateKeylessDataPasscode re-encrypts the legacy OAuth refresh token with the new passcode', async () => {
    const { service, serviceAny } = createServiceForPasscodeUpdate();
    serviceAny.getLegacyKeylessOAuthRefreshToken = jest.fn(
      async () => 'legacy-refresh-token',
    );
    serviceAny.saveLegacyKeylessOAuthRefreshToken = jest.fn(
      async () => undefined,
    );

    const { rollback } = await service.updateKeylessDataPasscode({
      oldPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(serviceAny.getLegacyKeylessOAuthRefreshToken).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      password: OLD_PASSWORD,
    });
    expect(serviceAny.saveLegacyKeylessOAuthRefreshToken).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      refreshToken: 'legacy-refresh-token',
      password: NEW_PASSWORD,
    });

    await rollback();

    expect(
      serviceAny.saveLegacyKeylessOAuthRefreshToken,
    ).toHaveBeenLastCalledWith({
      ownerId: OWNER_ID,
      refreshToken: 'legacy-refresh-token',
      password: OLD_PASSWORD,
    });
  });

  test('updateKeylessDataPasscode drops a legacy refresh token that fails to decrypt instead of failing the passcode change', async () => {
    const { service, serviceAny } = createServiceForPasscodeUpdate();
    serviceAny.getLegacyKeylessOAuthRefreshToken = jest.fn(async () => {
      throw new KeylessDataCorruptedError();
    });
    serviceAny.saveLegacyKeylessOAuthRefreshToken = jest.fn(
      async () => undefined,
    );
    serviceAny.removeLegacyKeylessOAuthTokens = jest.fn(async () => undefined);

    await expect(
      service.updateKeylessDataPasscode({
        oldPassword: OLD_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    ).resolves.toBeDefined();

    expect(serviceAny.removeLegacyKeylessOAuthTokens).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
    });
    expect(
      serviceAny.saveLegacyKeylessOAuthRefreshToken,
    ).not.toHaveBeenCalled();
    // The mnemonic password must still be re-encrypted with the new passcode.
    expect(
      keylessMnemonicPasswordStorage.saveMnemonicPasswordToStorageWithPassword,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: OWNER_ID,
        password: NEW_PASSWORD,
      }),
    );
  });

  test('migrateLegacyKeylessOAuthSessionForLocalWallet cleans up the blob when decryption fails', async () => {
    const { serviceAny, wallet } = createService();
    serviceAny.hasLegacyKeylessOAuthRefreshToken = jest.fn(async () => true);
    serviceAny.getLegacyKeylessOAuthRefreshToken = jest.fn(async () => {
      throw new KeylessDataCorruptedError();
    });
    serviceAny.removeLegacyKeylessOAuthTokens = jest.fn(async () => undefined);

    await expect(
      serviceAny.migrateLegacyKeylessOAuthSessionForLocalWallet({
        keylessWallet: wallet,
        ownerId: OWNER_ID,
      }),
    ).resolves.toBeNull();

    expect(serviceAny.removeLegacyKeylessOAuthTokens).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
    });
  });
});

describe('ServiceKeylessWallet legacy keyless OAuth token exchange serialization', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    mockSupabaseSetSession.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });
  });

  test('interactive migration re-checks blob presence inside the lock and returns null without any exchange when it is gone', async () => {
    const { serviceAny, wallet, backgroundApi } = createService();
    // Blob exists at the cheap pre-prompt check, but is gone by the time the
    // exchange lock is acquired (the passive path consumed it and removed it
    // after a definitive GoTrue rejection while this call waited).
    serviceAny.hasLegacyKeylessOAuthRefreshToken = jest
      .fn()
      .mockResolvedValueOnce(true) // pre-prompt check
      .mockResolvedValueOnce(false); // in-lock re-check
    serviceAny.getLegacyKeylessOAuthRefreshToken = jest.fn();
    serviceAny.saveLegacyKeylessOAuthRefreshToken = jest.fn();
    serviceAny.removeLegacyKeylessOAuthTokens = jest.fn();
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as any);

    await expect(
      serviceAny.migrateLegacyKeylessOAuthSessionForLocalWallet({
        keylessWallet: wallet,
        ownerId: OWNER_ID,
      }),
    ).resolves.toBeNull();

    expect(
      backgroundApi.servicePassword.promptPasswordVerify,
    ).toHaveBeenCalledTimes(1);
    expect(serviceAny.hasLegacyKeylessOAuthRefreshToken).toHaveBeenCalledTimes(
      2,
    );
    // No decrypt, no HTTP refresh grant, no blob mutation.
    expect(serviceAny.getLegacyKeylessOAuthRefreshToken).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(
      serviceAny.saveLegacyKeylessOAuthRefreshToken,
    ).not.toHaveBeenCalled();
    expect(serviceAny.removeLegacyKeylessOAuthTokens).not.toHaveBeenCalled();
    expect(mockSupabaseSetSession).not.toHaveBeenCalled();
  });

  test('interactive migration queues behind the exchange lock and then consumes the freshly rotated blob token', async () => {
    const { serviceAny, wallet } = createService();
    serviceAny.hasLegacyKeylessOAuthRefreshToken = jest.fn(async () => true);
    // Simulates the passive path having already rotated the blob while it
    // held the lock: the in-lock re-read must pick up the rotated token,
    // not a stale pre-lock copy.
    serviceAny.getLegacyKeylessOAuthRefreshToken = jest.fn(
      async () => 'passively-rotated-refresh-token',
    );
    serviceAny.saveLegacyKeylessOAuthRefreshToken = jest.fn(
      async () => undefined,
    );
    serviceAny.removeLegacyKeylessOAuthTokens = jest.fn(async () => undefined);
    serviceAny.validateKeylessAccessTokenMatchesLocalWallet = jest.fn(
      async () => undefined,
    );
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: TOKEN,
        refresh_token: 'interactively-rotated-refresh-token',
      }),
    } as any);

    // Another legacy-blob consumer (the passive migration) holds the lock.
    const [, releaseExchangeLock] =
      await serviceAny.legacyKeylessOAuthTokenExchangeMutex.acquire();

    let migrateResolved = false;
    const migratePromise = serviceAny
      .migrateLegacyKeylessOAuthSessionForLocalWallet({
        keylessWallet: wallet,
        ownerId: OWNER_ID,
      })
      .then((result: string | null) => {
        migrateResolved = true;
        return result;
      });

    await waitForScheduledBackgroundTask();

    // The interactive path must queue (the user is actively waiting), and
    // must not read or exchange the blob while the lock is held elsewhere.
    expect(migrateResolved).toBe(false);
    expect(serviceAny.getLegacyKeylessOAuthRefreshToken).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    releaseExchangeLock();

    await expect(migratePromise).resolves.toBe(TOKEN);
    // The in-lock re-read exchanged the rotated token (not a stale copy)…
    expect(fetchSpy).toHaveBeenCalledWith(
      `${KEYLESS_SUPABASE_PROJECT_URL}/auth/v1/token?grant_type=refresh_token`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          refresh_token: 'passively-rotated-refresh-token',
        }),
      }),
    );
    // …persisted the newly rotated token before setSession, and removed the
    // blob after the session was installed.
    expect(serviceAny.saveLegacyKeylessOAuthRefreshToken).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      refreshToken: 'interactively-rotated-refresh-token',
      password: PASSWORD,
    });
    expect(mockSupabaseSetSession).toHaveBeenCalledWith({
      access_token: TOKEN,
      refresh_token: 'interactively-rotated-refresh-token',
    });
    expect(serviceAny.removeLegacyKeylessOAuthTokens).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
    });
  });

  test('interactive migration persists the rotated token before wallet validation so a mismatch cannot strand the consumed token', async () => {
    const { serviceAny, wallet } = createService();
    serviceAny.hasLegacyKeylessOAuthRefreshToken = jest.fn(async () => true);
    serviceAny.getLegacyKeylessOAuthRefreshToken = jest.fn(
      async () => 'legacy-refresh-token',
    );
    serviceAny.saveLegacyKeylessOAuthRefreshToken = jest.fn(
      async () => undefined,
    );
    serviceAny.removeLegacyKeylessOAuthTokens = jest.fn(async () => undefined);
    // Mismatch verdict AFTER the exchange already consumed the stored
    // single-use token (e.g. same-email wallet with a rewritten provider,
    // or a transient hash failure classified as a mismatch).
    serviceAny.validateKeylessAccessTokenMatchesLocalWallet = jest.fn(
      async () => 'token_identity_mismatch',
    );
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: TOKEN,
        refresh_token: 'rotated-refresh-token',
      }),
    } as any);

    await expect(
      serviceAny.migrateLegacyKeylessOAuthSessionForLocalWallet({
        keylessWallet: wallet,
        ownerId: OWNER_ID,
      }),
    ).resolves.toBeNull();

    // The rotated token must be persisted back even though validation
    // failed — the blob would otherwise keep the consumed token and the
    // next attempt's definitive GoTrue rejection would delete the
    // credential for good.
    expect(serviceAny.saveLegacyKeylessOAuthRefreshToken).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      refreshToken: 'rotated-refresh-token',
      password: PASSWORD,
    });
    // A mismatched session must never be installed, and the blob must not
    // be removed.
    expect(mockSupabaseSetSession).not.toHaveBeenCalled();
    expect(serviceAny.removeLegacyKeylessOAuthTokens).not.toHaveBeenCalled();
  });
});

describe('ServiceKeylessWallet.validateKeylessAccessTokenMatchesLocalWallet (real implementation)', () => {
  // Unlike the suites above (which stub this method per-instance), these
  // tests call the REAL private implementation on a fresh service instance:
  // JWT payload decoding via stringUtils.decodeJWT, social-user-id hashing
  // via accountUtils.hashKeylessSocialUserId, and issuer-derived provider
  // comparison with skipFixedProvider=true.
  const accountUtils =
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('@onekeyhq/shared/src/utils/accountUtils').default;

  const GOOGLE_ISSUER = 'https://accounts.google.com';
  const APPLE_ISSUER = 'https://appleid.apple.com';
  const SOCIAL_SUB = 'social-sub-1';

  let matchingSocialUserIdHash: string;

  beforeAll(async () => {
    matchingSocialUserIdHash = await accountUtils.hashKeylessSocialUserId({
      socialUserId: SOCIAL_SUB,
    });
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  // Minimal unsigned JWT with an arbitrary payload; the implementation only
  // base64url-decodes the payload segment (no signature verification).
  function buildSocialJwt(payload: Record<string, unknown>): string {
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString(
      'base64url',
    );
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${header}.${body}.signature`;
  }

  function buildSocialJwtForIssuer(params: {
    sub?: string;
    iss?: string;
  }): string {
    return buildSocialJwt({
      user_metadata: {
        ...(params.sub !== undefined ? { sub: params.sub } : {}),
        ...(params.iss !== undefined ? { iss: params.iss } : {}),
      },
    });
  }

  function createWalletForValidate(overrides: {
    keylessProvider?: string;
    socialUserIdHash?: string;
  }) {
    return createKeylessWallet({
      keylessDetailsInfo: {
        keylessOwnerId: OWNER_ID,
        keylessProvider:
          overrides.keylessProvider ?? EOAuthSocialLoginProvider.Google,
        socialUserIdHash:
          overrides.socialUserIdHash ?? matchingSocialUserIdHash,
      },
    });
  }

  test('returns undefined for a Google token matching the wallet provider and social user id hash', async () => {
    const { serviceAny } = createService();
    await expect(
      serviceAny.validateKeylessAccessTokenMatchesLocalWallet({
        token: buildSocialJwtForIssuer({ sub: SOCIAL_SUB, iss: GOOGLE_ISSUER }),
        keylessWallet: createWalletForValidate({
          keylessProvider: EOAuthSocialLoginProvider.Google,
        }),
      }),
    ).resolves.toBeUndefined();
  });

  test('returns undefined for an Apple token matching an Apple wallet', async () => {
    const { serviceAny } = createService();
    await expect(
      serviceAny.validateKeylessAccessTokenMatchesLocalWallet({
        token: buildSocialJwtForIssuer({ sub: SOCIAL_SUB, iss: APPLE_ISSUER }),
        keylessWallet: createWalletForValidate({
          keylessProvider: EOAuthSocialLoginProvider.Apple,
        }),
      }),
    ).resolves.toBeUndefined();
  });

  test('returns token_provider_mismatch when the token issuer provider differs from the wallet provider', async () => {
    const { serviceAny } = createService();
    await expect(
      serviceAny.validateKeylessAccessTokenMatchesLocalWallet({
        token: buildSocialJwtForIssuer({ sub: SOCIAL_SUB, iss: GOOGLE_ISSUER }),
        keylessWallet: createWalletForValidate({
          keylessProvider: EOAuthSocialLoginProvider.Apple,
        }),
      }),
    ).resolves.toBe('token_provider_mismatch');
  });

  test('ignores fixedKeylessProviderMap rewrites (skipFixedProvider): same-email wallets still mismatch', async () => {
    // Same-email both-providers wallets have their local keylessProvider
    // rewritten via fixedKeylessProviderMap; validation must compare the
    // issuer-derived provider strictly and still report a mismatch.
    const { serviceAny } = createService();
    serviceAny.fixedKeylessProviderMap = {
      [SOCIAL_SUB]: EOAuthSocialLoginProvider.Apple,
    };
    await expect(
      serviceAny.validateKeylessAccessTokenMatchesLocalWallet({
        token: buildSocialJwtForIssuer({ sub: SOCIAL_SUB, iss: GOOGLE_ISSUER }),
        keylessWallet: createWalletForValidate({
          keylessProvider: EOAuthSocialLoginProvider.Apple,
        }),
      }),
    ).resolves.toBe('token_provider_mismatch');
  });

  test('returns token_identity_mismatch when the token social user id hashes to a different value', async () => {
    const { serviceAny } = createService();
    await expect(
      serviceAny.validateKeylessAccessTokenMatchesLocalWallet({
        token: buildSocialJwtForIssuer({
          sub: 'another-social-sub',
          iss: GOOGLE_ISSUER,
        }),
        keylessWallet: createWalletForValidate({}),
      }),
    ).resolves.toBe('token_identity_mismatch');
  });

  test('returns token_identity_mismatch for a malformed (undecodable) token', async () => {
    const { serviceAny } = createService();
    await expect(
      serviceAny.validateKeylessAccessTokenMatchesLocalWallet({
        token: 'not-a-jwt',
        keylessWallet: createWalletForValidate({}),
      }),
    ).resolves.toBe('token_identity_mismatch');
  });

  test('returns token_identity_mismatch when the token payload has no user_metadata.sub', async () => {
    const { serviceAny } = createService();
    await expect(
      serviceAny.validateKeylessAccessTokenMatchesLocalWallet({
        token: buildSocialJwtForIssuer({ iss: GOOGLE_ISSUER }),
        keylessWallet: createWalletForValidate({}),
      }),
    ).resolves.toBe('token_identity_mismatch');
  });

  test('returns token_identity_mismatch when the token issuer is unsupported (error swallowed after hash match)', async () => {
    // Characterization: an unsupported issuer throws inside the try block
    // AFTER the hash comparison passed, so it surfaces as
    // token_identity_mismatch (not token_provider_mismatch).
    const { serviceAny } = createService();
    await expect(
      serviceAny.validateKeylessAccessTokenMatchesLocalWallet({
        token: buildSocialJwtForIssuer({
          sub: SOCIAL_SUB,
          iss: 'https://evil.example.com',
        }),
        keylessWallet: createWalletForValidate({}),
      }),
    ).resolves.toBe('token_identity_mismatch');
  });

  test('returns token_identity_mismatch when the wallet has no keylessDetailsInfo', async () => {
    const { serviceAny } = createService();
    await expect(
      serviceAny.validateKeylessAccessTokenMatchesLocalWallet({
        token: buildSocialJwtForIssuer({ sub: SOCIAL_SUB, iss: GOOGLE_ISSUER }),
        keylessWallet: createKeylessWallet({ keylessDetailsInfo: undefined }),
      }),
    ).resolves.toBe('token_identity_mismatch');
  });

  test('returns token_identity_mismatch when keylessDetailsInfo is missing socialUserIdHash', async () => {
    const { serviceAny } = createService();
    await expect(
      serviceAny.validateKeylessAccessTokenMatchesLocalWallet({
        token: buildSocialJwtForIssuer({ sub: SOCIAL_SUB, iss: GOOGLE_ISSUER }),
        keylessWallet: createKeylessWallet({
          keylessDetailsInfo: {
            keylessOwnerId: OWNER_ID,
            keylessProvider: EOAuthSocialLoginProvider.Google,
          },
        }),
      }),
    ).resolves.toBe('token_identity_mismatch');
  });
});

describe('ServiceKeylessWallet.prepareOneKeyIdLoginWithLocalKeyless', () => {
  test('returns NoLocalKeyless when no local keyless wallet exists', async () => {
    const { service } = createService({ wallet: undefined });
    await expect(
      service.prepareOneKeyIdLoginWithLocalKeyless(),
    ).resolves.toEqual({
      status: EOneKeyIdLoginWithLocalKeylessPrepareStatus.NoLocalKeyless,
    });
  });

  test('returns ContinueWithKeyless when the active session matches the local wallet', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getActiveKeylessOAuthAccessTokenMatchingLocalWallet = jest.fn(
      async () => TOKEN,
    );
    await expect(
      service.prepareOneKeyIdLoginWithLocalKeyless(),
    ).resolves.toEqual({
      status: EOneKeyIdLoginWithLocalKeylessPrepareStatus.ContinueWithKeyless,
      provider: EOAuthSocialLoginProvider.Google,
    });
  });

  test('degrades a transient session probe failure to NeedOAuthLogin with the wallet provider, never NoLocalKeyless', async () => {
    // A retryable Supabase auth error rethrown by
    // getActiveKeylessOAuthAccessToken must not be reported as
    // NoLocalKeyless: that status drops the provider lock and the
    // token-matches-wallet guard in the bind/login UI while the local
    // Keyless wallet actually exists.
    const { service, serviceAny } = createService();
    serviceAny.getActiveKeylessOAuthAccessTokenMatchingLocalWallet = jest.fn(
      async () => {
        throw new OneKeyLocalError('AuthRetryableFetchError');
      },
    );
    await expect(
      service.prepareOneKeyIdLoginWithLocalKeyless(),
    ).resolves.toEqual({
      status: EOneKeyIdLoginWithLocalKeylessPrepareStatus.NeedOAuthLogin,
      provider: EOAuthSocialLoginProvider.Google,
    });
  });

  test('degrades a legacy refresh token probe failure to NeedOAuthLogin with the wallet provider', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getActiveKeylessOAuthAccessTokenMatchingLocalWallet = jest.fn(
      async () => null,
    );
    serviceAny.hasLegacyKeylessOAuthRefreshToken = jest.fn(async () => {
      throw new OneKeyLocalError('storage read failed');
    });
    await expect(
      service.prepareOneKeyIdLoginWithLocalKeyless(),
    ).resolves.toEqual({
      status: EOneKeyIdLoginWithLocalKeylessPrepareStatus.NeedOAuthLogin,
      provider: EOAuthSocialLoginProvider.Google,
    });
  });
});

describe('ServiceKeylessWallet.prepareKeylessCreateWithOneKeyId', () => {
  test('requests a silent legacy OAuth reauthentication when the selected provider is already bound', async () => {
    const { service, backgroundApi } = createService({ wallet: undefined });
    backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );
    backgroundApi.servicePrime.isOAuthProviderBoundToCurrentOneKeyId.mockResolvedValue(
      true,
    );

    await expect(
      service.prepareKeylessCreateWithOneKeyId({
        signInProvider: EOAuthSocialLoginProvider.Google,
      }),
    ).resolves.toEqual({
      status: EKeylessCreateWithOneKeyIdPrepareStatus.NeedLegacyOAuthReauth,
      displayEmail: 'legacy@example.com',
    });
    expect(
      backgroundApi.servicePrime.isOAuthProviderBoundToCurrentOneKeyId,
    ).toHaveBeenCalledWith({
      provider: EOAuthSocialLoginProvider.Google,
    });
  });

  test('keeps the add-sign-in dialog when the selected provider is not bound', async () => {
    const { service, backgroundApi } = createService({ wallet: undefined });
    backgroundApi.simpleDb.prime.getEffectiveAuthSessionSource.mockResolvedValue(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
    );

    await expect(
      service.prepareKeylessCreateWithOneKeyId({
        signInProvider: EOAuthSocialLoginProvider.Apple,
      }),
    ).resolves.toEqual({
      status: EKeylessCreateWithOneKeyIdPrepareStatus.NeedLegacyOAuthBind,
      displayEmail: 'legacy@example.com',
    });
  });

  test('does not run the profile precheck when OneKey ID is logged out', async () => {
    const { service, backgroundApi } = createService({ wallet: undefined });
    backgroundApi.servicePrime.isLoggedIn.mockResolvedValue(false);

    await expect(
      service.prepareKeylessCreateWithOneKeyId({
        signInProvider: EOAuthSocialLoginProvider.Google,
      }),
    ).resolves.toEqual({
      status: EKeylessCreateWithOneKeyIdPrepareStatus.NeedOneKeyIdOAuthLogin,
      displayEmail: 'legacy@example.com',
    });
    expect(
      backgroundApi.servicePrime.isOAuthProviderBoundToCurrentOneKeyId,
    ).not.toHaveBeenCalled();
  });
});
