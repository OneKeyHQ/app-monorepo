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

const { EOAuthSocialLoginProvider } =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@onekeyhq/shared/src/consts/authConsts');

const ServiceKeylessWallet =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./ServiceKeylessWallet').default;

const NOW = 1_800_000_000_000;
const TOKEN = 'access-token';
const REFRESH_TOKEN = 'refresh-token';
const PASSWORD = 'encoded-password';
const WALLET_ID = 'keyless-wallet-1';
const OWNER_ID = 'owner-1';
const SOCIAL_USER_ID_HASH = 'social-user-hash-1';
const HASH_ID = 'server-hash-id-1';

const backendShareData: IKeylessBackendShare = {
  encryptedMnemonic: 'encrypted-mnemonic',
  backendShare: 'backend-share',
  juiceboxShareX: 2,
};

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
    },
  };
  const service = new ServiceKeylessWallet({ backgroundApi });
  backgroundApi.serviceKeylessWallet = service;
  return { service, serviceAny: service, backgroundApi, wallet };
}

function mockPassiveV1HappyPath(serviceAny: any) {
  serviceAny.getKeylessAccessTokenWithoutPrompt = jest.fn(async () => ({
    accessToken: TOKEN,
    refreshToken: REFRESH_TOKEN,
  }));
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
    serviceAny.getKeylessAccessTokenWithoutPrompt = jest.fn(async () => null);

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

    expect(serviceAny.getKeylessAccessTokenWithoutPrompt).toHaveBeenCalledTimes(
      1,
    );
  });

  test('retries passive migration after the 24-hour failure throttle window', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getKeylessAccessTokenWithoutPrompt = jest.fn(async () => null);

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

    expect(serviceAny.getKeylessAccessTokenWithoutPrompt).toHaveBeenCalledTimes(
      2,
    );
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
    serviceAny.getKeylessAccessTokenWithoutPrompt = jest.fn(async () => null);

    await expect(
      service.tryMigrateLocalExistingKeylessBackendShareToV2(),
    ).resolves.toMatchObject({
      skipped: true,
      reason: 'token_missing',
    });

    expect(serviceAny.getKeylessAccessTokenWithoutPrompt).toHaveBeenCalledTimes(
      1,
    );
    expect(migrationPersist.byWalletId[WALLET_ID]).toMatchObject({
      ownerId: OWNER_ID,
      socialUserIdHash: SOCIAL_USER_ID_HASH,
      succeededAt: undefined,
    });
  });

  test('does not write server or save refreshed tokens when token social identity mismatches local wallet', async () => {
    const { service, serviceAny } = createService();
    serviceAny.getKeylessAccessTokenWithoutPrompt = jest.fn(async () => ({
      accessToken: TOKEN,
      refreshToken: REFRESH_TOKEN,
    }));
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
    serviceAny.getKeylessAccessTokenWithoutPrompt = jest.fn(async () => ({
      accessToken: TOKEN,
      refreshToken: REFRESH_TOKEN,
    }));
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
    serviceAny.getKeylessAccessTokenWithoutPrompt = jest.fn(async () => ({
      accessToken: TOKEN,
      refreshToken: REFRESH_TOKEN,
    }));
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
    serviceAny.getKeylessAccessTokenWithoutPrompt = jest.fn(async () => ({
      accessToken: TOKEN,
    }));
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
});
