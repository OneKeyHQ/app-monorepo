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

const mockSaveTokensToStorage = jest.fn();
const mockGetRefreshTokenFromStorageWithPassword = jest.fn();
const mockGetAccessTokenFromStorage = jest.fn();

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
    updateKeylessWalletDetailsInfo: jest.fn(),
  },
}));

jest.mock('../../states/jotai/atoms', () => ({
  keylessBackendShareV2MigrationPersistAtom: mockMigrationAtom,
  keylessDialogAtom: {},
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

jest.mock('./utils/keylessRefreshTokenStorage', () => ({
  __esModule: true,
  default: {
    getAccessTokenFromStorage: mockGetAccessTokenFromStorage,
    getRefreshTokenFromStorageWithPassword:
      mockGetRefreshTokenFromStorageWithPassword,
    saveTokensToStorage: mockSaveTokensToStorage,
    removeTokensFromStorage: jest.fn(),
  },
}));

jest.mock('./utils/keylessMnemonicPasswordStorage', () => ({
  __esModule: true,
  default: {
    getMnemonicPasswordFromStorage: jest.fn(),
    saveMnemonicPasswordToStorage: jest.fn(),
    removeMnemonicPasswordFromStorage: jest.fn(),
  },
}));

jest.mock('./utils/keylessAuthPackCache', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('./utils/keylessDeviceKeyStorage', () => ({
  __esModule: true,
  default: {},
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
  },
}));

const {
  decryptRevealableSeed,
  decryptStringAsync,
  encryptStringAsync,
  revealEntropyToMnemonic,
} =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@onekeyhq/core/src/secret');
const {
  EOAuthSocialLoginProvider,
  KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_PREFIX_V2,
  KEYLESS_BACKEND_SHARE_PAYLOAD_OWNER_V2_PASSWORD_FIXED_UUID,
} =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@onekeyhq/shared/src/consts/authConsts');
const { OneKeyLocalError } =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@onekeyhq/shared/src/errors');

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
const REFRESH_TOKEN = 'refresh-token';
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
  const wallet = params.wallet ?? createKeylessWallet();
  const backgroundApi: any = {
    serviceAccount: {
      getKeylessWallet: jest.fn(async () => wallet),
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
      refreshToken: REFRESH_TOKEN,
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
    ownerId: params.backendOwnerId ?? OWNER_ID,
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
    mockSaveTokensToStorage.mockResolvedValue(undefined);
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

  test('does not consume the 24-hour throttle when Prime API meta call fails with AxiosNetworkError', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => ({ accessToken: TOKEN, refreshToken: REFRESH_TOKEN }),
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
      async () => ({ accessToken: TOKEN, refreshToken: REFRESH_TOKEN }),
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
      async () => ({ accessToken: TOKEN, refreshToken: REFRESH_TOKEN }),
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

  test('refresh helper surfaces 429 from Supabase auth as a network error so the throttle is not consumed', async () => {
    const { service, serviceAny } = createService();
    mockGetRefreshTokenFromStorageWithPassword.mockResolvedValue(REFRESH_TOKEN);
    const originalFetch = (globalThis as { fetch?: typeof fetch }).fetch;
    const fetchMock = jest.fn(
      async () =>
        ({
          ok: false,
          status: 429,
          json: async () => ({}),
        }) as unknown as Response,
    );
    (globalThis as { fetch?: unknown }).fetch = fetchMock;
    try {
      const { KeylessPassiveMigrationNetworkError } =
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./keylessPassiveMigrationErrors');
      await expect(
        serviceAny.refreshAccessTokenForKeylessBackendShareV2MigrationPassive({
          ownerId: OWNER_ID,
          password: PASSWORD,
        }),
      ).rejects.toBeInstanceOf(KeylessPassiveMigrationNetworkError);
    } finally {
      if (originalFetch) {
        (globalThis as { fetch?: typeof fetch }).fetch = originalFetch;
      } else {
        delete (globalThis as { fetch?: unknown }).fetch;
      }
    }
    expect(service).toBeDefined();
  });

  test('does not consume the 24-hour throttle when Prime API call fails with a client-side timeout', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => ({ accessToken: TOKEN, refreshToken: REFRESH_TOKEN }),
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
      async () => ({ accessToken: TOKEN, refreshToken: REFRESH_TOKEN }),
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

  test('does not write server or save refreshed tokens when token social identity mismatches local wallet', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => ({
        accessToken: TOKEN,
        refreshToken: REFRESH_TOKEN,
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
    expect(mockSaveTokensToStorage).not.toHaveBeenCalled();
  });

  test('does not write server or save refreshed tokens when token provider mismatches local wallet', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => ({
        accessToken: TOKEN,
        refreshToken: REFRESH_TOKEN,
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
    expect(mockSaveTokensToStorage).not.toHaveBeenCalled();
  });

  test('does not write server or save refreshed tokens when token and server hash derive a different ownerId', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getAccessTokenForKeylessBackendShareV2MigrationPassive = jest.fn(
      async () => ({
        accessToken: TOKEN,
        refreshToken: REFRESH_TOKEN,
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
    expect(mockSaveTokensToStorage).not.toHaveBeenCalled();
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

  test('saves refreshed token only after identity and owner checks pass', async () => {
    const { service, serviceAny, backgroundApi } = createService();
    mockPassiveV1HappyPath(serviceAny);

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      migrated: true,
      skipped: false,
    });

    expect(mockSaveTokensToStorage).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      refreshToken: REFRESH_TOKEN,
      token: TOKEN,
      password: PASSWORD,
      backgroundApi,
    });
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

  test('submits v1 mirror when uploading keyless backend share v2', async () => {
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
    serviceAny.encryptKeylessBackendSharePayloadV1 = jest.fn(
      async () => 'backend-share-raw-v1-mirror',
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
    serviceAny.encryptKeylessBackendSharePayloadV1 = jest.fn(
      async () => 'backend-share-raw-v1-mirror',
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
        refreshToken: REFRESH_TOKEN,
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
        refreshToken: REFRESH_TOKEN,
        newPin: PIN,
      }),
    ).rejects.toThrow('reset pin confirm status failed');
  });

  test('rewrites backend share v2 when reset pin target owner changes', async () => {
    const { serviceAny } = createService();
    const resetBackendShareData = mockResetPinHappyPath(serviceAny, {
      backendOwnerId: 'legacy-owner-id',
    });
    serviceAny.apiResetPinConfirmStatus = jest.fn(async () => undefined);

    await expect(
      serviceAny.resetKeylessWalletPin({
        token: TOKEN,
        refreshToken: REFRESH_TOKEN,
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
        refreshToken: REFRESH_TOKEN,
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
      refreshToken: REFRESH_TOKEN,
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
});
