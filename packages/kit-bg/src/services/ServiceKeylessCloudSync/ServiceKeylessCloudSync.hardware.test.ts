import { createHash } from 'crypto';

import { EDeviceType } from '@onekeyfe/hd-shared';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { buildHardwareCloudSyncAuthMessage } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';
import { ECloudSyncMode } from '@onekeyhq/shared/types/keylessCloudSync';

import localDb from '../../dbs/local/localDb';
import { LocalDbBaseContainer } from '../../dbs/local/LocalDbBaseContainer';
import { EIndexedDBBucketNames } from '../../dbs/local/types';
import { primeCloudSyncPersistAtom } from '../../states/jotai/atoms';
import keylessSyncCredentialStorage from '../ServiceKeylessWallet/utils/keylessSyncCredentialStorage';
import { isSupportedCloudSyncDataType } from '../ServicePrimeCloudSync/cloudSyncCheckUtils';

import * as hardwareMigration from './hardwareCloudSyncMigration';
import { generateHardwareCloudSyncCredentialWithSdk } from './hardwareCloudSyncSdk';
import {
  bootstrapHardwareCloudSyncDataKey,
  requestHardwareCloudSyncChallenge,
  verifyHardwareCloudSyncChallenge,
} from './hardwareCloudSyncSession';
import ServiceKeylessCloudSync from './ServiceKeylessCloudSync';

import type {
  IDBCloudSyncItem,
  IDBDevice,
  IDBWallet,
  ILocalDBAgent,
  ILocalDBWithTransactionTask,
} from '../../dbs/local/types';
import type { IPrimeCloudSyncPersistAtomData } from '../../states/jotai/atoms/prime';
import type { AxiosInstance } from 'axios';

let mockUseTestEndpoint = false;
let mockConfig: IPrimeCloudSyncPersistAtomData;
let mockStored: IKeylessCloudSyncCredential | undefined;

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { app: { error: { log: jest.fn() } } },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  // Production build: no development gate applies.
  default: { isDev: false, isDesktop: true },
}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const decorator =
    () =>
    (...args: unknown[]) =>
      args.length === 1 ? args[0] : args[2];
  return {
    backgroundClass: decorator,
    backgroundMethod: decorator,
    backgroundMethodForDev: decorator,
    toastIfError: decorator,
  };
});
jest.mock('../../states/jotai/atoms', () => ({
  devSettingsPersistAtom: {
    get: jest.fn(async () => ({
      enabled: true,
      settings: { enableTestEndpoint: mockUseTestEndpoint },
    })),
  },
  primeCloudSyncPersistAtom: {
    get: jest.fn(async () => mockConfig),
    set: jest.fn(
      async (
        update: (
          value: IPrimeCloudSyncPersistAtomData,
        ) => IPrimeCloudSyncPersistAtomData,
      ) => {
        mockConfig = update(mockConfig);
      },
    ),
  },
}));
jest.mock('./hardwareCloudSyncSdk', () => ({
  generateHardwareCloudSyncCredentialWithSdk: jest.fn(),
}));
jest.mock('./hardwareCloudSyncMigration', () => ({
  ...jest.requireActual<typeof import('./hardwareCloudSyncMigration')>(
    './hardwareCloudSyncMigration',
  ),
  migrateHardwareCloudSyncRecords: jest.fn(),
}));
// Sign-in and the data key need the server; the key under test stays the
// device-derived one, as if this device created the data key.
jest.mock('./hardwareCloudSyncSession', () => {
  const actual = jest.requireActual<
    typeof import('./hardwareCloudSyncSession')
  >('./hardwareCloudSyncSession');
  return {
    assertHardwareCloudSyncChallengeFor:
      actual.assertHardwareCloudSyncChallengeFor,
    getHardwareCloudSyncDeviceKeyThumbprint:
      actual.getHardwareCloudSyncDeviceKeyThumbprint,
    createHardwareCloudSyncDeviceKey: jest.fn(() => ({
      kty: 'EC',
      crv: 'P-256',
      x: 'public-test-x',
      y: 'public-test-y',
      d: 'public-test-d',
    })),
    requestHardwareCloudSyncChallenge: jest.fn(
      async ({
        jwk,
        identityTag,
        env,
      }: Parameters<typeof actual.requestHardwareCloudSyncChallenge>[0]) => ({
        challengeId: 'public-test-challenge',
        message: buildHardwareCloudSyncAuthMessage({
          identityTag,
          env,
          jkt: actual.getHardwareCloudSyncDeviceKeyThumbprint(jwk),
          nonce: 'ab'.repeat(32),
          expires: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        }),
      }),
    ),
    verifyHardwareCloudSyncChallenge: jest.fn(async () => ({
      accessToken: 'public-test-access',
      accessTokenExpiresAt: Number.MAX_SAFE_INTEGER,
      refreshToken: 'public-test-refresh',
      sessionId: 'public-test-session',
      dekId: '',
    })),
    bootstrapHardwareCloudSyncDataKey: jest.fn(
      async ({
        deriveKek,
      }: {
        deriveKek: (kekSalt: string) => Promise<string>;
      }) => ({
        dek: await deriveKek('00'.repeat(16)),
        dekId: 'public-test-dek',
        pwdHash: 'keyless-test-hardware',
        previousPwdHashes: [],
      }),
    ),
    getCurrentHardwareCloudSyncDataKeyId: jest.fn(),
    isHardwareCloudSyncKeyEnvelopeItem: jest.fn(() => false),
    isHardwareCloudSyncUnauthorizedError: jest.fn(() => false),
    revokeHardwareCloudSyncSession: jest.fn(async () => undefined),
    refreshHardwareCloudSyncSessionIfNeeded: jest.fn(async () => undefined),
    requestRawWithHardwareCloudSyncSession: jest.fn(),
    rotateHardwareCloudSyncDataKey: jest.fn(),
    reencryptHardwareCloudSyncItems: jest.fn(
      async ({ items }: { items: unknown[] }) => items,
    ),
    isHardwareCloudSyncNonceInvalidError: jest.fn(() => false),
  };
});

type IDeviceParams = Pick<
  Parameters<typeof generateHardwareCloudSyncCredentialWithSdk>[0],
  'unlock'
>;
// Runs the service's unlock (sign-in, then the data key) as the SDK does.
const signIn = async ({ unlock }: IDeviceParams) => {
  await unlock({
    credentialId: `hardware-cloud-v1-${'a'.repeat(64)}`,
    signAuth: async () => 'public-test-signature',
    deriveKek: async () => 'public-test-kek',
  });
};
// A device result that also completes the unlock, as the SDK does.
function withSignIn<T>(value: T) {
  return async (params: IDeviceParams) => {
    await signIn(params);
    return value;
  };
}
jest.mock('../ServiceKeylessWallet/utils/keylessSyncCredentialStorage', () => ({
  __esModule: true,
  default: {
    getPendingHardwareKeyMigration: jest.fn(async () =>
      mockStored?.pendingHardwareKeyMigration ? mockStored : undefined,
    ),
    getCredential: jest.fn(async (id: string) =>
      mockStored?.keylessWalletId === id ? mockStored : null,
    ),
    saveCredential: jest.fn(async (credential: IKeylessCloudSyncCredential) => {
      mockStored = credential;
    }),
    removeAllCredentials: jest.fn(async () => {
      mockStored = undefined;
    }),
  },
}));

const connectId = 'public-test-connect';
const source = {
  type: 'hardware' as const,
  credentialId: `hardware-cloud-v1-${'a'.repeat(64)}`,
  derivationVersion: 1 as const,
  deviceName: 'OneKey Pro',
  deviceType: EDeviceType.Pro,
};
const credential: IKeylessCloudSyncCredential = {
  keylessWalletId: source.credentialId,
  signingPrivateKey: 'public-test-placeholder-private',
  signingPublicKey: 'public-test-key',
  encryptionKey: 'public-test-placeholder-encryption',
  pwdHash: 'keyless-test-hardware',
  source,
};

const servicesToClear = new Set<ServiceKeylessCloudSync>();

// The post-activation sync keeps its dialog up for a second.
beforeEach(() => {
  jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
  mockUseTestEndpoint = false;
});

function setup(items: Array<Partial<IDBCloudSyncItem>> = []) {
  const storedItems: IDBCloudSyncItem[] = items.map((item, index) => ({
    id: `public-test-record-${index}`,
    rawKey: '',
    rawData: '',
    dataType: EPrimeCloudSyncDataType.IndexedAccount,
    data: '',
    dataTime: 1,
    isDeleted: false,
    pwdHash: '',
    localSceneUpdated: true,
    serverUploaded: false,
    ...item,
  }));
  const initLocalSyncItemsDB = jest.fn(async () => undefined);
  const clearCachedSyncCredential = jest.fn(
    async (): Promise<void> => undefined,
  );
  const backgroundApi = {
    serviceAccount: {
      getKeylessWallet: jest.fn(async () => ({ id: 'hd-keyless-test' })),
      getAllWallets: jest.fn(async () => ({ wallets: [] })),
    },
    servicePrime: {
      apiFetchPrimeUserInfo: jest.fn(async () => undefined),
    },
    serviceApp: {
      isAppLocked: jest.fn(async () => false),
      showToast: jest.fn(async () => undefined),
    },
    servicePassword: {
      promptPasswordVerify: jest.fn(async () => ({
        password: 'public-test-password',
      })),
    },
    servicePrimeCloudSync: {
      setCloudSyncEnabledWithKeyLock: jest.fn(async (enabled: boolean) => {
        mockConfig.isCloudSyncEnabled = enabled;
      }),
      startServerSyncFlow: jest.fn(async () => undefined),
      startServerSyncFlowSilently: jest.fn(async () => undefined),
      updateLastSyncTime: jest.fn(async () => undefined),
      getAllLocalSyncItems: jest.fn(
        async (options?: { includeUnsupportedDataTypes?: boolean }) => ({
          items: options?.includeUnsupportedDataTypes
            ? storedItems
            : storedItems.filter((item) =>
                isSupportedCloudSyncDataType(item.dataType),
              ),
        }),
      ),
      resolvePasswordOnlyIfHdXfpMissing: jest.fn(
        async (): Promise<string | undefined> => undefined,
      ),
      clearCachedSyncCredential,
      initLocalSyncItemsDB,
    },
  };
  const service = new ServiceKeylessCloudSync({ backgroundApi });
  // Hardware requests use the plain Prime client, not the OneKey ID one.
  const getClient = jest
    .spyOn(service, 'getClient')
    .mockResolvedValue({} as AxiosInstance);
  clearCachedSyncCredential.mockImplementation(async () =>
    service.clearKeylessCloudSyncCredentialCache(),
  );
  servicesToClear.add(service);
  return { service, backgroundApi, initLocalSyncItemsDB, getClient };
}

describe('hardware Cloud key source lifecycle', () => {
  afterEach(() => {
    servicesToClear.forEach((service) =>
      service.clearKeylessCloudSyncCredentialCache(),
    );
    servicesToClear.clear();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = {
      isCloudSyncEnabled: false,
      isCloudSyncEnabledKeyless: false,
    };
    mockStored = undefined;
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementation(withSignIn({ credential, source }));
  });

  test('skips account label refreshes when the Cloud source has a Bluetooth name', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = {
      ...source,
      deviceName: 'Neo 1797',
      deviceBleName: 'Neo 1797',
    };
    const getWallet = jest.spyOn(localDb, 'getWalletSafe');
    try {
      await service.syncHardwareCloudSyncDeviceLabel({
        walletId: 'hw-device-1',
        label: 'New label',
      });
      expect(getWallet).not.toHaveBeenCalled();
      expect(mockConfig.hardwareCloudSyncKeySource.deviceName).toBe('Neo 1797');
    } finally {
      getWallet.mockRestore();
    }
  });

  test.each([
    { bleName: undefined, expectedName: 'Latest label' },
    { bleName: 'Neo 1797', expectedName: 'Neo 1797' },
  ])(
    'reuses the matching account device name $expectedName',
    async ({ bleName, expectedName }) => {
      const { service } = setup();
      const xfp = `00001234--xpub${'A'.repeat(107)}`;
      mockConfig.hardwareCloudSyncKeySource = {
        ...source,
        credentialId: `hardware-cloud-v1-${createHash('sha256').update(xfp).digest('hex')}`,
        deviceName: 'Old label',
      };
      const getWallet = jest.spyOn(localDb, 'getWalletSafe').mockResolvedValue({
        id: 'hw-device-1',
        associatedDevice: 'device-1',
        xfp,
      } as IDBWallet);
      const getDevice = jest.spyOn(localDb, 'getDeviceSafe').mockResolvedValue({
        id: 'device-1',
        name: 'Latest label',
        featuresInfo: { bleName },
      } as IDBDevice);
      try {
        await service.syncHardwareCloudSyncDeviceLabel({
          walletId: 'hw-device-1',
          label: 'Latest label',
        });
        expect(mockConfig.hardwareCloudSyncKeySource.deviceName).toBe(
          expectedName,
        );
        expect(mockConfig.hardwareCloudSyncKeySource.deviceBleName).toBe(
          bleName,
        );
      } finally {
        getWallet.mockRestore();
        getDevice.mockRestore();
      }
    },
  );

  test('ignores another hardware wallet when refreshing the fallback label', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = {
      ...source,
      deviceName: 'Old label',
    };
    const getWallet = jest.spyOn(localDb, 'getWalletSafe').mockResolvedValue({
      id: 'hw-device-1',
      associatedDevice: 'device-1',
      xfp: `00001234--xpub${'A'.repeat(107)}`,
    } as IDBWallet);
    const getDevice = jest.spyOn(localDb, 'getDeviceSafe');
    try {
      await service.syncHardwareCloudSyncDeviceLabel({
        walletId: 'hw-device-1',
        label: 'Other device label',
      });
      expect(getDevice).not.toHaveBeenCalled();
      expect(mockConfig.hardwareCloudSyncKeySource.deviceName).toBe(
        'Old label',
      );
    } finally {
      getWallet.mockRestore();
      getDevice.mockRestore();
    }
  });

  test.each(['challenge', 'hardware signature', 'verification'] as const)(
    'aborts when the trusted environment switches during %s',
    async (phase) => {
      const { service } = setup();
      const signAuth = jest.fn(async () => {
        if (phase === 'hardware signature') mockUseTestEndpoint = true;
        return 'public-test-signature';
      });
      jest
        .mocked(generateHardwareCloudSyncCredentialWithSdk)
        .mockImplementationOnce(async ({ unlock }) => {
          await unlock({
            credentialId: source.credentialId,
            signAuth,
            deriveKek: async () => 'public-test-kek',
          });
          return { credential, source };
        });
      if (phase === 'challenge') {
        const request = jest
          .mocked(requestHardwareCloudSyncChallenge)
          .getMockImplementation();
        if (!request) throw new OneKeyLocalError('Missing challenge fixture');
        jest
          .mocked(requestHardwareCloudSyncChallenge)
          .mockImplementationOnce(async (params) => {
            const result = await request(params);
            mockUseTestEndpoint = true;
            return result;
          });
      }
      if (phase === 'verification') {
        const verify = jest
          .mocked(verifyHardwareCloudSyncChallenge)
          .getMockImplementation();
        if (!verify) throw new OneKeyLocalError('Missing verification fixture');
        jest
          .mocked(verifyHardwareCloudSyncChallenge)
          .mockImplementationOnce(async (params) => {
            const result = await verify(params);
            mockUseTestEndpoint = true;
            return result;
          });
      }
      await expect(
        service.enableHardwareCloudSync({ connectId }),
      ).rejects.toThrow('Cloud sync environment changed');
      expect(signAuth).toHaveBeenCalledTimes(phase === 'challenge' ? 0 : 1);
      expect(verifyHardwareCloudSyncChallenge).toHaveBeenCalledTimes(
        phase === 'verification' ? 1 : 0,
      );
      expect(bootstrapHardwareCloudSyncDataKey).not.toHaveBeenCalled();
      expect(
        keylessSyncCredentialStorage.saveCredential,
      ).not.toHaveBeenCalled();
    },
  );

  test('rejects an old server template before hardware signing or session creation', async () => {
    const { service } = setup();
    const signAuth = jest.fn(async () => 'public-test-signature');
    jest.mocked(requestHardwareCloudSyncChallenge).mockResolvedValueOnce({
      challengeId: 'legacy',
      message: 'OneKey Cloud Sync sign-in\nNonce: abc',
    });
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementationOnce(async ({ unlock }) => {
        await unlock({
          credentialId: source.credentialId,
          signAuth,
          deriveKek: async () => 'public-test-kek',
        });
        return { credential, source };
      });
    await expect(
      service.enableHardwareCloudSync({ connectId }),
    ).rejects.toMatchObject({
      key: ETranslations.cloud_sync_data_unreadable__msg,
    });
    expect(signAuth).not.toHaveBeenCalled();
    expect(verifyHardwareCloudSyncChallenge).not.toHaveBeenCalled();
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
  });

  test('activates one source using the existing credential storage and cache', async () => {
    const { service, initLocalSyncItemsDB } = setup();
    await service.enableHardwareCloudSync({ connectId });
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(source);
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
    expect(mockConfig.isCloudSyncEnabled).toBe(false);
    expect(mockStored).toEqual(expect.objectContaining(credential));
    expect(await service.getKeylessCloudSyncCredential()).toEqual(
      expect.objectContaining(credential),
    );
    expect(initLocalSyncItemsDB).toHaveBeenCalledWith(
      expect.objectContaining({
        syncCredential: expect.objectContaining({
          keylessCredential: expect.objectContaining(credential),
        }),
        askPasswordOnlyIfHdXfpMissing: true,
      }),
    );
    service.clearKeylessCloudSyncCredentialCache();
    expect(await service.getKeylessCloudSyncCredential()).toEqual(
      expect.objectContaining(credential),
    );
  });

  test('announces each device confirmation, two more for a key another device made first', async () => {
    const { service } = setup();
    const progress: Array<{ current: number; total: number }> = [];
    const onProgress = (value: { current: number; total: number }) => {
      progress.push(value);
    };
    appEventBus.on(EAppEventBusNames.HardwareCloudKeySignProgress, onProgress);
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementationOnce(async (params) => {
        // Sign in, this device's key twice, then the winner's key twice.
        for (let i = 0; i < 5; i += 1) params.onDeviceSign?.();
        return withSignIn({ credential, source })(params);
      });
    try {
      await service.enableHardwareCloudSync({ connectId });
    } finally {
      appEventBus.off(
        EAppEventBusNames.HardwareCloudKeySignProgress,
        onProgress,
      );
    }
    expect(progress).toEqual([
      { current: 1, total: 3 },
      { current: 2, total: 3 },
      { current: 3, total: 3 },
      { current: 4, total: 5 },
      { current: 5, total: 5 },
    ]);
  });

  test('activation passes a password asked before the device prompt', async () => {
    const { service, backgroundApi, initLocalSyncItemsDB } = setup();
    const resolve =
      backgroundApi.servicePrimeCloudSync.resolvePasswordOnlyIfHdXfpMissing;
    resolve.mockResolvedValueOnce('public-test-password');
    await service.enableHardwareCloudSync({ connectId });
    expect(resolve.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(generateHardwareCloudSyncCredentialWithSdk).mock
        .invocationCallOrder[0],
    );
    expect(initLocalSyncItemsDB).toHaveBeenCalledWith(
      expect.objectContaining({
        password: 'public-test-password',
        askPasswordOnlyIfHdXfpMissing: true,
      }),
    );
  });

  test('startup recovery finishes before queued writers and reads inside the key lock do not deadlock', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockStored = credential;
    let finishRecovery: (() => void) | undefined;
    const recoveryGate = new Promise<void>((resolve) => {
      finishRecovery = resolve;
    });
    jest
      .mocked(keylessSyncCredentialStorage.getPendingHardwareKeyMigration)
      .mockImplementationOnce(async () => {
        await recoveryGate;
        return undefined;
      });
    let wrote = false;
    const hydrate = service.hydrateKeylessSyncCredentialFromStorageIfNeeded();
    const write = service.runWithCloudSyncKeyLock(async () => {
      expect(await service.getKeylessCloudSyncCredential()).toEqual(credential);
      wrote = true;
    });
    await Promise.resolve();
    expect(wrote).toBe(false);
    finishRecovery?.();
    await Promise.all([hydrate, write]);
    expect(wrote).toBe(true);
    expect(
      keylessSyncCredentialStorage.getPendingHardwareKeyMigration,
    ).toHaveBeenCalledTimes(1);
  });

  test('the real account transaction warm-up does not re-enter its recovery lock', async () => {
    jest.useFakeTimers();
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    const hardwareSession = {
      deviceKeyJwk: {
        kty: 'EC' as const,
        crv: 'P-256' as const,
        x: 'public-x',
        y: 'public-y',
        d: 'public-d',
      },
      accessToken: 'public-access',
      accessTokenExpiresAt: Number.MAX_SAFE_INTEGER,
      refreshToken: 'public-refresh',
      sessionId: 'public-session',
      dekId: 'public-dek',
    };
    const target = {
      ...credential,
      hardwareSession,
      keylessWalletId: 'hardware-cloud-v1-recovery-target',
      pwdHash: 'target-pwd',
      source: { ...source, credentialId: 'hardware-cloud-v1-recovery-target' },
    };
    mockStored = {
      ...credential,
      hardwareSession,
      pendingHardwareKeyMigration: {
        target,
        recordsHash: 'public-hash',
        phase: 'committing',
      },
    };
    let finishTransaction: (() => void) | undefined;
    const transactionGate = new Promise<void>((resolve) => {
      finishTransaction = resolve;
    });
    const withTransaction = jest.fn(
      async <T>(
        _bucket: EIndexedDBBucketNames,
        task: ILocalDBWithTransactionTask<T>,
      ) => {
        await transactionGate;
        return task({} as Parameters<ILocalDBWithTransactionTask<T>>[0]);
      },
    );
    const agent = { withTransaction } as unknown as ILocalDBAgent;
    class TestContainer extends LocalDbBaseContainer {
      override async reset() {}
      override get readyDb() {
        return Promise.resolve(agent);
      }
    }
    const container = new TestContainer();
    jest.spyOn(travelModeManager, 'getRuntimeEnvironment').mockResolvedValue({
      persistence: {
        run: async <T>({ operation }: { operation: () => Promise<T> }) =>
          operation(),
      },
    } as unknown as Awaited<
      ReturnType<typeof travelModeManager.getRuntimeEnvironment>
    >);
    const previousProxy = appGlobals.$backgroundApiProxy;
    appGlobals.$backgroundApiProxy = {
      serviceKeylessCloudSync: service,
    } as typeof previousProxy;
    jest
      .spyOn(localDb, 'updateSyncItem')
      .mockImplementation(async () =>
        container.withTransaction(
          EIndexedDBBucketNames.account,
          async () => undefined,
        ),
      );
    try {
      const recovery = service.runWithCloudSyncKeyLock(async () => undefined);
      await jest.advanceTimersByTimeAsync(0);
      // This task starts only after the real warm-up resolves, with no 5s timer advance.
      expect(withTransaction).toHaveBeenCalledTimes(1);
      let readFinished = false;
      const read = service.getKeylessCloudSyncCredential().then(() => {
        readFinished = true;
      });
      await jest.advanceTimersByTimeAsync(0);
      expect(readFinished).toBe(false);
      finishTransaction?.();
      await Promise.all([recovery, read]);
      expect(readFinished).toBe(true);
      expect(mockStored?.pendingHardwareKeyMigration?.phase).toBe('prepared');
    } finally {
      finishTransaction?.();
      appGlobals.$backgroundApiProxy = previousProxy;
      jest.useRealTimers();
    }
  });

  test('activation without HD wallets to fill does not ask', async () => {
    const { service, backgroundApi, initLocalSyncItemsDB } = setup();
    await service.enableHardwareCloudSync({ connectId });
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
    expect(
      backgroundApi.servicePassword.promptPasswordVerify,
    ).not.toHaveBeenCalled();
    expect(initLocalSyncItemsDB).toHaveBeenCalledWith(
      expect.not.objectContaining({ password: expect.anything() }),
    );
  });

  test('activation runs one full sync after the key is committed', async () => {
    const { service, backgroundApi } = setup();
    await service.enableHardwareCloudSync({ connectId });
    const sync = backgroundApi.servicePrimeCloudSync.startServerSyncFlow;
    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledWith({
      setUndefinedTimeToNow: true,
      callerName: 'Enable Hardware Cloud Sync',
      forceSync: true,
    });
    expect(
      jest.mocked(keylessSyncCredentialStorage.saveCredential).mock
        .invocationCallOrder[0],
    ).toBeLessThan(sync.mock.invocationCallOrder[0]);
  });

  test('a failed first sync keeps sync on with its key for Sync now to retry', async () => {
    const { service, backgroundApi } = setup();
    backgroundApi.servicePrimeCloudSync.startServerSyncFlow.mockRejectedValueOnce(
      new OneKeyLocalError('Synthetic network failure'),
    );
    await expect(
      service.enableHardwareCloudSync({ connectId }),
    ).rejects.toThrow('Synthetic network failure');
    expect(mockStored).toEqual(expect.objectContaining(credential));
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(source);
  });

  test('new Keyless creation and seed repair cannot replace a selected hardware key', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockStored = credential;
    await service.persistNewKeylessCloudSyncCredential({
      ...credential,
      keylessWalletId: 'hd-keyless-test',
      source: undefined,
    });
    await service.repairKeylessSyncCredentialIfNeeded({
      password: 'public-test-password',
    });
    await service.syncPersistedCurrentCloudSyncKeylessWalletIdWithWallets([]);
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
    expect(mockStored).toBe(credential);
    expect(mockConfig.currentCloudSyncKeylessWalletId).toBe(
      source.credentialId,
    );
  });

  test('switching from Keyless rebuilds its records with the hardware key', async () => {
    const { service, initLocalSyncItemsDB } = setup([
      { pwdHash: 'keyless-old-space' },
    ]);
    mockStored = {
      ...credential,
      keylessWalletId: 'hd-keyless-old',
      source: undefined,
    };
    await service.enableHardwareCloudSync({ connectId });
    expect(generateHardwareCloudSyncCredentialWithSdk).toHaveBeenCalledWith(
      expect.objectContaining({ expectedCredentialId: undefined }),
    );
    expect(initLocalSyncItemsDB).toHaveBeenCalled();
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(source);
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
  });

  test('switching to Keyless keeps records synced with the hardware key for rebuilding', async () => {
    const { service } = setup([{ pwdHash: credential.pwdHash }]);
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockStored = credential;
    await service.selectKeylessCloudSyncKey();
    expect(mockStored).toBeUndefined();
    expect(mockConfig.hardwareCloudSyncKeySource).toBeUndefined();
    expect(mockConfig.currentCloudSyncKeylessWalletId).toBe('hd-keyless-test');
  });

  test.each(['hardware', 'keyless'] as const)(
    'unknown encrypted records block switching to %s before the current key is removed',
    async (target) => {
      const { service, initLocalSyncItemsDB } = setup([
        {
          // Old persistence can contain data types absent from this enum.
          dataType: 'FutureCloudRecord' as EPrimeCloudSyncDataType,
          data: 'public-test-preserved-ciphertext',
          pwdHash: credential.pwdHash,
        },
      ]);
      mockConfig.hardwareCloudSyncKeySource = source;
      mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
      mockStored = credential;
      const previousConfig = { ...mockConfig };

      await expect(
        target === 'hardware'
          ? service.enableHardwareCloudSync({ connectId })
          : service.selectKeylessCloudSyncKey(),
      ).rejects.toThrow("switching isn't available yet");

      expect(mockConfig).toEqual(previousConfig);
      expect(mockStored).toBe(credential);
      expect(generateHardwareCloudSyncCredentialWithSdk).not.toHaveBeenCalled();
      expect(
        keylessSyncCredentialStorage.saveCredential,
      ).not.toHaveBeenCalled();
      expect(
        keylessSyncCredentialStorage.removeAllCredentials,
      ).not.toHaveBeenCalled();
      expect(initLocalSyncItemsDB).not.toHaveBeenCalled();
    },
  );

  test('an unknown encrypted record arriving during the device prompt blocks the commit', async () => {
    const { service, backgroundApi } = setup();
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementation(async (params) => {
        await signIn(params);
        backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems.mockResolvedValue(
          {
            items: [
              {
                id: 'public-test-future-record',
                rawKey: '',
                rawData: '',
                dataType: 'FutureCloudRecord' as EPrimeCloudSyncDataType,
                data: 'public-test-preserved-ciphertext',
                dataTime: 1,
                isDeleted: false,
                pwdHash: 'keyless-old-space',
                localSceneUpdated: false,
                serverUploaded: false,
              },
            ],
          },
        );
        return { credential, source };
      });
    await expect(
      service.enableHardwareCloudSync({ connectId }),
    ).rejects.toThrow("switching isn't available yet");
    expect(mockStored).toBeUndefined();
    expect(mockConfig.hardwareCloudSyncKeySource).toBeUndefined();
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
  });

  test.each([credential.pwdHash, 'hw-dek-unavailable'])(
    're-signing with an unknown record under %s keeps only the same data key',
    async (pwdHash) => {
      const { service } = setup([
        {
          dataType: 'FutureCloudRecord' as EPrimeCloudSyncDataType,
          data: 'public-test-preserved-ciphertext',
          pwdHash,
        },
      ]);
      mockConfig.hardwareCloudSyncKeySource = source;
      mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
      mockConfig.isCloudSyncEnabledKeyless = true;
      // Re-signing the selected wallet is allowed after its credential was lost.
      mockStored = undefined;
      if (pwdHash === credential.pwdHash) {
        await service.enableHardwareCloudSync({ connectId });
        expect(mockStored).toEqual(expect.objectContaining({ pwdHash }));
      } else {
        await expect(
          service.enableHardwareCloudSync({ connectId }),
        ).rejects.toThrow("switching isn't available yet");
        expect(
          keylessSyncCredentialStorage.saveCredential,
        ).not.toHaveBeenCalled();
      }
      expect(generateHardwareCloudSyncCredentialWithSdk).toHaveBeenCalledWith(
        expect.objectContaining({ expectedCredentialId: source.credentialId }),
      );
    },
  );

  test.each([
    {
      dataType: EPrimeCloudSyncDataType.Lock,
      pwdHash: 'keyless-old-lock',
      isDeleted: false,
      allowed: true,
    },
    {
      dataType: EPrimeCloudSyncDataType.Lock,
      pwdHash: 'hw-dek-old-lock',
      isDeleted: true,
      allowed: true,
    },
    {
      dataType: EPrimeCloudSyncDataType.Lock,
      pwdHash: 'ordinary-other-space',
      isDeleted: false,
      allowed: false,
    },
    {
      dataType: EPrimeCloudSyncDataType.IndexedAccount,
      pwdHash: 'keyless-other-space',
      isDeleted: true,
      allowed: false,
    },
    {
      dataType: EPrimeCloudSyncDataType.IndexedAccount,
      pwdHash: 'keyless-other-space',
      isDeleted: false,
      allowed: false,
    },
  ])(
    'same-source recovery handles residual $dataType ($pwdHash, deleted=$isDeleted)',
    async ({ dataType, pwdHash, isDeleted, allowed }) => {
      const { service, backgroundApi, initLocalSyncItemsDB } = setup([
        { pwdHash: 'hw-dek-gen3' },
        {
          dataType,
          pwdHash,
          isDeleted,
          rawData: 'public-test-preserved-raw',
          serverUploaded: false,
        },
      ]);
      mockConfig.hardwareCloudSyncKeySource = source;
      mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
      mockConfig.isCloudSyncEnabledKeyless = true;
      mockStored = undefined;
      const sessionApi = jest.requireMock<
        typeof import('./hardwareCloudSyncSession')
      >('./hardwareCloudSyncSession');
      jest
        .mocked(sessionApi.bootstrapHardwareCloudSyncDataKey)
        .mockImplementationOnce(async ({ deriveKek }) => ({
          dek: await deriveKek('00'.repeat(16)),
          dekId: 'public-test-dek',
          pwdHash: credential.pwdHash,
          generation: 4,
          previousPwdHashes: ['hw-dek-gen3'],
        }));

      const before =
        await backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems({
          includeUnsupportedDataTypes: true,
        });
      const snapshot = structuredClone(before);
      if (allowed) {
        await service.enableHardwareCloudSync({ connectId });
        expect(initLocalSyncItemsDB).toHaveBeenCalled();
      } else {
        await expect(
          service.enableHardwareCloudSync({ connectId }),
        ).rejects.toThrow("can't unlock");
        expect(
          keylessSyncCredentialStorage.saveCredential,
        ).not.toHaveBeenCalled();
        expect(initLocalSyncItemsDB).not.toHaveBeenCalled();
      }
      expect(
        await backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems({
          includeUnsupportedDataTypes: true,
        }),
      ).toEqual(snapshot);
    },
  );

  test('switching to Keyless still needs sync off', async () => {
    const { service } = setup([{ pwdHash: credential.pwdHash }]);
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockStored = credential;
    await expect(service.selectKeylessCloudSyncKey()).rejects.toThrow(
      'Turn off Cloud sync',
    );
    expect(mockStored).toBe(credential);
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(source);
  });

  test('turning sync off deletes the stored hardware key and its memory cache', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockStored = credential;
    service.setKeylessCloudSyncCredentialCache(credential);
    await service.setCloudSyncEnabledKeyless(false);
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
    expect(
      service.getKeylessCloudSyncCredentialCacheSync(source.credentialId),
    ).toBeUndefined();
    expect(
      keylessSyncCredentialStorage.removeAllCredentials,
    ).toHaveBeenCalled();
    expect(mockStored).toBeUndefined();
    // The source stays selected so the same wallet can sign again.
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(source);
    expect(await service.getKeylessCloudSyncCredential()).toBeNull();
    expect(generateHardwareCloudSyncCredentialWithSdk).not.toHaveBeenCalled();
  });

  test('the Keyless toggle cannot turn a deleted hardware key back on', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    await expect(service.setCloudSyncEnabledKeyless(true)).rejects.toThrow(
      'sign again',
    );
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
    expect(generateHardwareCloudSyncCredentialWithSdk).not.toHaveBeenCalled();
  });

  test('turning sync on again asks the same standard wallet to sign again', async () => {
    const { service, backgroundApi } = setup([{ pwdHash: credential.pwdHash }]);
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockStored = credential;
    await service.setCloudSyncEnabledKeyless(false);
    expect(mockStored).toBeUndefined();
    await service.enableHardwareCloudSync({ connectId });
    expect(generateHardwareCloudSyncCredentialWithSdk).toHaveBeenCalledTimes(1);
    expect(mockStored).toEqual(expect.objectContaining(credential));
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
    // The first sync sets "Last updated" even when it had nothing to move.
    expect(
      backgroundApi.servicePrimeCloudSync.updateLastSyncTime,
    ).toHaveBeenCalledWith({ syncMode: ECloudSyncMode.Keyless });
  });

  test('turning sync on again with another seed switches to that key', async () => {
    const { service } = setup([{ pwdHash: credential.pwdHash }]);
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockStored = credential;
    await service.setCloudSyncEnabledKeyless(false);
    // Sync is off, so this is a switch: records are rebuilt with the new key.
    jest.mocked(generateHardwareCloudSyncCredentialWithSdk).mockImplementation(
      withSignIn({
        credential: { ...credential, pwdHash: 'keyless-other-seed' },
        source,
      }),
    );
    await service.enableHardwareCloudSync({ connectId });
    expect(mockStored?.pwdHash).toBe('keyless-other-seed');
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
  });

  test('switching back to Keyless deletes the hardware key', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockStored = credential;
    await service.selectKeylessCloudSyncKey();
    expect(
      keylessSyncCredentialStorage.removeAllCredentials,
    ).toHaveBeenCalled();
    expect(mockStored).toBeUndefined();
    expect(mockConfig.hardwareCloudSyncKeySource).toBeUndefined();
    expect(mockConfig.currentCloudSyncKeylessWalletId).toBe('hd-keyless-test');
  });

  test('an unsupported runtime fails before asking the device', async () => {
    const { service } = setup();
    const unsupported = jest.replaceProperty(platformEnv, 'isDesktop', false);
    try {
      await expect(
        service.enableHardwareCloudSync({ connectId }),
      ).rejects.toMatchObject({
        key: ETranslations.cloud_sync_hardware_unavailable__msg,
      });
    } finally {
      unsupported.restore();
    }
    expect(generateHardwareCloudSyncCredentialWithSdk).not.toHaveBeenCalled();
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
  });

  test('allows another device restored from the same recovery phrase', async () => {
    const { service } = setup([{ pwdHash: credential.pwdHash }]);
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockStored = credential;
    const replacement = {
      ...source,
      deviceName: 'OneKey Classic 1S',
      deviceType: EDeviceType.ClassicPure,
    };
    jest.mocked(generateHardwareCloudSyncCredentialWithSdk).mockImplementation(
      withSignIn({
        credential: { ...credential, source: replacement },
        source: replacement,
      }),
    );
    await service.enableHardwareCloudSync({ connectId: 'public-test-other' });
    expect(generateHardwareCloudSyncCredentialWithSdk).toHaveBeenCalledWith(
      expect.objectContaining({
        connectId: 'public-test-other',
        // Sync is off, so any standard wallet may sign; the same phrase keeps
        // the same key.
        expectedCredentialId: undefined,
      }),
    );
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(replacement);
    expect(mockStored?.pwdHash).toBe(credential.pwdHash);
  });

  test('without encrypted records any standard wallet may sign', async () => {
    const { service } = setup();
    await service.enableHardwareCloudSync({ connectId });
    expect(generateHardwareCloudSyncCredentialWithSdk).toHaveBeenCalledWith(
      expect.objectContaining({ connectId, expectedCredentialId: undefined }),
    );
  });

  test('rejects a historically different signature-derived key even with identical XFP', async () => {
    const { service } = setup([{ pwdHash: credential.pwdHash }]);
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockStored = credential;
    jest.mocked(generateHardwareCloudSyncCredentialWithSdk).mockImplementation(
      withSignIn({
        credential: { ...credential, pwdHash: 'keyless-different' },
        source,
      }),
    );
    await expect(
      service.enableHardwareCloudSync({ connectId }),
    ).rejects.toThrow("can't unlock your synced data");
    expect(mockStored).toBe(credential);
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
  });

  test('rejects cancelled and failed hardware results before persisting anything', async () => {
    const { service } = setup();
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementation(async (params: IDeviceParams) => {
        await service.cancelHardwareCloudKeyOperation();
        await signIn(params);
        return { credential, source };
      });
    await expect(
      service.enableHardwareCloudSync({ connectId }),
    ).rejects.toMatchObject({ key: ETranslations.update_operation_canceled });
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockRejectedValue(new Error('device cancelled'));
    await expect(
      service.enableHardwareCloudSync({ connectId }),
    ).rejects.toThrow('device cancelled');
    expect(mockConfig.hardwareCloudSyncKeySource).toBeUndefined();
  });

  function pendingDevicePrompt() {
    let entered: () => void = () => undefined;
    const reached = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const deviceCancel = jest.fn();
    let finish: () => void = () => undefined;
    const prompt: typeof generateHardwareCloudSyncCredentialWithSdk = ({
      onDeviceCancelChange,
      unlock,
    }) =>
      new Promise((resolve, reject) => {
        onDeviceCancelChange?.(() => {
          deviceCancel();
          reject(new Error('Synthetic device request cancelled'));
        });
        finish = () => {
          void signIn({ unlock }).then(() => resolve({ credential, source }));
        };
        entered();
      });
    return { prompt, reached, deviceCancel, finish: () => finish() };
  }

  test('a pending device prompt does not block wallet reads or ordinary sync', async () => {
    const { service } = setup();
    const device = pendingDevicePrompt();
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementation(device.prompt);
    const activation = service.enableHardwareCloudSync({ connectId });
    await device.reached;
    // Both paths take the Cloud key locks; they must not wait for the device.
    await service.syncPersistedCurrentCloudSyncKeylessWalletIdWithWallets([]);
    await expect(
      service.runWithCloudSyncKeyLock(async () => 'free'),
    ).resolves.toBe('free');
    device.finish();
    await activation;
    expect(mockStored).toEqual(expect.objectContaining(credential));
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
  });

  test('Cancel aborts a pending device prompt and settles the activation', async () => {
    const { service } = setup();
    const device = pendingDevicePrompt();
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementation(device.prompt);
    const activation = service.enableHardwareCloudSync({ connectId });
    await device.reached;
    expect(await service.cancelHardwareCloudKeyOperation()).toBe(true);
    await expect(activation).rejects.toMatchObject({
      key: ETranslations.update_operation_canceled,
    });
    expect(device.deviceCancel).toHaveBeenCalledTimes(1);
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
    expect(mockConfig.hardwareCloudSyncKeySource).toBeUndefined();
  });

  test('a newer activation cancels the device prompt owned by an older one', async () => {
    const { service } = setup();
    const device = pendingDevicePrompt();
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementationOnce(device.prompt)
      .mockImplementationOnce(withSignIn({ credential, source }));
    const first = service.enableHardwareCloudSync({ connectId });
    await device.reached;
    const second = service.enableHardwareCloudSync({ connectId });
    await expect(first).rejects.toMatchObject({
      key: ETranslations.update_operation_canceled,
    });
    await second;
    expect(device.deviceCancel).toHaveBeenCalledTimes(1);
    expect(mockStored).toEqual(expect.objectContaining(credential));
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
  });

  test.each([
    {
      name: 'sync was enabled',
      change: (_items: Array<{ pwdHash?: string }>) => {
        mockConfig = { ...mockConfig, isCloudSyncEnabledKeyless: true };
      },
      error: 'Turn off Cloud sync',
    },
  ])(
    'the commit re-validates state when $name during the device prompt',
    async ({ change, error }) => {
      const items: Array<{ pwdHash?: string }> = [];
      const { service } = setup(items);
      jest
        .mocked(generateHardwareCloudSyncCredentialWithSdk)
        .mockImplementation(async (params: IDeviceParams) => {
          change(items);
          await signIn(params);
          return { credential, source };
        });
      await expect(
        service.enableHardwareCloudSync({ connectId }),
      ).rejects.toThrow(error);
      expect(
        keylessSyncCredentialStorage.saveCredential,
      ).not.toHaveBeenCalled();
      expect(mockConfig.hardwareCloudSyncKeySource).toBeUndefined();
    },
  );

  test('a hardware key needs no wallet record in the App', async () => {
    const { service, backgroundApi } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockStored = credential;
    await expect(service.getKeylessWallet()).resolves.toBeNull();
    await expect(service.setCloudSyncEnabledKeyless(true)).resolves.toBe(true);
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
    expect(
      backgroundApi.serviceAccount.getKeylessWallet,
    ).not.toHaveBeenCalled();
    expect(backgroundApi.serviceApp.showToast).not.toHaveBeenCalled();
  });

  test('does not acknowledge cancellation once the atomic commit has started', async () => {
    const { service } = setup();
    jest
      .mocked(keylessSyncCredentialStorage.saveCredential)
      .mockImplementationOnce(async (value) => {
        expect(await service.cancelHardwareCloudKeyOperation()).toBe(false);
        mockStored = value;
      });
    await service.enableHardwareCloudSync({ connectId });
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
  });

  test('an explicit Keyless choice is carried through wallet creation from a hardware source', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    const select = jest
      .spyOn(service, 'selectKeylessCloudSyncKey')
      .mockImplementation(async () => {
        mockConfig.hardwareCloudSyncKeySource = undefined;
      });
    const enable = jest
      .spyOn(service, 'enableKeylessCloudSyncWithMigrationIfNeeded')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service, 'syncPersistedCurrentCloudSyncKeylessWalletIdWithWallets')
      .mockResolvedValue(undefined);
    await service.setPendingAutoEnableCloudSyncKeyless(true);
    await service.autoEnableCloudSyncKeyless();
    expect(select).toHaveBeenCalledTimes(1);
    expect(enable).toHaveBeenCalledTimes(1);
  });

  describe('automatic sync after Keyless wallet creation', () => {
    test('honors an explicit OneKey ID create-and-switch action', async () => {
      const { service } = setup();
      mockConfig.isCloudSyncEnabled = true;
      const enable = jest
        .spyOn(service, 'enableKeylessCloudSyncWithMigrationIfNeeded')
        .mockResolvedValue(undefined);
      jest
        .spyOn(
          service,
          'syncPersistedCurrentCloudSyncKeylessWalletIdWithWallets',
        )
        .mockResolvedValue(undefined);
      await service.setPendingAutoEnableCloudSyncKeyless(true);

      await service.autoEnableCloudSyncKeyless();

      expect(enable).toHaveBeenCalledTimes(1);
    });

    describe.each([false, true])('pending explicit choice: %s', (pending) => {
      test.each(
        pending
          ? (['hardware', 'keyless'] as const)
          : (['hardware', 'keyless', 'onekeyId'] as const),
      )('preserves active %s sync', async (mode) => {
        const { service, backgroundApi } = setup();
        mockConfig = {
          isCloudSyncEnabled: mode === 'onekeyId',
          isCloudSyncEnabledKeyless: mode !== 'onekeyId',
          hardwareCloudSyncKeySource: mode === 'hardware' ? source : undefined,
          currentCloudSyncKeylessWalletId:
            mode === 'hardware' ? source.credentialId : 'hd-keyless-test',
        };
        mockStored = mode === 'hardware' ? credential : undefined;
        const original = { ...mockConfig };
        const stored = mockStored;
        const prepare = jest
          .spyOn(service, 'prepareCloudSyncKeyless')
          .mockResolvedValue({ success: true });
        await service.setPendingAutoEnableCloudSyncKeyless(pending);

        await service.autoEnableCloudSyncKeyless();

        expect(mockConfig).toEqual(original);
        expect(mockStored).toBe(stored);
        expect(prepare).not.toHaveBeenCalled();
        expect(
          backgroundApi.serviceAccount.getAllWallets,
        ).not.toHaveBeenCalled();
        expect(
          backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
        ).not.toHaveBeenCalled();
      });
    });

    test.each([
      { hardware: false, formerId: false },
      { hardware: true, formerId: false },
      { hardware: false, formerId: true },
      { hardware: true, formerId: true },
    ])(
      'enables Keyless when all sync is off (hardware=$hardware, formerId=$formerId)',
      async ({ hardware, formerId }) => {
        const { service, backgroundApi } = setup();
        mockConfig = {
          isCloudSyncEnabled: false,
          isCloudSyncEnabledKeyless: false,
          hasEverEnabledOneKeyIdSync: formerId,
          hardwareCloudSyncKeySource: hardware ? source : undefined,
          currentCloudSyncKeylessWalletId: hardware
            ? source.credentialId
            : undefined,
        };
        mockStored = hardware ? credential : undefined;
        jest
          .spyOn(
            service,
            'syncPersistedCurrentCloudSyncKeylessWalletIdWithWallets',
          )
          .mockResolvedValue(undefined);
        jest
          .spyOn(service, 'prepareCloudSyncKeyless')
          .mockResolvedValue({ success: true });

        await service.autoEnableCloudSyncKeyless();

        expect(mockConfig.isCloudSyncEnabled).toBe(false);
        expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
        expect(mockConfig.hardwareCloudSyncKeySource).toBeUndefined();
        expect(mockConfig.currentCloudSyncKeylessWalletId).toBe(
          'hd-keyless-test',
        );
        expect(
          backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
        ).toHaveBeenCalledTimes(1);
        expect(
          generateHardwareCloudSyncCredentialWithSdk,
        ).not.toHaveBeenCalled();
      },
    );

    test.each(['hardware', 'onekeyId'] as const)(
      'keeps %s sync enabled while automatic credential preparation is in flight',
      async (mode) => {
        const { service, backgroundApi } = setup();
        jest
          .spyOn(
            service,
            'syncPersistedCurrentCloudSyncKeylessWalletIdWithWallets',
          )
          .mockResolvedValue(undefined);
        let selected: IPrimeCloudSyncPersistAtomData | undefined;
        jest
          .spyOn(service, 'prepareCloudSyncKeyless')
          .mockImplementation(async () => {
            mockConfig = {
              isCloudSyncEnabled: mode === 'onekeyId',
              isCloudSyncEnabledKeyless: mode === 'hardware',
              hardwareCloudSyncKeySource:
                mode === 'hardware' ? source : undefined,
              currentCloudSyncKeylessWalletId:
                mode === 'hardware' ? source.credentialId : undefined,
            };
            mockStored = mode === 'hardware' ? credential : undefined;
            selected = { ...mockConfig };
            return { success: true };
          });

        await service.autoEnableCloudSyncKeyless();

        expect(mockConfig).toEqual(selected);
        expect(
          backgroundApi.servicePrimeCloudSync.setCloudSyncEnabledWithKeyLock,
        ).not.toHaveBeenCalled();
        expect(
          backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
        ).not.toHaveBeenCalled();
        expect(
          backgroundApi.servicePrimeCloudSync.updateLastSyncTime,
        ).not.toHaveBeenCalled();
      },
    );

    test('a failed automatic preparation cannot roll back a newly enabled OneKey ID mode', async () => {
      const { service, backgroundApi } = setup();
      jest
        .spyOn(
          service,
          'syncPersistedCurrentCloudSyncKeylessWalletIdWithWallets',
        )
        .mockResolvedValue(undefined);
      jest
        .spyOn(service, 'prepareCloudSyncKeyless')
        .mockImplementation(async () => {
          mockConfig.isCloudSyncEnabled = true;
          throw new OneKeyLocalError('Public automatic preparation failure');
        });

      await service.autoEnableCloudSyncKeyless();

      expect(mockConfig.isCloudSyncEnabled).toBe(true);
      expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
      expect(
        backgroundApi.servicePrimeCloudSync.setCloudSyncEnabledWithKeyLock,
      ).not.toHaveBeenCalled();
      expect(
        backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
      ).not.toHaveBeenCalled();
    });
  });

  test('clears a mismatched in-memory source instead of using its keys', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    service.setKeylessCloudSyncCredentialCache({
      ...credential,
      source: undefined,
    });
    expect(await service.getKeylessCloudSyncCredential()).toBeNull();
  });

  const keylessCredential: IKeylessCloudSyncCredential = {
    keylessWalletId: 'hd-keyless-test',
    signingPrivateKey: 'public-test-placeholder-keyless-private',
    signingPublicKey: 'public-test-keyless-key',
    encryptionKey: 'public-test-placeholder-keyless-encryption',
    pwdHash: 'keyless-test-keyless',
  };

  function holdCloudSyncKeyLock(service: ServiceKeylessCloudSync) {
    let release: () => void = () => undefined;
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held = service.runWithCloudSyncKeyLock(() => paused);
    return async () => {
      release();
      await held;
    };
  }

  test('a new Keyless save waits for a hardware commit and then preserves it', async () => {
    const { service } = setup();
    let release: () => void = () => undefined;
    let reached: () => void = () => undefined;
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    const committing = new Promise<void>((resolve) => {
      reached = resolve;
    });
    jest
      .mocked(keylessSyncCredentialStorage.saveCredential)
      .mockImplementationOnce(async (value) => {
        reached();
        await paused;
        mockStored = value;
      });
    const activation = service.enableHardwareCloudSync({ connectId });
    await committing;
    const pendingSave =
      service.persistNewKeylessCloudSyncCredential(keylessCredential);
    await Promise.resolve();
    expect(keylessSyncCredentialStorage.saveCredential).toHaveBeenCalledTimes(
      1,
    );
    release();
    await Promise.all([activation, pendingSave]);
    expect(mockStored).toEqual(expect.objectContaining(credential));
    expect(keylessSyncCredentialStorage.saveCredential).toHaveBeenCalledTimes(
      1,
    );
  });

  test('a new Keyless save does not wait for a sync or toggle holding the key lock', async () => {
    const { service } = setup();
    const releaseLock = holdCloudSyncKeyLock(service);
    // Would time out if persistNew still queued on the key lock.
    await service.persistNewKeylessCloudSyncCredential(keylessCredential);
    expect(mockStored).toEqual(keylessCredential);
    await releaseLock();
  });

  function setupKeylessPrepare() {
    const context = setup();
    mockConfig.currentCloudSyncKeylessWalletId =
      keylessCredential.keylessWalletId;
    mockStored = keylessCredential;
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    let repaired: () => void = () => undefined;
    const repairReached = new Promise<void>((resolve) => {
      repaired = resolve;
    });
    jest
      .spyOn(context.service, 'repairKeylessSyncCredentialIfNeeded')
      .mockImplementation(async () => repaired());
    return { ...context, repairReached };
  }

  test('Keyless prepare prompts and repairs without holding the key lock', async () => {
    const { service, backgroundApi, initLocalSyncItemsDB, repairReached } =
      setupKeylessPrepare();
    const releaseLock = holdCloudSyncKeyLock(service);
    const preparing = service.prepareCloudSyncKeyless({ silentEnable: true });
    await repairReached;
    expect(
      backgroundApi.servicePassword.promptPasswordVerify,
    ).toHaveBeenCalledTimes(1);
    expect(initLocalSyncItemsDB).not.toHaveBeenCalled();
    await releaseLock();
    await expect(preparing).resolves.toEqual({ success: true });
    expect(initLocalSyncItemsDB).toHaveBeenCalledWith({
      password: 'public-test-password',
      syncCredential: expect.objectContaining({
        keylessCredential,
      }),
    });
  });

  test('Keyless prepare skips its local write when the key switched while it waited', async () => {
    const { service, initLocalSyncItemsDB } = setupKeylessPrepare();
    const releaseLock = holdCloudSyncKeyLock(service);
    const takeLock = service.runWithCloudSyncKeyLock.bind(service);
    let queued: () => void = () => undefined;
    const prepareQueued = new Promise<void>((resolve) => {
      queued = resolve;
    });
    jest
      .spyOn(service, 'runWithCloudSyncKeyLock')
      .mockImplementation((operation) => {
        queued();
        return takeLock(operation);
      });
    const preparing = service.prepareCloudSyncKeyless({ silentEnable: true });
    await prepareQueued;
    // The lock holder selects a hardware key before prepare can write.
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockStored = credential;
    await releaseLock();
    await expect(preparing).rejects.toThrow(
      'The encryption method for Cloud sync changed',
    );
    expect(initLocalSyncItemsDB).not.toHaveBeenCalled();
  });

  test('a failed Keyless enable does not roll back a hardware key selected meanwhile', async () => {
    const { service } = setup();
    const disable = jest.spyOn(service, 'setCloudSyncEnabledKeyless');
    jest
      .spyOn(service, 'prepareCloudSyncKeyless')
      .mockImplementationOnce(async () => {
        // A hardware commit wins the key lock while Keyless enable runs.
        mockConfig.hardwareCloudSyncKeySource = source;
        mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
        mockConfig.isCloudSyncEnabledKeyless = true;
        mockStored = credential;
        throw new OneKeyLocalError(
          'The encryption method for Cloud sync changed. Your data will sync with the new one next time.',
        );
      })
      .mockRejectedValueOnce(new OneKeyLocalError('Synthetic prepare failure'));
    await expect(
      service.toggleCloudSyncKeyless({ enabled: true, silentEnable: true }),
    ).rejects.toThrow('The encryption method for Cloud sync changed');
    expect(disable).not.toHaveBeenCalled();
    expect(mockStored).toBe(credential);
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);

    // Without a key switch the existing rollback still turns sync off.
    mockConfig.hardwareCloudSyncKeySource = undefined;
    await expect(
      service.toggleCloudSyncKeyless({ enabled: true, silentEnable: true }),
    ).rejects.toThrow('Synthetic prepare failure');
    expect(disable).toHaveBeenCalledWith(false);
  });

  test('wallet reads and repair inside the locked commit do not deadlock', async () => {
    const { service, initLocalSyncItemsDB } = setup();
    initLocalSyncItemsDB.mockImplementationOnce(async () => {
      // initLocalSyncItemsDB reads all wallets.
      await service.syncPersistedCurrentCloudSyncKeylessWalletIdWithWallets([]);
      await service.repairKeylessSyncCredentialIfNeeded({
        password: 'public-test-password',
      });
    });
    await service.enableHardwareCloudSync({ connectId });
    expect(mockStored).toEqual(expect.objectContaining(credential));
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
  });

  test('an unchanged wallet sweep does not queue behind a credential save', async () => {
    const { service } = setup();
    mockConfig.currentCloudSyncKeylessWalletId =
      keylessCredential.keylessWalletId;
    let release: () => void = () => undefined;
    let reached: () => void = () => undefined;
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    const saving = new Promise<void>((resolve) => {
      reached = resolve;
    });
    jest
      .mocked(keylessSyncCredentialStorage.saveCredential)
      .mockImplementationOnce(async (value) => {
        reached();
        await paused;
        mockStored = value;
      });
    const save =
      service.persistNewKeylessCloudSyncCredential(keylessCredential);
    await saving;
    // Would time out if every wallet read still waited for the repair mutex.
    await service.syncPersistedCurrentCloudSyncKeylessWalletIdWithWallets([
      { id: keylessCredential.keylessWalletId, isKeyless: true },
    ] as Parameters<
      ServiceKeylessCloudSync['syncPersistedCurrentCloudSyncKeylessWalletIdWithWallets']
    >[0]);
    release();
    await save;
    expect(mockStored).toEqual(keylessCredential);
  });

  test('a wallet sweep cannot delete a later hardware credential commit', async () => {
    const { service } = setup();
    let release: () => void = () => undefined;
    let reached: () => void = () => undefined;
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      reached = resolve;
    });
    jest
      .mocked(primeCloudSyncPersistAtom.set)
      .mockImplementationOnce(async (update) => {
        reached();
        await paused;
        mockConfig = typeof update === 'function' ? update(mockConfig) : update;
      });
    const sweep =
      service.syncPersistedCurrentCloudSyncKeylessWalletIdWithWallets([]);
    await entered;
    const activation = service.enableHardwareCloudSync({ connectId });
    release();
    await Promise.all([sweep, activation]);
    expect(mockStored).toEqual(expect.objectContaining(credential));
    expect(mockConfig.currentCloudSyncKeylessWalletId).toBe(
      source.credentialId,
    );
    expect(
      jest.mocked(keylessSyncCredentialStorage.removeAllCredentials).mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      jest.mocked(keylessSyncCredentialStorage.saveCredential).mock
        .invocationCallOrder[0],
    );
  });
});

describe('hardware Cloud key in production builds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = {
      isCloudSyncEnabled: false,
      isCloudSyncEnabledKeyless: true,
      hardwareCloudSyncKeySource: source,
      currentCloudSyncKeylessWalletId: source.credentialId,
    };
    mockStored = credential;
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementation(withSignIn({ credential, source }));
  });

  test('keeps a key in use: sync runs and Keyless auto-enable leaves it alone', async () => {
    const { service, backgroundApi } = setup();
    await expect(service.getActiveSyncMode()).resolves.toBe(
      ECloudSyncMode.Keyless,
    );
    await service.autoEnableCloudSyncKeyless();
    await expect(service.sweepHardwareCloudKeyIfSyncOff()).resolves.toBe(false);
    await expect(service.isSelectedHardwareCloudKeyMissing()).resolves.toBe(
      false,
    );
    expect(mockStored).toBe(credential);
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(source);
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
    expect(
      backgroundApi.servicePrimeCloudSync.initLocalSyncItemsDB,
    ).not.toHaveBeenCalled();
    expect(
      keylessSyncCredentialStorage.removeAllCredentials,
    ).not.toHaveBeenCalled();
  });

  test('re-signing a key still in use requires turning sync off', async () => {
    const { service } = setup([{ pwdHash: credential.pwdHash }]);
    await expect(
      service.enableHardwareCloudSync({ connectId }),
    ).rejects.toThrow('Turn off Cloud sync');
    expect(generateHardwareCloudSyncCredentialWithSdk).not.toHaveBeenCalled();
  });

  // An App version without hardware Cloud keys deletes the key and resets the
  // wallet ID on its first wallet read, but leaves sync on and the source set.
  test.each([
    { name: 'a Keyless wallet ID', walletId: 'hd-keyless-test' },
    { name: 'no wallet ID', walletId: null },
  ])(
    'after an older App version left $name, the same wallet signs again directly',
    async ({ walletId }) => {
      const { service } = setup([{ pwdHash: credential.pwdHash }]);
      mockConfig.currentCloudSyncKeylessWalletId = walletId;
      mockStored = undefined;
      await expect(service.isSelectedHardwareCloudKeyMissing()).resolves.toBe(
        true,
      );
      await service.enableHardwareCloudSync({ connectId });
      expect(generateHardwareCloudSyncCredentialWithSdk).toHaveBeenCalledTimes(
        1,
      );
      expect(mockStored).toEqual(expect.objectContaining(credential));
      expect(mockConfig.currentCloudSyncKeylessWalletId).toBe(
        source.credentialId,
      );
      expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
    },
  );

  test('a confirmed switch continues with another hardware wallet while its key is missing', async () => {
    const { service } = setup([{ pwdHash: credential.pwdHash }]);
    mockStored = undefined;
    const other = {
      ...source,
      credentialId: `hardware-cloud-v1-fedcba9876543210${'1'.repeat(48)}`,
      deviceName: 'Other OneKey',
    };
    jest.mocked(generateHardwareCloudSyncCredentialWithSdk).mockImplementation(
      withSignIn({
        credential: { ...credential, pwdHash: 'other-hardware', source: other },
        source: other,
      }),
    );
    await service.enableHardwareCloudSync({ connectId, switchDevice: true });
    expect(generateHardwareCloudSyncCredentialWithSdk).toHaveBeenCalledWith(
      expect.objectContaining({ expectedCredentialId: undefined }),
    );
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(other);
    expect(keylessSyncCredentialStorage.saveCredential).toHaveBeenCalledWith(
      expect.objectContaining({ pwdHash: 'other-hardware' }),
    );
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
  });

  test('a confirmed switch still needs sync off while the key is present', async () => {
    const { service } = setup([{ pwdHash: credential.pwdHash }]);
    await expect(
      service.enableHardwareCloudSync({ connectId, switchDevice: true }),
    ).rejects.toThrow('Turn off Cloud sync');
    expect(generateHardwareCloudSyncCredentialWithSdk).not.toHaveBeenCalled();
  });

  test('records an older App version moved to Keyless reject the hardware key', async () => {
    const { service } = setup([{ pwdHash: 'keyless-moved-by-older-app' }]);
    const keylessCredential = {
      ...credential,
      keylessWalletId: 'hd-keyless-test',
      pwdHash: 'keyless-moved-by-older-app',
      source: undefined,
    };
    mockConfig.currentCloudSyncKeylessWalletId = 'hd-keyless-test';
    mockStored = keylessCredential;
    await expect(
      service.enableHardwareCloudSync({ connectId }),
    ).rejects.toThrow("can't unlock your synced data");
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
    expect(mockStored).toBe(keylessCredential);
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(source);
  });
});

describe('a hardware key never outlives turned-off sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = {
      isCloudSyncEnabled: false,
      isCloudSyncEnabledKeyless: false,
    };
    mockStored = undefined;
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementation(withSignIn({ credential, source }));
  });

  test('a failed activation commit removes the key it just saved', async () => {
    const { service, initLocalSyncItemsDB } = setup();
    initLocalSyncItemsDB.mockRejectedValueOnce(
      new Error('Synthetic local DB failure'),
    );
    await expect(
      service.enableHardwareCloudSync({ connectId }),
    ).rejects.toThrow('Synthetic local DB failure');
    expect(keylessSyncCredentialStorage.saveCredential).toHaveBeenCalled();
    expect(mockStored).toBeUndefined();
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
    expect(
      service.getKeylessCloudSyncCredentialCacheSync(source.credentialId),
    ).toBeUndefined();
  });

  test('the sweep removes a stored hardware key while sync is off', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockStored = credential;
    service.setKeylessCloudSyncCredentialCache(credential);
    await expect(service.sweepHardwareCloudKeyIfSyncOff()).resolves.toBe(true);
    expect(mockStored).toBeUndefined();
    expect(
      service.getKeylessCloudSyncCredentialCacheSync(source.credentialId),
    ).toBeUndefined();
  });

  test.each([
    {
      name: 'sync is on',
      config: {
        hardwareCloudSyncKeySource: source,
        isCloudSyncEnabledKeyless: true,
      },
      stored: credential,
    },
    {
      name: 'the key belongs to Keyless',
      config: { currentCloudSyncKeylessWalletId: 'hd-keyless-test' },
      stored: {
        ...credential,
        keylessWalletId: 'hd-keyless-test',
        source: undefined,
      },
    },
  ])('the sweep keeps the key when $name', async ({ config, stored }) => {
    const { service } = setup();
    mockConfig = { ...mockConfig, ...config };
    mockStored = stored;
    await expect(service.sweepHardwareCloudKeyIfSyncOff()).resolves.toBe(false);
    expect(mockStored).toBe(stored);
  });

  test('a refresh after another one finished uses the stored token instead of reusing the rotated one', async () => {
    const log = jest.spyOn(defaultLogger.app.error, 'log');
    const { service } = setup();
    const hardwareSession = {
      deviceKeyJwk: {
        kty: 'EC' as const,
        crv: 'P-256' as const,
        x: 'x',
        y: 'y',
        d: 'd',
      },
      accessToken: 'public-test-access-1',
      accessTokenExpiresAt: 0,
      refreshToken: 'public-test-refresh-1',
      sessionId: 'public-test-session',
      dekId: 'public-test-dek',
    };
    const stale = { ...credential, hardwareSession };
    mockStored = {
      ...stale,
      hardwareSession: {
        ...hardwareSession,
        accessToken: 'public-test-access-2',
        refreshToken: 'public-test-refresh-2',
      },
    };
    const { refreshHardwareCloudSyncSessionIfNeeded } = jest.requireMock<
      typeof import('./hardwareCloudSyncSession')
    >('./hardwareCloudSyncSession');
    jest.mocked(refreshHardwareCloudSyncSessionIfNeeded).mockClear();
    const fresh = await service['getFreshHardwareCredential'](stale, {
      force: true,
    });
    expect(fresh.hardwareSession?.refreshToken).toBe('public-test-refresh-2');
    expect(refreshHardwareCloudSyncSessionIfNeeded).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      '[HardwareCloudSyncDiagnostic] credential_refresh_reused_stored_session {"forceRequested":true}',
    );
    const diagnostics = log.mock.calls
      .flat()
      .filter((value) =>
        String(value).includes('[HardwareCloudSyncDiagnostic]'),
      )
      .join(' ');
    for (const secret of [
      hardwareSession.accessToken,
      hardwareSession.refreshToken,
      hardwareSession.sessionId,
      hardwareSession.dekId,
      credential.pwdHash,
      credential.keylessWalletId,
    ]) {
      expect(diagnostics).not.toContain(secret);
    }
  });

  test('a refresh whose reply was lost keeps the stored token for the next refresh', async () => {
    const { service } = setup();
    const hardwareSession = {
      deviceKeyJwk: {
        kty: 'EC' as const,
        crv: 'P-256' as const,
        x: 'x',
        y: 'y',
        d: 'd',
      },
      accessToken: 'public-test-access-1',
      accessTokenExpiresAt: 0,
      refreshToken: 'public-test-refresh-1',
      sessionId: 'public-test-session',
      dekId: 'public-test-dek',
    };
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    const stored = { ...credential, hardwareSession };
    mockStored = stored;
    const { refreshHardwareCloudSyncSessionIfNeeded } = jest.requireMock<
      typeof import('./hardwareCloudSyncSession')
    >('./hardwareCloudSyncSession');
    jest
      .mocked(refreshHardwareCloudSyncSessionIfNeeded)
      .mockRejectedValueOnce(new Error('public-test-timeout'))
      .mockResolvedValueOnce({
        ...hardwareSession,
        accessToken: 'public-test-access-2',
        accessTokenExpiresAt: Number.MAX_SAFE_INTEGER,
        refreshToken: 'public-test-refresh-2',
      });

    await expect(service['getFreshHardwareCredential'](stored)).rejects.toThrow(
      'public-test-timeout',
    );
    expect(mockStored).toBe(stored);

    const fresh = await service['getFreshHardwareCredential'](stored);
    expect(refreshHardwareCloudSyncSessionIfNeeded).toHaveBeenLastCalledWith(
      expect.objectContaining({ session: hardwareSession }),
    );
    expect(fresh.hardwareSession?.refreshToken).toBe('public-test-refresh-2');
    expect(mockStored?.hardwareSession?.refreshToken).toBe(
      'public-test-refresh-2',
    );
  });

  test('finishing an interrupted reset records the new key generation', async () => {
    const { service } = setup();
    const hardwareSession = {
      deviceKeyJwk: {
        kty: 'EC' as const,
        crv: 'P-256' as const,
        x: 'x',
        y: 'y',
        d: 'd',
      },
      accessToken: 'public-test-access',
      accessTokenExpiresAt: Number.MAX_SAFE_INTEGER,
      refreshToken: 'public-test-refresh',
      sessionId: 'public-test-session',
      dekId: 'public-test-dek-2',
    };
    const pending = {
      dek: 'public-test-placeholder-dek-3',
      dekId: 'public-test-dek-3',
      pwdHash: 'keyless-test-hardware-3',
      generation: 3,
    };
    mockConfig = {
      ...mockConfig,
      hardwareCloudSyncKeyGenerations: { [source.credentialId]: 2 },
    };
    const { getCurrentHardwareCloudSyncDataKeyId } = jest.requireMock<
      typeof import('./hardwareCloudSyncSession')
    >('./hardwareCloudSyncSession');
    jest
      .mocked(getCurrentHardwareCloudSyncDataKeyId)
      .mockResolvedValueOnce(pending.dekId);
    const commit = jest
      .spyOn(
        service as unknown as {
          commitHardwareDataKey: (
            c: IKeylessCloudSyncCredential,
          ) => Promise<IKeylessCloudSyncCredential>;
        },
        'commitHardwareDataKey',
      )
      .mockImplementation(async (c) => ({ ...c, pendingDataKey: undefined }));
    await service['handleHardwareDataKeyRefused']({
      ...credential,
      hardwareSession,
      pendingDataKey: pending,
    });
    expect(commit).toHaveBeenCalled();
    expect(mockConfig.hardwareCloudSyncKeyGenerations).toEqual({
      [source.credentialId]: 3,
    });
  });

  test('turning sync off revokes this device session on the server', async () => {
    const { service } = setup();
    const hardwareSession = {
      deviceKeyJwk: {
        kty: 'EC' as const,
        crv: 'P-256' as const,
        x: 'x',
        y: 'y',
        d: 'd',
      },
      accessToken: 'public-test-access',
      accessTokenExpiresAt: Number.MAX_SAFE_INTEGER,
      refreshToken: 'public-test-refresh',
      sessionId: 'public-test-session',
      dekId: 'public-test-dek',
    };
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockStored = { ...credential, hardwareSession };
    const { revokeHardwareCloudSyncSession } = jest.requireMock<
      typeof import('./hardwareCloudSyncSession')
    >('./hardwareCloudSyncSession');
    jest.mocked(revokeHardwareCloudSyncSession).mockClear();
    await service.setCloudSyncEnabledKeyless(false);
    expect(revokeHardwareCloudSyncSession).toHaveBeenCalledWith(
      expect.objectContaining({ session: hardwareSession, scope: 'current' }),
    );
    expect(mockStored).toBeUndefined();
  });

  test('a revoked-session push is checked with the server, for this session only', async () => {
    const log = jest.spyOn(defaultLogger.app.error, 'log');
    const { service } = setup();
    const hardwareSession = {
      deviceKeyJwk: {
        kty: 'EC' as const,
        crv: 'P-256' as const,
        x: 'x',
        y: 'y',
        d: 'd',
      },
      accessToken: 'public-test-access',
      accessTokenExpiresAt: Number.MAX_SAFE_INTEGER,
      refreshToken: 'public-test-refresh',
      sessionId: 'public-test-session',
      dekId: 'public-test-dek',
    };
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockStored = { ...credential, hardwareSession };
    const { refreshHardwareCloudSyncSessionIfNeeded } = jest.requireMock<
      typeof import('./hardwareCloudSyncSession')
    >('./hardwareCloudSyncSession');
    jest.mocked(refreshHardwareCloudSyncSessionIfNeeded).mockClear();
    await service.onHardwareSessionRevokedPush({
      sessionId: 'another-session',
    });
    expect(refreshHardwareCloudSyncSessionIfNeeded).not.toHaveBeenCalled();
    await service.onHardwareSessionRevokedPush({
      sessionId: hardwareSession.sessionId,
    });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"sessionMatches":false'),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"sessionMatches":true'),
    );
    // The refresh's 90700, not the push, drops the key.
    expect(refreshHardwareCloudSyncSessionIfNeeded).toHaveBeenCalledWith(
      expect.objectContaining({ force: true }),
    );
  });

  test('a flush push with another pwdHash is checked against the Lock; our own pulls the data', async () => {
    const { service, backgroundApi } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockStored = {
      ...credential,
      hardwareSession: {
        deviceKeyJwk: {
          kty: 'EC' as const,
          crv: 'P-256' as const,
          x: 'x',
          y: 'y',
          d: 'd',
        },
        accessToken: 'public-test-access',
        accessTokenExpiresAt: Number.MAX_SAFE_INTEGER,
        refreshToken: 'public-test-refresh',
        sessionId: 'public-test-session',
        dekId: 'public-test-dek',
      },
    };
    const { getCurrentHardwareCloudSyncDataKeyId } = jest.requireMock<
      typeof import('./hardwareCloudSyncSession')
    >('./hardwareCloudSyncSession');
    jest.mocked(getCurrentHardwareCloudSyncDataKeyId).mockClear();
    await service.onHardwareKeyFlushPush({ pwdHash: credential.pwdHash });
    expect(getCurrentHardwareCloudSyncDataKeyId).not.toHaveBeenCalled();
    // The push carries no data, so the same key means fetching it.
    expect(
      backgroundApi.servicePrimeCloudSync.startServerSyncFlowSilently,
    ).toHaveBeenCalledTimes(1);
    await service.onHardwareKeyFlushPush({ pwdHash: 'hw-dek-another' });
    expect(getCurrentHardwareCloudSyncDataKeyId).toHaveBeenCalledTimes(1);
  });

  test('turning sync off with an expired token refreshes it for the revoke', async () => {
    const { service, getClient } = setup();
    const hardwareSession = {
      deviceKeyJwk: {
        kty: 'EC' as const,
        crv: 'P-256' as const,
        x: 'x',
        y: 'y',
        d: 'd',
      },
      accessToken: 'public-test-access',
      accessTokenExpiresAt: 0,
      refreshToken: 'public-test-refresh',
      sessionId: 'public-test-session',
      dekId: 'public-test-dek',
    };
    const refreshed = {
      ...hardwareSession,
      accessToken: 'public-test-access-next',
      accessTokenExpiresAt: Date.now() + 900_000,
      refreshToken: 'public-test-refresh-next',
    };
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockStored = { ...credential, hardwareSession };
    const {
      refreshHardwareCloudSyncSessionIfNeeded,
      revokeHardwareCloudSyncSession,
    } = jest.requireMock<typeof import('./hardwareCloudSyncSession')>(
      './hardwareCloudSyncSession',
    );
    jest
      .mocked(refreshHardwareCloudSyncSessionIfNeeded)
      .mockResolvedValueOnce(refreshed);
    jest.mocked(revokeHardwareCloudSyncSession).mockClear();
    await service.setCloudSyncEnabledKeyless(false);
    expect(revokeHardwareCloudSyncSession).toHaveBeenCalledWith(
      expect.objectContaining({ session: refreshed, scope: 'current' }),
    );
    // No OneKey ID token on hardware requests: the plain Prime client.
    expect(getClient).toHaveBeenCalledWith(EServiceEndpointEnum.Prime);
    expect(mockStored).toBeUndefined();
  });

  test('turning sync off still deletes the key when the revoke fails', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockStored = {
      ...credential,
      hardwareSession: {
        deviceKeyJwk: {
          kty: 'EC' as const,
          crv: 'P-256' as const,
          x: 'x',
          y: 'y',
          d: 'd',
        },
        accessToken: 'public-test-access',
        accessTokenExpiresAt: Number.MAX_SAFE_INTEGER,
        refreshToken: 'public-test-refresh',
        sessionId: 'public-test-session',
        dekId: 'public-test-dek',
      },
    };
    const { revokeHardwareCloudSyncSession } = jest.requireMock<
      typeof import('./hardwareCloudSyncSession')
    >('./hardwareCloudSyncSession');
    jest
      .mocked(revokeHardwareCloudSyncSession)
      .mockRejectedValueOnce(new Error('offline'));
    await service.setCloudSyncEnabledKeyless(false);
    expect(mockStored).toBeUndefined();
  });
});

describe('checking the hardware session when the page opens or the App returns', () => {
  const sessionApi = jest.requireMock<
    typeof import('./hardwareCloudSyncSession')
  >('./hardwareCloudSyncSession');
  const hardwareSession = {
    deviceKeyJwk: {
      kty: 'EC' as const,
      crv: 'P-256' as const,
      x: 'x',
      y: 'y',
      d: 'd',
    },
    accessToken: 'public-test-access',
    accessTokenExpiresAt: Number.MAX_SAFE_INTEGER,
    refreshToken: 'public-test-refresh',
    sessionId: 'public-test-session',
    dekId: 'public-test-dek',
  };
  const revoked = new Error('public-test-revoked');

  function start() {
    const { service } = setup();
    mockConfig = {
      isCloudSyncEnabled: false,
      isCloudSyncEnabledKeyless: true,
      hardwareCloudSyncKeySource: source,
      currentCloudSyncKeylessWalletId: source.credentialId,
    };
    mockStored = { ...credential, hardwareSession };
    jest
      .spyOn(
        service as unknown as {
          getHardwareSessionCredential: () => Promise<
            IKeylessCloudSyncCredential | undefined
          >;
        },
        'getHardwareSessionCredential',
      )
      .mockImplementation(async () => mockStored);
    return service;
  }

  async function checkAndCollectDrops(service: ServiceKeylessCloudSync) {
    const dropped = jest.fn();
    appEventBus.on(EAppEventBusNames.HardwareCloudKeyDropped, dropped);
    try {
      await service.checkHardwareCloudSyncSessionThrottled();
    } finally {
      appEventBus.off(EAppEventBusNames.HardwareCloudKeyDropped, dropped);
    }
    return dropped;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(sessionApi.getCurrentHardwareCloudSyncDataKeyId).mockReset();
    jest
      .mocked(sessionApi.isHardwareCloudSyncUnauthorizedError)
      .mockImplementation((error) => error === revoked);
  });

  afterEach(() => {
    jest
      .mocked(sessionApi.isHardwareCloudSyncUnauthorizedError)
      .mockImplementation(() => false);
    servicesToClear.forEach((service) =>
      service.clearKeylessCloudSyncCredentialCache(),
    );
    servicesToClear.clear();
  });

  test('a session another device signed out drops the key and tells the page', async () => {
    const log = jest.spyOn(defaultLogger.app.error, 'log');
    const service = start();
    jest
      .mocked(sessionApi.getCurrentHardwareCloudSyncDataKeyId)
      .mockRejectedValueOnce(revoked);
    jest
      .mocked(sessionApi.refreshHardwareCloudSyncSessionIfNeeded)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(revoked);
    const dropped = await checkAndCollectDrops(service);
    expect(
      sessionApi.refreshHardwareCloudSyncSessionIfNeeded,
    ).toHaveBeenLastCalledWith(expect.objectContaining({ force: true }));
    expect(log).toHaveBeenCalledWith(
      '[HardwareCloudSyncDiagnostic] sign_in_credential_deletion_guard {"deletionAllowed":true}',
    );
    expect(mockStored).toBeUndefined();
    expect(dropped).toHaveBeenCalledTimes(1);
  });

  test('a data key another device replaced drops the key', async () => {
    const service = start();
    jest
      .mocked(sessionApi.getCurrentHardwareCloudSyncDataKeyId)
      .mockResolvedValue('public-test-dek-new');
    const dropped = await checkAndCollectDrops(service);
    expect(mockStored).toBeUndefined();
    expect(dropped).toHaveBeenCalledTimes(1);
  });

  test('an unchanged session keeps its key, and a check within five minutes sends nothing', async () => {
    const service = start();
    jest
      .mocked(sessionApi.getCurrentHardwareCloudSyncDataKeyId)
      .mockResolvedValue(hardwareSession.dekId);
    const dropped = await checkAndCollectDrops(service);
    await service.checkHardwareCloudSyncSessionThrottled();
    expect(mockStored).toEqual(expect.objectContaining({ hardwareSession }));
    expect(dropped).not.toHaveBeenCalled();
    expect(
      sessionApi.getCurrentHardwareCloudSyncDataKeyId,
    ).toHaveBeenCalledTimes(1);
  });

  test('opening the Cloud sync page checks even within the five minutes', async () => {
    const service = start();
    jest
      .mocked(sessionApi.getCurrentHardwareCloudSyncDataKeyId)
      .mockResolvedValue(hardwareSession.dekId);
    await service.checkHardwareCloudSyncSessionThrottled();
    await service.checkHardwareCloudSyncSessionThrottled({ force: true });
    expect(
      sessionApi.getCurrentHardwareCloudSyncDataKeyId,
    ).toHaveBeenCalledTimes(2);
  });

  test('sync turned off sends nothing', async () => {
    const service = start();
    mockConfig.isCloudSyncEnabledKeyless = false;
    await service.checkHardwareCloudSyncSessionThrottled();
    expect(
      sessionApi.getCurrentHardwareCloudSyncDataKeyId,
    ).not.toHaveBeenCalled();
  });
});

describe('hardware reset session and local data races', () => {
  const session = {
    deviceKeyJwk: {
      kty: 'EC' as const,
      crv: 'P-256' as const,
      x: 'x',
      y: 'y',
      d: 'd',
    },
    accessToken: 'public-test-access',
    accessTokenExpiresAt: Number.MAX_SAFE_INTEGER,
    refreshToken: 'public-test-refresh',
    sessionId: 'public-test-session',
    dekId: 'public-test-dek',
  };
  const current: IKeylessCloudSyncCredential = {
    ...credential,
    hardwareSession: session,
  };
  const next = {
    dek: 'public-test-next-dek',
    dekId: 'public-test-next-id',
    pwdHash: 'hw-dek-next',
  };
  const unknownItem: IDBCloudSyncItem = {
    id: 'public-test-future-record',
    rawKey: '',
    rawData: '',
    dataType: 'FutureCloudRecord' as EPrimeCloudSyncDataType,
    data: 'public-test-preserved-ciphertext',
    dataTime: 100,
    isDeleted: false,
    pwdHash: current.pwdHash,
    localSceneUpdated: false,
    serverUploaded: false,
  };
  const sessionApi = jest.requireMock<
    typeof import('./hardwareCloudSyncSession')
  >('./hardwareCloudSyncSession');

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = {
      isCloudSyncEnabled: false,
      isCloudSyncEnabledKeyless: true,
      hardwareCloudSyncKeySource: source,
    };
    mockStored = current;
  });
  afterEach(() => {
    jest.restoreAllMocks();
    servicesToClear.forEach((service) =>
      service.clearKeylessCloudSyncCredentialCache(),
    );
    servicesToClear.clear();
  });

  test.each([undefined, 'a'.repeat(64)])(
    'confirmed replacement forwards snapshot %s and commits only after its upload',
    async (overwriteTargetSnapshot) => {
      const { service } = setup();
      const replacementSource = {
        ...source,
        credentialId: `hardware-cloud-v1-${'b'.repeat(64)}`,
        deviceName: 'Other Pro 2',
        deviceType: EDeviceType.Pro2,
      };
      const replacementSession = {
        ...session,
        accessToken: 'public-test-new-access',
        sessionId: 'public-test-new-session',
      };
      jest
        .mocked(sessionApi.verifyHardwareCloudSyncChallenge)
        .mockResolvedValueOnce(replacementSession);
      jest
        .mocked(sessionApi.bootstrapHardwareCloudSyncDataKey)
        .mockResolvedValueOnce({
          ...next,
          generation: 1,
          previousPwdHashes: [],
        });
      jest.spyOn(localDb, 'updateSyncItem').mockResolvedValue(undefined);
      const migration = jest
        .spyOn(hardwareMigration, 'migrateHardwareCloudSyncRecords')
        .mockImplementationOnce(
          async ({
            source: from,
            target,
            savePending,
            beforeFlush,
            overwriteTargetSnapshot: snapshot,
          }) => {
            expect(snapshot).toBe(overwriteTargetSnapshot);
            expect(from.keylessWalletId).toBe(source.credentialId);
            expect(target.keylessWalletId).toBe(replacementSource.credentialId);
            expect(target.hardwareSession?.sessionId).toBe(
              replacementSession.sessionId,
            );
            expect(mockConfig.hardwareCloudSyncKeySource).toEqual(source);
            await savePending({
              target,
              recordsHash: 'public-test-hash',
              phase: 'prepared',
            });
            expect(mockStored?.keylessWalletId).toBe(source.credentialId);
            await beforeFlush();
          },
        );
      jest
        .mocked(generateHardwareCloudSyncCredentialWithSdk)
        .mockImplementationOnce(async (params) => {
          const result = await params.unlock({
            credentialId: replacementSource.credentialId,
            source: replacementSource,
            signAuth: async () => 'public-test-signature',
            deriveKek: async () => 'public-test-kek',
          });
          return {
            credential: { ...result, source: replacementSource },
            source: replacementSource,
          };
        });
      await service.resetHardwareCloudSyncKey({
        connectId,
        targetCredentialId: replacementSource.credentialId,
        overwriteTargetSnapshot,
      });
      expect(migration).toHaveBeenCalledTimes(1);
      expect(generateHardwareCloudSyncCredentialWithSdk).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedCredentialId: replacementSource.credentialId,
        }),
      );
      expect(mockConfig.hardwareCloudSyncKeySource).toEqual(replacementSource);
      expect(mockStored?.keylessWalletId).toBe(replacementSource.credentialId);
      expect(mockStored?.pendingHardwareKeyMigration).toBeUndefined();
      expect(sessionApi.rotateHardwareCloudSyncDataKey).not.toHaveBeenCalled();
    },
  );

  test('a different wallet cannot enter migration without confirming that identity', async () => {
    const { service } = setup();
    const migration = jest.spyOn(
      hardwareMigration,
      'migrateHardwareCloudSyncRecords',
    );
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementationOnce(async (params) => {
        await params.unlock({
          credentialId: 'another-wallet',
          signAuth: async () => 'public-test-signature',
          deriveKek: async () => 'public-test-kek',
        });
        return { credential: current, source };
      });
    await expect(
      service.resetHardwareCloudSyncKey({ connectId }),
    ).rejects.toThrow("can't unlock");
    expect(migration).not.toHaveBeenCalled();
    expect(mockStored).toBe(current);
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(source);
  });

  test('reset preflights unknown local ciphertext before replacing the server key', async () => {
    const { service } = setup([unknownItem]);
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementationOnce(async (params) => {
        await signIn(params);
        return { credential: current, source };
      });
    jest
      .mocked(sessionApi.rotateHardwareCloudSyncDataKey)
      .mockImplementationOnce(async ({ localItems }) => {
        expect(localItems).toEqual([unknownItem]);
        throw new OneKeyLocalError('public-test-cannot-decrypt-unknown-record');
      });
    await expect(
      service.resetHardwareCloudSyncKey({ connectId }),
    ).rejects.toThrow('public-test-cannot-decrypt-unknown-record');
    expect(mockStored).toBe(current);
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
  });

  test('data key commit migrates unknown ciphertext without applying its business payload', async () => {
    const record = { ...unknownItem };
    const { service } = setup([record]);
    jest
      .mocked(sessionApi.reencryptHardwareCloudSyncItems)
      .mockResolvedValueOnce([
        {
          ...record,
          data: 'public-test-new-ciphertext',
          pwdHash: next.pwdHash,
        },
      ]);
    jest
      .spyOn(localDb, 'updateSyncItem')
      .mockImplementationOnce(async ({ updater }) => {
        await updater(record);
      });
    await service['commitHardwareDataKey'](current, next);
    expect(sessionApi.reencryptHardwareCloudSyncItems).toHaveBeenCalledWith(
      expect.objectContaining({ items: [unknownItem], to: next }),
    );
    expect(record).toEqual({
      ...unknownItem,
      data: 'public-test-new-ciphertext',
      pwdHash: next.pwdHash,
    });
    expect(mockStored?.pwdHash).toBe(next.pwdHash);
  });

  test.each(['unavailable key', 'unreadable ciphertext'] as const)(
    'data key commit preserves the credential and unknown record with %s',
    async (failure) => {
      const record = {
        ...unknownItem,
        pwdHash:
          failure === 'unavailable key'
            ? 'hw-dek-unavailable'
            : current.pwdHash,
      };
      const original = { ...record };
      const { service } = setup([record]);
      const update = jest
        .spyOn(localDb, 'updateSyncItem')
        .mockResolvedValue(undefined);
      if (failure === 'unreadable ciphertext') {
        jest
          .mocked(sessionApi.reencryptHardwareCloudSyncItems)
          .mockRejectedValueOnce(
            new Error('public-test-cannot-decrypt-unknown-record'),
          );
      }
      await expect(
        service['commitHardwareDataKey'](current, next),
      ).rejects.toThrow();
      expect(mockStored).toBe(current);
      expect(record).toEqual(original);
      expect(
        keylessSyncCredentialStorage.saveCredential,
      ).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    },
  );

  test('saving a reset snapshot preserves tokens refreshed during the device prompt', async () => {
    const { service } = setup();
    mockStored = {
      ...current,
      hardwareSession: {
        ...session,
        refreshToken: 'public-test-refresh-new',
        accessToken: 'public-test-access-new',
      },
    };
    const saved = await service['saveHardwareCredential']({
      ...current,
      pendingDataKey: { ...next, generation: 2 },
    });
    expect(saved.hardwareSession?.refreshToken).toBe('public-test-refresh-new');
    expect(saved.hardwareSession?.accessToken).toBe('public-test-access-new');
    expect(mockStored?.pendingDataKey?.dekId).toBe(next.dekId);
  });

  test('a refresh preserves a concurrent reset recovery key for the next sync', async () => {
    const { service } = setup();
    const pending = { ...next, generation: 2 };
    const refreshedSession = {
      ...session,
      accessToken: 'public-test-access-new',
      refreshToken: 'public-test-refresh-new',
    };
    let finishRefresh: () => void = () => undefined;
    let refreshEntered: () => void = () => undefined;
    const entered = new Promise<void>((resolve) => {
      refreshEntered = resolve;
    });
    const reply = new Promise<typeof session>((resolve) => {
      finishRefresh = () => resolve(refreshedSession);
    });
    jest
      .mocked(sessionApi.refreshHardwareCloudSyncSessionIfNeeded)
      .mockImplementationOnce(async () => {
        refreshEntered();
        return reply;
      });
    const refreshing = service['getFreshHardwareCredential'](current, {
      force: true,
    });
    await entered;
    await service['saveHardwareCredential']({
      ...current,
      pendingDataKey: pending,
    });
    finishRefresh();
    const fresh = await refreshing;
    expect(fresh.pendingDataKey).toEqual(pending);
    expect(mockStored?.pendingDataKey).toEqual(pending);
    expect(mockStored?.hardwareSession?.refreshToken).toBe(
      refreshedSession.refreshToken,
    );

    // The flush succeeded, but this device stopped before local commit. The
    // following sync must finish with the saved recovery key, without signing.
    jest
      .mocked(sessionApi.getCurrentHardwareCloudSyncDataKeyId)
      .mockResolvedValueOnce(next.dekId);
    jest.spyOn(localDb, 'updateSyncItem').mockResolvedValue(undefined);
    const recovered = await service['handleHardwareDataKeyRefused'](current);
    expect(recovered?.encryptionKey).toBe(next.dek);
    expect(mockStored?.hardwareSession?.dekId).toBe(next.dekId);
    expect(mockStored?.pendingDataKey).toBeUndefined();
    expect(
      mockConfig.hardwareCloudSyncKeyGenerations?.[source.credentialId],
    ).toBe(2);
  });

  test('a stale request keeps a data key another request already recovered', async () => {
    const { service } = setup();
    mockStored = {
      ...current,
      encryptionKey: next.dek,
      pwdHash: next.pwdHash,
      hardwareSession: { ...session, dekId: next.dekId },
    };
    jest
      .mocked(sessionApi.getCurrentHardwareCloudSyncDataKeyId)
      .mockResolvedValueOnce(next.dekId);
    const recovered = await service['handleHardwareDataKeyRefused'](current);
    expect(recovered).toBe(mockStored);
    expect(mockStored.encryptionKey).toBe(next.dek);
    expect(
      keylessSyncCredentialStorage.removeAllCredentials,
    ).not.toHaveBeenCalled();
  });

  test('turning sync off waits for an in-flight refresh and revokes the new session', async () => {
    const { service } = setup();
    const stale = {
      ...current,
      hardwareSession: { ...session, accessTokenExpiresAt: 0 },
    };
    mockStored = stale;
    const refreshedSession = {
      ...session,
      accessToken: 'public-test-access-new',
      refreshToken: 'public-test-refresh-new',
    };
    let finishRefresh: () => void = () => undefined;
    let refreshEntered: () => void = () => undefined;
    const entered = new Promise<void>((resolve) => {
      refreshEntered = resolve;
    });
    const reply = new Promise<typeof session>((resolve) => {
      finishRefresh = () => resolve(refreshedSession);
    });
    jest
      .mocked(sessionApi.refreshHardwareCloudSyncSessionIfNeeded)
      .mockReset()
      .mockResolvedValue(undefined)
      .mockImplementationOnce(async () => {
        refreshEntered();
        return reply;
      });
    const refreshing = service['getFreshHardwareCredential'](stale);
    const observedRefresh = refreshing.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    await entered;
    const disabling = service.setCloudSyncEnabledKeyless(false);
    // Let the disable flow reach its wait before the server answers refresh.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const blockedRefresh = service['getFreshHardwareCredential'](stale).then(
      () => undefined,
      (error: unknown) => error,
    );
    finishRefresh();
    await disabling;
    expect(await observedRefresh).toMatchObject({
      value: { hardwareSession: refreshedSession },
    });
    expect(await blockedRefresh).toEqual(
      expect.objectContaining({
        message: 'Cloud sync settings changed. Try again.',
      }),
    );
    expect(sessionApi.revokeHardwareCloudSyncSession).toHaveBeenCalledWith(
      expect.objectContaining({ session: refreshedSession, scope: 'current' }),
    );
    expect(mockStored).toBeUndefined();
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
  });

  test('revocation reads the stored session after waiting for an earlier refresh', async () => {
    const { service } = setup();
    const fresh = {
      ...current,
      hardwareSession: {
        ...session,
        accessToken: 'public-test-access-new',
        refreshToken: 'public-test-refresh-new',
      },
    };
    mockStored = fresh;
    service['hardwareSessionRefresh'] = Promise.resolve(fresh);
    await service['revokeCurrentHardwareSession'](current);
    expect(sessionApi.revokeHardwareCloudSyncSession).toHaveBeenCalledWith(
      expect.objectContaining({
        session: fresh.hardwareSession,
        scope: 'current',
      }),
    );
  });

  test('a late refresh cannot restore the data key retired by a reset', async () => {
    const { service } = setup();
    mockStored = {
      ...current,
      pwdHash: next.pwdHash,
      hardwareSession: { ...session, dekId: next.dekId },
    };
    await expect(
      service['saveHardwareCredential'](
        {
          ...current,
          hardwareSession: {
            ...session,
            refreshToken: 'public-test-refreshed',
          },
        },
        { expected: current, refreshedSession: true },
      ),
    ).rejects.toThrow('settings changed');
    expect(mockStored.pwdHash).toBe(next.pwdHash);
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
  });

  test('finishes key reset when persisting the optional device name fails', async () => {
    const { service, backgroundApi } = setup();
    jest.spyOn(localDb, 'updateSyncItem').mockResolvedValue(undefined);
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementationOnce(async (params) => {
        await signIn(params);
        return {
          credential: current,
          source: { ...source, deviceName: 'Latest label' },
        };
      });
    jest
      .mocked(sessionApi.rotateHardwareCloudSyncDataKey)
      .mockImplementationOnce(async (params) => {
        await params.savePending({ ...next, generation: 2 });
        await params.beforeFlush?.();
        return { next, generation: 2, items: [] };
      });
    const setConfig = jest.mocked(primeCloudSyncPersistAtom.set);
    const originalSetConfig = setConfig.getMockImplementation();
    if (!originalSetConfig)
      throw new OneKeyLocalError('Missing atom setter fixture');
    setConfig.mockImplementation(async (update) => {
      const updated =
        typeof update === 'function' ? update(mockConfig) : update;
      if (updated.hardwareCloudSyncKeySource?.deviceName === 'Latest label') {
        throw new OneKeyLocalError('Display metadata storage unavailable');
      }
      mockConfig = updated;
    });
    try {
      await service.resetHardwareCloudSyncKey({ connectId });
    } finally {
      setConfig.mockImplementation(originalSetConfig);
    }
    expect(mockStored?.pwdHash).toBe(next.pwdHash);
    expect(
      mockConfig.hardwareCloudSyncKeyGenerations?.[source.credentialId],
    ).toBe(2);
    expect(sessionApi.revokeHardwareCloudSyncSession).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'allExceptCurrent' }),
    );
    expect(
      backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
    ).toHaveBeenCalledTimes(2);
    expect(
      backgroundApi.servicePrimeCloudSync.updateLastSyncTime,
    ).toHaveBeenCalledWith({
      syncMode: ECloudSyncMode.Keyless,
    });
  });

  test('reset reads local items after signing and refuses cancellation once flush starts', async () => {
    const { service, backgroundApi } = setup();
    const edited = {
      id: 'account',
      dataType: 'IndexedAccount',
      pwdHash: current.pwdHash,
      rawData: 'new-name',
      dataTime: 2,
    } as IDBCloudSyncItem;
    jest
      .spyOn(backgroundApi.servicePrimeCloudSync, 'getAllLocalSyncItems')
      .mockResolvedValue({ items: [edited] });
    jest.spyOn(localDb, 'updateSyncItem').mockResolvedValue(undefined);
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementation(async (params) => {
        await signIn(params);
        return {
          credential: current,
          source: { ...source, deviceName: 'Latest label' },
        };
      });
    jest
      .mocked(sessionApi.rotateHardwareCloudSyncDataKey)
      .mockImplementation(async (params) => {
        await params.savePending({ ...next, generation: 2 });
        await params.beforeFlush?.();
        expect(await service.cancelHardwareCloudKeyOperation()).toBe(false);
        return { next, generation: 2, items: [] };
      });
    await service.resetHardwareCloudSyncKey({ connectId });
    expect(sessionApi.reencryptHardwareCloudSyncItems).toHaveBeenCalledWith(
      expect.objectContaining({ items: [edited], to: next }),
    );
    expect(mockStored?.pwdHash).toBe(next.pwdHash);
    expect(mockConfig.hardwareCloudSyncKeySource?.deviceName).toBe(
      'Latest label',
    );
    expect(await service.cancelHardwareCloudKeyOperation()).toBe(true);
  });

  test('an edit made during re-encryption is not overwritten inside the database transaction', async () => {
    const { service, backgroundApi } = setup();
    const original = {
      id: 'account',
      dataType: 'IndexedAccount',
      pwdHash: current.pwdHash,
      rawData: 'old-name',
      data: 'old-ciphertext',
      dataTime: 1,
    } as IDBCloudSyncItem;
    const newer = {
      ...original,
      rawData: 'new-name',
      data: 'newer-ciphertext',
      dataTime: 2,
    };
    jest
      .spyOn(backgroundApi.servicePrimeCloudSync, 'getAllLocalSyncItems')
      .mockResolvedValue({ items: [original] });
    jest
      .mocked(sessionApi.reencryptHardwareCloudSyncItems)
      .mockResolvedValueOnce([
        { ...original, data: 'new-key-ciphertext', pwdHash: next.pwdHash },
      ]);
    jest
      .spyOn(localDb, 'updateSyncItem')
      .mockImplementation(async ({ updater }) => {
        await updater(newer);
      });
    await service['commitHardwareDataKey'](current, next);
    expect(newer.rawData).toBe('new-name');
    expect(newer.data).toBe('newer-ciphertext');
    expect(newer.dataTime).toBe(2);
  });

  test('reset waits for an admitted server write before reading and committing local data', async () => {
    const { service, backgroundApi } = setup();
    const record = {
      id: 'account',
      dataType: 'IndexedAccount',
      pwdHash: current.pwdHash,
      rawData: 'local-new-edit',
      data: 'ciphertext-A',
      dataTime: 200,
    } as IDBCloudSyncItem;
    backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems.mockResolvedValue({
      items: [record],
    });
    jest.spyOn(localDb, 'updateSyncItem').mockResolvedValue(undefined);
    let resumeWrite = () => {};
    let writeEntered = () => {};
    const paused = new Promise<void>((resolve) => {
      resumeWrite = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      writeEntered = resolve;
    });
    const writing = service.runWithCloudSyncKeyLock(async () => {
      writeEntered();
      await paused;
      record.rawData = 'server-write-completed';
    });
    await entered;
    const committing = service['commitHardwareDataKey'](current, next);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const storedWhilePaused = mockStored;
    const readsWhilePaused =
      backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems.mock.calls
        .length;
    resumeWrite();
    await Promise.all([writing, committing]);
    expect(storedWhilePaused?.pwdHash).toBe(current.pwdHash);
    expect(readsWhilePaused).toBe(0);
    expect(sessionApi.reencryptHardwareCloudSyncItems).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ rawData: 'server-write-completed' })],
        to: next,
      }),
    );
    expect(mockStored?.pwdHash).toBe(next.pwdHash);
  });

  test('reset keeps the key lock until local re-encryption has been written', async () => {
    const { service } = setup();
    let resumeWrite = () => {};
    let writeEntered = () => {};
    const paused = new Promise<void>((resolve) => {
      resumeWrite = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      writeEntered = resolve;
    });
    jest.spyOn(localDb, 'updateSyncItem').mockImplementationOnce(async () => {
      writeEntered();
      await paused;
    });
    const committing = service['commitHardwareDataKey'](current, next);
    await entered;
    let nextOperationStarted = false;
    const switching = service.runWithCloudSyncKeyLock(async () => {
      nextOperationStarted = true;
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const overtookCommit = nextOperationStarted;
    resumeWrite();
    await Promise.all([committing, switching]);
    expect(overtookCommit).toBe(false);
    expect(nextOperationStarted).toBe(true);
  });

  test('a cancelled reset cannot clear another operation committing state', async () => {
    const { service } = setup();
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementationOnce(async () => {
        expect(await service.cancelHardwareCloudKeyOperation()).toBe(true);
        // Another operation entered its irreversible phase before this old
        // device request reported cancellation.
        service['hardwareCloudKeyCommitting'] = true;
        throw new OneKeyLocalError('public-test-cancelled');
      });
    const hide = jest.spyOn(service, 'hideDialogLoading');
    await expect(
      service.resetHardwareCloudSyncKey({ connectId }),
    ).rejects.toThrow('public-test-cancelled');
    expect(await service.cancelHardwareCloudKeyOperation()).toBe(false);
    expect(hide).not.toHaveBeenCalled();
  });
});
