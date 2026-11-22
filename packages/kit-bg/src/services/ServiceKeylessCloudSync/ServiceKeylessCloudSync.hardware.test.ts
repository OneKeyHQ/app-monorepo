import { createHash } from 'crypto';

import { EDeviceType } from '@onekeyfe/hd-shared';
import axios from 'axios';

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
import { SECURE_STORAGE_PERMANENT_READ_ERROR_NAME } from '@onekeyhq/shared/src/storage/secureStorage/types';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';
import { ECloudSyncMode } from '@onekeyhq/shared/types/keylessCloudSync';

import localDb from '../../dbs/local/localDb';
import { LocalDbBase } from '../../dbs/local/LocalDbBase';
import { LocalDbBaseContainer } from '../../dbs/local/LocalDbBaseContainer';
import { EIndexedDBBucketNames } from '../../dbs/local/types';
import { primeCloudSyncPersistAtom } from '../../states/jotai/atoms';
import keylessSyncCredentialStorage from '../ServiceKeylessWallet/utils/keylessSyncCredentialStorage';
import ServicePassword from '../ServicePassword';
import { isSupportedCloudSyncDataType } from '../ServicePrimeCloudSync/cloudSyncCheckUtils';
import cloudSyncItemBuilder from '../ServicePrimeCloudSync/cloudSyncItemBuilder';
import ServicePrimeCloudSync from '../ServicePrimeCloudSync/ServicePrimeCloudSync';

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
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

let mockUseTestEndpoint = false;
const mockDevSettingsListeners = new Set<() => void>();

function changeMockTestEndpoint() {
  mockUseTestEndpoint = true;
  for (const listener of mockDevSettingsListeners) listener();
}

let mockConfig: IPrimeCloudSyncPersistAtomData;
let mockStored: IKeylessCloudSyncCredential | undefined;

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { error: { log: jest.fn() } },
    account: {
      secretPerf: {
        decodePassword: jest.fn(),
        decodePasswordDone: jest.fn(),
        keyFromPasswordAndSalt: jest.fn(),
        keyFromPasswordAndSaltDone: jest.fn(),
        decryptAES: jest.fn(),
        decryptAESDone: jest.fn(),
      },
    },
  },
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
    sub: jest.fn((listener: () => void) => {
      mockDevSettingsListeners.add(listener);
      return () => {
        mockDevSettingsListeners.delete(listener);
      };
    }),
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
jest.mock('./hardwareCloudSyncRecovery', () => {
  const actual = jest.requireActual<
    typeof import('./hardwareCloudSyncRecovery')
  >('./hardwareCloudSyncRecovery');
  return {
    ...actual,
    recoverVerifiedWalletCaches: jest.fn(actual.recoverVerifiedWalletCaches),
  };
});

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
const displayDeviceSerialNo = 'public-test-device-a';
const displayDeviceSerialNoHash = createHash('sha256')
  .update(displayDeviceSerialNo)
  .digest('hex');
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
  mockDevSettingsListeners.clear();
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
    async (_options?: {
      preservePendingHardwareRefresh?: boolean;
    }): Promise<void> => undefined,
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
      invalidateOneKeyIdCloudSyncToggle: jest.fn(),
      invalidateSyncCredentialMemo: jest.fn(),
      getPublicAccountSnapshotImportGeneration: jest.fn(() => 0),
      cancelPublicAccountSnapshotImport: jest.fn(async () => undefined),
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
      prepareLocalSyncWallets: jest.fn(async () => undefined),
      initLocalSyncItemsDB,
    },
  };
  const service = new ServiceKeylessCloudSync({ backgroundApi });
  // Hardware requests use the plain Prime client, not the OneKey ID one.
  const getClient = jest
    .spyOn(service, 'getClient')
    .mockResolvedValue({} as AxiosInstance);
  clearCachedSyncCredential.mockImplementation(async (options) =>
    service.clearKeylessCloudSyncCredentialCache(options),
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

  test('a Wallet read retry never falls back to software Cloud sync', async () => {
    const { service, getClient } = setup();
    const prepareWalletRetry = jest.fn(async () => undefined);
    await expect(
      service.apiUploadItemsKeyless({
        urlPath: '/prime/v1/sync/upload',
        postData: { pwdHash: 'hw-dek-test-retry', localData: [], nonce: 0 },
        prepareWalletRetry,
      }),
    ).rejects.toThrow('retry cancelled');
    expect(getClient).not.toHaveBeenCalled();
    expect(prepareWalletRetry).not.toHaveBeenCalled();
  });

  test.each([
    'current',
    'revoked',
    'rotated',
    'switched',
    'transitioning',
  ] as const)(
    'archive admission does not apply an unchanged foreign row under expired cached authority: %s',
    async (scenario) => {
      const { service } = setup();
      const expected: IKeylessCloudSyncCredential = {
        ...credential,
        pwdHash: 'hw-dek-archive-old-fixture',
        hardwareSession: {
          accessToken: 'public-test-access',
          accessTokenExpiresAt: Number.MAX_SAFE_INTEGER,
          refreshToken: 'public-test-refresh',
          sessionId: 'public-test-session',
          dekId: 'public-test-old-dek',
          deviceKeyJwk: {
            kty: 'EC',
            crv: 'P-256',
            x: 'public-test-x',
            y: 'public-test-y',
            d: 'public-test-fixture-d',
          },
        },
      };
      mockConfig = {
        isCloudSyncEnabled: false,
        isCloudSyncEnabledKeyless: true,
        hardwareCloudSyncKeySource: source,
      };
      mockStored = expected;
      await service.runWithCloudSyncKeyLock(async () => undefined);
      if (scenario === 'revoked') mockStored = undefined;
      if (scenario === 'rotated') {
        const session = expected.hardwareSession;
        if (!session) throw new OneKeyLocalError('Missing fixture session');
        mockStored = {
          ...expected,
          pwdHash: 'hw-dek-archive-new-fixture',
          encryptionKey: 'public-fixture-new-key',
          hardwareSession: { ...session, dekId: 'public-test-new-dek' },
        };
      }
      if (scenario === 'switched') {
        mockConfig.hardwareCloudSyncKeySource = undefined;
      }
      if (scenario === 'transitioning') {
        mockStored = {
          ...expected,
          pendingDataKey: {
            dek: 'fixture-next-key',
            dekId: 'fixture-next-generation',
            pwdHash: 'hw-dek-next-fixture',
          },
        };
      }
      let canonicalRow = 'unchanged-foreign-record';
      const apply = jest.fn(async () => {
        canonicalRow = 'committed-current-account';
        return true;
      });
      const result = await service.runWithCloudAccountImportLock(() =>
        service.runWithVerifiedHardwareAccountArchiveSession(expected, apply),
      );
      expect(result).toBe(scenario === 'current' ? true : undefined);
      expect(apply).toHaveBeenCalledTimes(scenario === 'current' ? 1 : 0);
      expect(canonicalRow).toBe(
        scenario === 'current'
          ? 'committed-current-account'
          : 'unchanged-foreign-record',
      );
    },
  );

  test('skips account label refreshes when the Cloud source has a Bluetooth name', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = {
      ...source,
      deviceName: 'Neo 1797',
      deviceBleName: 'Neo 1797',
      deviceSerialNoHash: displayDeviceSerialNoHash,
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
    {
      serialNo: displayDeviceSerialNo,
      bleName: undefined,
      expectedName: 'Latest label',
      expectedBleName: undefined,
    },
    {
      serialNo: displayDeviceSerialNo,
      bleName: 'Neo 1797',
      expectedName: 'Neo 1797',
      expectedBleName: 'Neo 1797',
    },
    {
      serialNo: 'public-test-device-b',
      bleName: undefined,
      expectedName: 'Old label',
      expectedBleName: undefined,
    },
    {
      serialNo: 'public-test-device-b',
      bleName: 'Neo 1797',
      expectedName: 'Old label',
      expectedBleName: undefined,
    },
    {
      serialNo: '',
      bleName: undefined,
      expectedName: 'Old label',
      expectedBleName: undefined,
    },
  ])(
    'matches the physical device $serialNo before using BLE name $bleName',
    async ({ serialNo, bleName, expectedName, expectedBleName }) => {
      const { service } = setup();
      const xfp = `00001234--xpub${'A'.repeat(107)}`;
      mockConfig.hardwareCloudSyncKeySource = {
        ...source,
        credentialId: `hardware-cloud-v1-${createHash('sha256')
          .update(xfp)
          .digest('hex')}`,
        deviceName: 'Old label',
        deviceSerialNoHash: displayDeviceSerialNoHash,
      };
      const getWallet = jest.spyOn(localDb, 'getWalletSafe').mockResolvedValue({
        id: 'hw-device-1',
        associatedDevice: 'device-1',
        xfp,
      } as IDBWallet);
      const getDevice = jest.spyOn(localDb, 'getDeviceSafe').mockResolvedValue({
        id: 'device-1',
        uuid: serialNo,
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
          expectedBleName,
        );
        expect(mockConfig.hardwareCloudSyncKeySource.deviceSerialNoHash).toBe(
          displayDeviceSerialNoHash,
        );
      } finally {
        getWallet.mockRestore();
        getDevice.mockRestore();
      }
    },
  );

  test.each([
    {
      associatedDevice: 'device-1',
      label: 'Firmware name',
      expected: 'Firmware name',
    },
    {
      associatedDevice: 'device-1',
      label: 'Cached V1 label',
      stateLabel: 'Current V2 label',
      expected: 'Current V2 label',
    },
    {
      associatedDevice: 'replaced-device',
      label: 'Different device',
      expected: 'Old label',
    },
    { associatedDevice: 'device-1', label: undefined, expected: 'Old label' },
  ])(
    'reads only the current linked device for passive Cloud label refresh ($associatedDevice, $label)',
    async ({ associatedDevice, label, stateLabel, expected }) => {
      const { service } = setup();
      const xfp = `00001234--xpub${'A'.repeat(107)}`;
      mockConfig.hardwareCloudSyncKeySource = {
        ...source,
        credentialId: `hardware-cloud-v1-${createHash('sha256').update(xfp).digest('hex')}`,
        deviceName: 'Old label',
        deviceSerialNoHash: displayDeviceSerialNoHash,
      };
      const getWallet = jest.spyOn(localDb, 'getWalletSafe').mockResolvedValue({
        id: 'hw-device-1',
        associatedDevice,
        xfp,
        name: 'Stale local shadow',
      } as IDBWallet);
      const getDevice = jest.spyOn(localDb, 'getDeviceSafe').mockResolvedValue({
        id: 'device-1',
        uuid: displayDeviceSerialNo,
        name: 'Not a confirmed label',
        featuresInfo: { label },
        ...(stateLabel
          ? {
              deviceStateInfo: {
                protocol: 'V2',
                revision: 2,
                updatedAt: 100,
                identity: {
                  label: stateLabel,
                  serialNo: displayDeviceSerialNo,
                },
                status: {},
                settings: {},
                versions: {},
              },
            }
          : {}),
      } as IDBDevice);
      try {
        await service.syncHardwareCloudSyncDeviceLabel({
          walletId: 'hw-device-1',
          dbDeviceId: 'device-1',
        });
        expect(mockConfig.hardwareCloudSyncKeySource.deviceName).toBe(expected);
        expect(getWallet).toHaveBeenCalledWith({
          walletId: 'hw-device-1',
          withoutRefill: true,
        });
        if (associatedDevice !== 'device-1')
          expect(getDevice).not.toHaveBeenCalled();
      } finally {
        getWallet.mockRestore();
        getDevice.mockRestore();
      }
    },
  );

  test('keeps a legacy Cloud source name until a signing operation identifies its device', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = {
      ...source,
      deviceName: 'Old label',
    };
    const getWallet = jest
      .spyOn(localDb, 'getWalletSafe')
      .mockResolvedValue(undefined);
    try {
      await service.syncHardwareCloudSyncDeviceLabel({
        walletId: 'hw-device-1',
        label: 'Other label',
      });
      expect(getWallet).not.toHaveBeenCalled();
      expect(mockConfig.hardwareCloudSyncKeySource.deviceName).toBe(
        'Old label',
      );
    } finally {
      getWallet.mockRestore();
    }
  });

  test('does not overwrite a new physical source selected during a label refresh', async () => {
    const { service } = setup();
    const xfp = `00001234--xpub${'A'.repeat(107)}`;
    const selected = {
      ...source,
      credentialId: `hardware-cloud-v1-${createHash('sha256')
        .update(xfp)
        .digest('hex')}`,
      deviceName: 'Old label',
      deviceSerialNoHash: displayDeviceSerialNoHash,
    };
    mockConfig.hardwareCloudSyncKeySource = selected;
    const getWallet = jest.spyOn(localDb, 'getWalletSafe').mockResolvedValue({
      id: 'hw-device-1',
      associatedDevice: 'device-1',
      xfp,
    } as IDBWallet);
    const getDevice = jest
      .spyOn(localDb, 'getDeviceSafe')
      .mockImplementationOnce(async () => {
        mockConfig.hardwareCloudSyncKeySource = {
          ...selected,
          deviceName: 'Other physical device',
          deviceSerialNoHash: createHash('sha256')
            .update('public-test-device-b')
            .digest('hex'),
        };
        return {
          id: 'device-1',
          uuid: displayDeviceSerialNo,
          name: 'Latest label',
        } as IDBDevice;
      });
    try {
      await service.syncHardwareCloudSyncDeviceLabel({
        walletId: 'hw-device-1',
        label: 'Latest label',
      });
      expect(mockConfig.hardwareCloudSyncKeySource.deviceName).toBe(
        'Other physical device',
      );
    } finally {
      getWallet.mockRestore();
      getDevice.mockRestore();
    }
  });

  test('ignores another hardware wallet when refreshing the fallback label', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = {
      ...source,
      deviceName: 'Old label',
      deviceSerialNoHash: displayDeviceSerialNoHash,
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
        if (phase === 'hardware signature') changeMockTestEndpoint();
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
            changeMockTestEndpoint();
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
            changeMockTestEndpoint();
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

  test('optional local credential reads never enter retired OneKey ID or sync-off storage paths', async () => {
    const { service, backgroundApi } = setup();
    mockConfig.currentCloudSyncKeylessWalletId = 'hd-keyless-test';
    await expect(
      service.getLocalMutationSyncCredential(),
    ).resolves.toBeUndefined();
    mockConfig.isCloudSyncEnabled = true;
    await expect(
      service.getLocalMutationSyncCredential(),
    ).resolves.toBeUndefined();
    expect(keylessSyncCredentialStorage.getCredential).not.toHaveBeenCalled();
    expect(
      backgroundApi.servicePrime.apiFetchPrimeUserInfo,
    ).not.toHaveBeenCalled();
    expect(
      backgroundApi.servicePrimeCloudSync.clearCachedSyncCredential,
    ).not.toHaveBeenCalled();
  });

  test('discarding a late local credential read cannot affect a newly selected hardware credential', async () => {
    const { service, backgroundApi } = setup();
    const software: IKeylessCloudSyncCredential = {
      ...credential,
      source: undefined,
      keylessWalletId: 'hd-keyless-test',
    };
    mockStored = software;
    mockConfig = {
      isCloudSyncEnabled: false,
      isCloudSyncEnabledKeyless: true,
      currentCloudSyncKeylessWalletId: software.keylessWalletId,
    };
    await expect(
      service.getLocalMutationSyncCredential(),
    ).resolves.toMatchObject({ keylessCredential: software });
    expect(
      service.getKeylessCloudSyncCredentialCacheSync(software.keylessWalletId),
    ).toBeUndefined();

    const entered = Promise.withResolvers<void>();
    const delayed = Promise.withResolvers<IKeylessCloudSyncCredential | null>();
    jest
      .mocked(keylessSyncCredentialStorage.getCredential)
      .mockImplementationOnce(() => {
        entered.resolve();
        return delayed.promise;
      });
    const old = service.getLocalMutationSyncCredential();
    await entered.promise;
    await service.setCloudSyncEnabledKeyless(false);
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementationOnce(async ({ unlock }) => ({
        source,
        credential: await unlock({
          credentialId: source.credentialId,
          signAuth: async () => 'public-test-signature',
          deriveKek: async () => 'public-test-kek',
        }),
      }));
    await service.enableHardwareCloudSync({ connectId });
    const active = mockStored;
    expect(active?.signingPublicKey).toBe('');
    expect(active?.hardwareSession?.dekId).toBeTruthy();
    expect(await service.getLocalMutationSyncCredential()).toMatchObject({
      keylessCredential: active,
    });
    jest
      .mocked(backgroundApi.servicePrimeCloudSync.clearCachedSyncCredential)
      .mockClear();

    delayed.resolve(software);
    await expect(old).resolves.toBeUndefined();
    expect(
      backgroundApi.servicePrimeCloudSync.clearCachedSyncCredential,
    ).not.toHaveBeenCalled();
    expect(
      service.getKeylessCloudSyncCredentialCacheSync(source.credentialId),
    ).toEqual(active);
    expect(mockStored).toEqual(active);
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

  test('allows confirmed Off while an ordinary local writer holds the key lock', async () => {
    const { service } = setup();
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const write = service.runWithCloudSyncKeyLock(async () => {
      entered.resolve();
      await release.promise;
    });
    try {
      await entered.promise;
      expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
      expect(service.isKeylessSyncOffStateSettled()).toBe(true);
    } finally {
      release.resolve();
      await write;
    }
  });

  test('allows confirmed Off during steady-state hardware credential cleanup', async () => {
    const { service } = setup();
    await service.runWithCloudSyncKeyLock(async () => undefined);
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockStored = credential;
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    jest
      .mocked(keylessSyncCredentialStorage.removeAllCredentials)
      .mockImplementationOnce(async () => {
        entered.resolve();
        await release.promise;
      });

    const sweep = service.sweepHardwareCloudKeyIfSyncOff();
    try {
      await entered.promise;
      expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
      expect(service.isKeylessSyncOffStateSettled()).toBe(true);
    } finally {
      release.resolve();
      await expect(sweep).resolves.toBe(true);
    }
  });

  test('does not report Off while switching from a retained hardware source to Keyless', async () => {
    const { service } = setup();
    await service.runWithCloudSyncKeyLock(async () => undefined);
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockStored = credential;
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    jest
      .mocked(keylessSyncCredentialStorage.removeAllCredentials)
      .mockImplementationOnce(async () => {
        entered.resolve();
        await release.promise;
      });

    const changeSource = service.selectKeylessCloudSyncKey();
    try {
      await entered.promise;
      expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
      expect(service.isKeylessSyncOffStateSettled()).toBe(false);
    } finally {
      release.resolve();
      await changeSource;
    }
    expect(mockConfig.hardwareCloudSyncKeySource).toBeUndefined();
    expect(service.isKeylessSyncOffStateSettled()).toBe(true);
  });

  test('does not report Off while a software disable is settling credentials', async () => {
    const { service } = setup();
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockConfig.currentCloudSyncKeylessWalletId = 'hd-software';
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    jest
      .mocked(keylessSyncCredentialStorage.removeAllCredentials)
      .mockImplementationOnce(async () => {
        entered.resolve();
        await release.promise;
      });

    const disable = service.toggleCloudSyncKeyless({ enabled: false });
    try {
      await entered.promise;
      expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
      expect(service.isKeylessSyncOffStateSettled()).toBe(false);
    } finally {
      release.resolve();
      await disable;
    }
    expect(service.isKeylessSyncOffStateSettled()).toBe(true);
  });

  test('does not report Off while overlapping software enable calls prepare outside the key lock', async () => {
    const { service } = setup();
    const firstEntered = Promise.withResolvers<void>();
    const secondEntered = Promise.withResolvers<void>();
    const firstPrepare = Promise.withResolvers<{ success: boolean }>();
    const secondPrepare = Promise.withResolvers<{ success: boolean }>();
    jest
      .spyOn(service, 'prepareCloudSyncKeyless')
      .mockImplementationOnce(() => {
        firstEntered.resolve();
        return firstPrepare.promise;
      })
      .mockImplementationOnce(() => {
        secondEntered.resolve();
        return secondPrepare.promise;
      });

    const first = service.toggleCloudSyncKeyless({
      enabled: true,
      silentEnable: true,
    });
    const second = service.toggleCloudSyncKeyless({
      enabled: true,
      silentEnable: true,
    });
    try {
      await Promise.all([firstEntered.promise, secondEntered.promise]);
      expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
      expect(service.isKeylessSyncOffStateSettled()).toBe(false);
      firstPrepare.resolve({ success: false });
      await first;
      expect(service.isKeylessSyncOffStateSettled()).toBe(false);
    } finally {
      firstPrepare.resolve({ success: false });
      secondPrepare.resolve({ success: false });
      await Promise.all([first, second]);
    }
    expect(service.isKeylessSyncOffStateSettled()).toBe(true);
  });

  test('does not report Off while an admitted migration is waiting for legacy presync', async () => {
    const { service, backgroundApi } = setup();
    mockConfig.isCloudSyncEnabled = true;
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<undefined>();
    backgroundApi.servicePrimeCloudSync.startServerSyncFlow.mockImplementationOnce(
      () => {
        entered.resolve();
        return release.promise;
      },
    );
    const toggle = jest
      .spyOn(service, 'toggleCloudSyncKeyless')
      .mockImplementationOnce(async () => {
        expect(service.isKeylessSyncOffStateSettled()).toBe(false);
        return undefined;
      });

    const migration = service.enableKeylessCloudSyncWithMigrationIfNeeded();
    try {
      await entered.promise;
      expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
      expect(toggle).not.toHaveBeenCalled();
      expect(service.isKeylessSyncOffStateSettled()).toBe(false);
    } finally {
      release.resolve(undefined);
      await migration;
    }
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(service.isKeylessSyncOffStateSettled()).toBe(true);
  });

  test('only settled and explicitly Off settings skip the Wallet sync guard', async () => {
    const { service } = setup();
    const keyLock = jest.spyOn(service, 'runWithCloudSyncKeyLock');
    await expect(service.isExplicitWalletMetadataSyncOff()).resolves.toBe(true);
    for (const flags of [
      { isCloudSyncEnabled: true },
      {
        isCloudSyncEnabledKeyless: true,
        currentCloudSyncKeylessWalletId: 'hd-software',
      },
      { hardwareCloudSyncKeySource: source },
      { currentCloudSyncKeylessWalletId: 'hd-selected-before-enable' },
      { isCloudSyncEnabledKeyless: undefined },
    ]) {
      mockConfig = {
        isCloudSyncEnabled: false,
        isCloudSyncEnabledKeyless: false,
        ...flags,
      };
      await expect(service.isExplicitWalletMetadataSyncOff()).resolves.toBe(
        false,
      );
    }
    const unavailable = new OneKeyLocalError('Synthetic settings read failure');
    jest
      .mocked(primeCloudSyncPersistAtom.get)
      .mockRejectedValueOnce(unavailable);
    await expect(service.isExplicitWalletMetadataSyncOff()).resolves.toBe(
      false,
    );
    const pending = Promise.withResolvers<IPrimeCloudSyncPersistAtomData>();
    jest
      .mocked(primeCloudSyncPersistAtom.get)
      .mockReturnValueOnce(pending.promise);
    jest.useFakeTimers();
    try {
      const check = service.isExplicitWalletMetadataSyncOff();
      await jest.advanceTimersByTimeAsync(200);
      await expect(check).resolves.toBe(false);
      pending.resolve({
        isCloudSyncEnabled: false,
        isCloudSyncEnabledKeyless: false,
      });
      await jest.runAllTimersAsync();
      expect(keyLock).not.toHaveBeenCalled();
      expect(keylessSyncCredentialStorage.getCredential).not.toHaveBeenCalled();
    } finally {
      pending.resolve(mockConfig);
      jest.useRealTimers();
    }
  });

  test('an unreadable Desktop credential permits only the local display callback', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    const unavailable = new Error('Synthetic secure-storage failure');
    unavailable.name = SECURE_STORAGE_PERMANENT_READ_ERROR_NAME;
    jest
      .mocked(keylessSyncCredentialStorage.getCredential)
      .mockRejectedValueOnce(unavailable);
    const ordinary = jest.fn(async () => 'ordinary');
    const localDisplay = jest.fn(async () => 'local-only');
    await expect(
      service.runWithDesktopWalletMetadataKey(ordinary, localDisplay),
    ).resolves.toBe('local-only');
    expect(ordinary).not.toHaveBeenCalled();
    expect(localDisplay).toHaveBeenCalledTimes(1);
    expect(
      keylessSyncCredentialStorage.removeAllCredentials,
    ).not.toHaveBeenCalled();
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
  });

  test('a real business failure is not converted into local display success', async () => {
    const { service } = setup();
    mockConfig.isCloudSyncEnabled = false;
    mockConfig.isCloudSyncEnabledKeyless = false;
    const businessFailure = new OneKeyLocalError(
      'Unexpected local write failure',
    );
    const ordinary = jest.fn(async () => {
      throw businessFailure;
    });
    const localDisplay = jest.fn();
    await expect(
      service.runWithDesktopWalletMetadataKey(ordinary, localDisplay),
    ).rejects.toBe(businessFailure);
    expect(localDisplay).not.toHaveBeenCalled();
  });

  test('a stalled credential read cannot cause a late second Wallet write', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    const blocked = Promise.withResolvers<IKeylessCloudSyncCredential | null>();
    jest
      .mocked(keylessSyncCredentialStorage.getCredential)
      .mockReturnValueOnce(blocked.promise);
    const ordinary = jest.fn(async () => 'ordinary');
    const localDisplay = jest.fn(async () => 'local-only');
    jest.useFakeTimers();
    try {
      const save = service.runWithDesktopWalletMetadataKey(
        ordinary,
        localDisplay,
      );
      await jest.advanceTimersByTimeAsync(1000);
      await expect(save).resolves.toBe('local-only');
      blocked.resolve(null);
      await jest.runAllTimersAsync();
      expect(ordinary).not.toHaveBeenCalled();
      expect(localDisplay).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('after admission a stalled optional preparation cannot write after the local save', async () => {
    const { service } = setup();
    mockConfig.isCloudSyncEnabled = false;
    mockConfig.isCloudSyncEnabledKeyless = false;
    const finishCloudPreparation = Promise.withResolvers<void>();
    const admitted = Promise.withResolvers<void>();
    const cloudBusinessWrite = jest.fn();
    const optionalPreparation = jest.fn(
      async (_credential: unknown, claimWrite: () => boolean) => {
        admitted.resolve();
        await finishCloudPreparation.promise;
        if (claimWrite()) cloudBusinessWrite();
        return 'cloud';
      },
    );
    const localDisplay = jest.fn(async () => 'local-only');
    jest.useFakeTimers();
    try {
      const save = service.runWithDesktopWalletMetadataKey(
        optionalPreparation,
        localDisplay,
      );
      await admitted.promise;
      await jest.advanceTimersByTimeAsync(1000);
      await expect(save).resolves.toBe('local-only');
      finishCloudPreparation.resolve();
      await jest.runAllTimersAsync();
      expect(optionalPreparation).toHaveBeenCalledTimes(1);
      expect(localDisplay).toHaveBeenCalledTimes(1);
      expect(cloudBusinessWrite).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
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

  test('disabling sync cancels imports before waiting for an active import to finish', async () => {
    const { service, backgroundApi } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockStored = credential;
    let release: () => void = () => undefined;
    let entered: () => void = () => undefined;
    const active = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    const importing = service.runWithCloudAccountImportLock(async () => {
      entered();
      await paused;
    });
    await active;
    const disabling = service.setCloudSyncEnabledKeyless(false);
    await Promise.resolve();
    expect(
      backgroundApi.servicePrimeCloudSync.cancelPublicAccountSnapshotImport,
    ).toHaveBeenCalled();
    expect(mockStored).toBe(credential);
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
    release();
    await Promise.all([importing, disabling]);
    expect(mockStored).toBeUndefined();
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
  });

  test('wallet selection invalidates account imports but an unchanged selection does not', async () => {
    const { service } = setup();
    const selectedWalletId = 'public-test-keyless-wallet';
    const before = service.getCloudAccountImportGeneration();
    const beforeSelection = service.getKeylessWalletSelectionGeneration();
    await service.setPersistedCurrentCloudSyncKeylessWalletId(selectedWalletId);
    const selected = service.getCloudAccountImportGeneration();
    const selectedWallet = service.getKeylessWalletSelectionGeneration();
    expect(selected).toBeGreaterThan(before);
    expect(selectedWallet).toBeGreaterThan(beforeSelection);
    await service.setPersistedCurrentCloudSyncKeylessWalletId(selectedWalletId);
    expect(service.getCloudAccountImportGeneration()).toBe(selected);
    expect(service.getKeylessWalletSelectionGeneration()).toBe(selectedWallet);
  });

  test('page cleanup cancels hardware operations without changing the selected wallet generation', async () => {
    const { service } = setup();
    const beforeImport = service.getCloudAccountImportGeneration();
    const beforeSelection = service.getKeylessWalletSelectionGeneration();

    await service.cancelHardwareCloudKeyOperation();

    expect(service.getCloudAccountImportGeneration()).toBeGreaterThan(
      beforeImport,
    );
    expect(service.getKeylessWalletSelectionGeneration()).toBe(beforeSelection);
  });

  test('turning sync off deletes the stored hardware key and its memory cache', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockStored = credential;
    service.setKeylessCloudSyncCredentialCache(credential);
    const revoking = Promise.withResolvers<void>();
    const finishRevocation = Promise.withResolvers<void>();
    jest
      .mocked(keylessSyncCredentialStorage.removeAllCredentials)
      .mockImplementationOnce(async () => {
        revoking.resolve();
        await finishRevocation.promise;
        mockStored = undefined;
      });
    await expect(service.isExplicitWalletMetadataSyncOff()).resolves.toBe(
      false,
    );
    const disable = service.setCloudSyncEnabledKeyless(false);
    try {
      await revoking.promise;
      expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
      expect(service.isKeylessSyncOffStateSettled()).toBe(false);
      await expect(service.isExplicitWalletMetadataSyncOff()).resolves.toBe(
        false,
      );
    } finally {
      finishRevocation.resolve();
      await disable;
    }
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
    expect(service.isKeylessSyncOffStateSettled()).toBe(true);
    expect(
      service.getKeylessCloudSyncCredentialCacheSync(source.credentialId),
    ).toBeUndefined();
    expect(
      keylessSyncCredentialStorage.removeAllCredentials,
    ).toHaveBeenCalled();
    expect(mockStored).toBeUndefined();
    // The source stays selected so the same wallet can sign again.
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(source);
    expect(mockConfig.currentCloudSyncKeylessWalletId).toBe(
      source.credentialId,
    );
    await expect(service.isExplicitWalletMetadataSyncOff()).resolves.toBe(true);
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
    expect(
      backgroundApi.servicePrimeCloudSync.invalidateOneKeyIdCloudSyncToggle,
    ).toHaveBeenCalledTimes(1);
    expect(mockStored).toBeUndefined();
    await service.enableHardwareCloudSync({ connectId });
    expect(generateHardwareCloudSyncCredentialWithSdk).toHaveBeenCalledTimes(1);
    expect(mockStored).toEqual(expect.objectContaining(credential));
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
    // Only full reconciliation may stamp even an empty successful run.
    expect(
      backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
    ).toHaveBeenCalledTimes(1);
    expect(
      backgroundApi.servicePrimeCloudSync.updateLastSyncTime,
    ).not.toHaveBeenCalled();
  });

  test.each(['deferred', 'empty', 'cancelled', 'rollback'] as const)(
    'same-source re-sign lets actual full reconciliation own its timestamp: %s',
    async (scenario) => {
      const { service, backgroundApi, initLocalSyncItemsDB } = setup();
      const resignedCredential: IKeylessCloudSyncCredential = {
        ...credential,
        pwdHash: `hw-dek-${'3'.repeat(64)}`,
        encryptionKey: '43'.repeat(32),
        signingPublicKey: '',
        signingPrivateKey: '',
      };
      jest.mocked(bootstrapHardwareCloudSyncDataKey).mockResolvedValueOnce({
        dek: resignedCredential.encryptionKey,
        dekId: 'synthetic-re-sign-dek',
        pwdHash: resignedCredential.pwdHash,
        generation: 4,
        previousPwdHashes: [],
      });
      jest
        .mocked(generateHardwareCloudSyncCredentialWithSdk)
        .mockImplementationOnce(
          withSignIn({ credential: resignedCredential, source }),
        );
      mockConfig = {
        ...mockConfig,
        hardwareCloudSyncKeySource: source,
        currentCloudSyncKeylessWalletId: source.credentialId,
        isCloudSyncEnabledKeyless: true,
        lastSyncTimeKeyless: 123,
      };
      // Current source needs a new hardware signature; there is no usable
      // older session to reuse.
      mockStored = undefined;

      const api = Object.assign(backgroundApi, {
        localDb,
        serviceKeylessCloudSync: service,
      });
      const prime = new ServicePrimeCloudSync({ backgroundApi: api });
      Object.assign(api, { servicePrimeCloudSync: prime });
      jest.spyOn(prime, 'isCloudSyncIsAvailable').mockResolvedValue(true);
      jest
        .spyOn(prime, 'ensureCloudSyncIsAvailable')
        .mockResolvedValue(undefined);
      jest.spyOn(prime, 'prepareLocalSyncWallets').mockResolvedValue(undefined);
      jest
        .spyOn(prime, 'resolvePasswordOnlyIfHdXfpMissing')
        .mockResolvedValue(undefined);
      jest.spyOn(prime, 'initLocalSyncItemsDB').mockImplementation(async () => {
        await initLocalSyncItemsDB();
        return {
          allWallets: [],
          allAccounts: [],
          allDevices: [],
          allIndexedAccounts: [],
        };
      });
      jest.spyOn(prime, 'getSyncCredentialSafe').mockImplementation(async () =>
        mockStored
          ? {
              masterPasswordUUID: '',
              primeAccountSalt: '',
              securityPasswordR1: '',
              keylessCredential: mockStored,
            }
          : undefined,
      );
      jest
        .spyOn(prime, 'publishPublicAccountSnapshotStatus')
        .mockResolvedValue(undefined);
      jest
        .spyOn(prime, 'fillingSyncItemsMissingDataFromRawData')
        .mockResolvedValue(undefined);
      const wallet: IDBWallet = {
        id: 'hd-synthetic-deferred-wallet',
        hash: 'synthetic-deferred-wallet-hash',
        name: 'Local visible name',
        type: 'hd',
        accounts: [],
        nextIds: {},
        backuped: true,
        walletNo: 1,
      };
      const walletTarget =
        await prime.syncManagers.wallet.buildSyncTargetByDBQuery({
          dbRecord: wallet,
        });
      const key = await prime.syncManagers.wallet.buildSyncKeyInfo({
        target: walletTarget,
      });
      if (!key) throw new OneKeyLocalError('Missing synthetic Wallet identity');
      const pending = {
        ...(await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
          key: key.key,
          dataTime: Date.now() - 1000,
          syncCredential: {
            masterPasswordUUID: '',
            primeAccountSalt: '',
            securityPasswordR1: '',
            keylessCredential: resignedCredential,
          },
          rawDataJson: {
            dataType: EPrimeCloudSyncDataType.Wallet,
            rawKey: key.rawKey,
            payload: { ...key.payload, name: 'Downloaded name' },
          },
        })),
        rawData: '',
        serverUploaded: true,
        localSceneUpdated: false,
      };
      const items = scenario === 'deferred' ? [pending] : [];
      jest
        .spyOn(prime, 'getAllLocalSyncItems')
        .mockImplementation(async () => ({
          items: items.map((item) => ({ ...item })),
        }));
      const scopedReads = [
        jest
          .spyOn(localDb, 'getAllAccounts')
          .mockResolvedValue({ accounts: [] }),
        jest.spyOn(localDb, 'getWalletBySyncPayload').mockResolvedValue(wallet),
        jest
          .spyOn(localDb, 'getRecordById')
          .mockRejectedValue(
            new DOMException(
              'Synthetic canonical Wallet read interrupted',
              'AbortError',
            ),
          ),
        jest
          .spyOn(localDb, 'getRecordsByIds')
          .mockResolvedValue({ records: items }),
      ];
      jest
        .spyOn(prime, 'syncPendingItemsToScene')
        .mockImplementation(
          async ({
            isCurrent,
            forceSync,
            onWalletNameHistoryDeferred,
          } = {}) => {
            const current = await prime.getSyncCredentialSafe();
            await prime.syncManagers.wallet.syncToScene({
              syncCredential: current,
              items: items.map((item) => ({ ...item })),
              isCurrent,
              forceSync,
              onWalletNameHistoryDeferred,
            });
          },
        );
      const check = jest
        .spyOn(prime, 'checkServerStatusWithRequestOptions')
        .mockImplementation(async () => {
          if (scenario === 'cancelled')
            await service.cancelHardwareCloudKeyOperation();
          return {
            diff: [],
            updated: [],
            obsoleted: [],
            deleted: [],
            pwdHash: resignedCredential.pwdHash,
            serverTime: Date.now(),
          };
        });
      const stamp = jest.spyOn(prime, 'updateLastSyncTime');
      try {
        if (scenario === 'rollback') {
          initLocalSyncItemsDB.mockRejectedValueOnce(
            new OneKeyLocalError('Synthetic prepared local write failed'),
          );
          await expect(
            service.enableHardwareCloudSync({ connectId }),
          ).rejects.toThrow('Synthetic prepared local write failed');
          expect(check).not.toHaveBeenCalled();
          expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
          expect(mockStored).toBeUndefined();
        } else {
          await service.enableHardwareCloudSync({ connectId });
          expect(check).toHaveBeenCalledTimes(1);
          expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
          expect(mockConfig.hardwareCloudSyncKeySource).toEqual(source);
          expect(mockStored).toEqual(
            expect.objectContaining({
              pwdHash: resignedCredential.pwdHash,
              source,
            }),
          );
        }
        if (scenario === 'empty') {
          expect(mockConfig.lastSyncTimeKeyless).toEqual(expect.any(Number));
          expect(mockConfig.lastSyncTimeKeyless).toBeGreaterThan(123);
          expect(stamp.mock.calls).toEqual([[]]);
        } else {
          expect(mockConfig.lastSyncTimeKeyless).toBeUndefined();
          expect(stamp).not.toHaveBeenCalled();
        }
        if (scenario === 'deferred') {
          expect(mockConfig.cloudSyncReconciliation).toMatchObject({
            status: 'complete',
            unfinished: false,
          });
          expect(scopedReads[2]).toHaveBeenCalled();
          expect(scopedReads[3]).toHaveBeenCalledWith(
            expect.objectContaining({ ids: [pending.id] }),
          );
        }
      } finally {
        for (const read of scopedReads) read.mockRestore();
      }
    },
  );

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

  test.each(['unlocked', 'before-own-clear', 'after-own-clear'] as const)(
    'forced re-sign keeps optional Wallet reads detached during %s lock transition',
    async (locking) => {
      const oldHash = `hw-dek-${'1'.repeat(64)}`;
      const newHash = `hw-dek-${'2'.repeat(64)}`;
      const { service, backgroundApi } = setup([
        {
          pwdHash: oldHash,
          dataType: EPrimeCloudSyncDataType.Wallet,
          rawKey: 'published-wallet-key',
          rawData: 'stale cache',
          data: 'settled-old-row',
          dataTime: 200,
          serverUploaded: true,
        },
      ]);
      const prime = backgroundApi.servicePrimeCloudSync;
      let primeGeneration = 10;
      prime.getPublicAccountSnapshotImportGeneration.mockImplementation(
        () => primeGeneration,
      );
      const realClear = prime.clearCachedSyncCredential.getMockImplementation();
      prime.clearCachedSyncCredential.mockImplementation(async (options) => {
        primeGeneration += 1;
        await realClear?.(options);
      });
      prime.cancelPublicAccountSnapshotImport.mockImplementation(async () => {
        primeGeneration += 1;
      });
      const startLock = () => {
        // lockApp's cache clear/cancellation happens before the lock atom.
        void prime.cancelPublicAccountSnapshotImport();
        void prime.clearCachedSyncCredential();
      };
      if (locking === 'before-own-clear') {
        jest
          .mocked(keylessSyncCredentialStorage.saveCredential)
          .mockImplementationOnce(async (next) => {
            mockStored = next;
            startLock();
          });
      }
      prime.initLocalSyncItemsDB.mockImplementationOnce(async () => {
        if (locking === 'after-own-clear') startLock();
        return undefined;
      });
      const recovery = await import('./hardwareCloudSyncRecovery');
      const blocked = Promise.withResolvers<void>();
      const recover = jest.mocked(recovery.recoverVerifiedWalletCaches);
      const realRecover = recover.getMockImplementation();
      recover.mockReturnValueOnce(blocked.promise);
      mockConfig.hardwareCloudSyncKeySource = source;
      mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
      mockConfig.isCloudSyncEnabledKeyless = true;
      mockStored = undefined;
      const record = {
        key: 'public-test-record-0',
        dataType: EPrimeCloudSyncDataType.Wallet,
        isDeleted: false,
        dataTimestamp: 300,
        data: 'verified-wallet-fixture',
      };
      jest
        .mocked(bootstrapHardwareCloudSyncDataKey)
        .mockImplementationOnce(async (options) => {
          options.onHistory?.({
            data: { data: { serverData: [record] } },
          } as Parameters<NonNullable<typeof options.onHistory>>[0]);
          return {
            dek: 'synthetic-dek',
            dekId: 'public-test-dek',
            pwdHash: newHash,
            generation: 2,
            previousPwdHashes: [oldHash],
          };
        });
      jest
        .mocked(generateHardwareCloudSyncCredentialWithSdk)
        .mockImplementationOnce(
          withSignIn({
            source,
            credential: {
              ...credential,
              pwdHash: newHash,
              signingPrivateKey: '',
              signingPublicKey: '',
            },
          }),
        );
      try {
        await expect(
          service.enableHardwareCloudSync({ connectId }),
        ).resolves.toBeUndefined();
        expect(mockStored).toEqual(
          expect.objectContaining({ pwdHash: newHash }),
        );
        if (locking !== 'unlocked') expect(recover).not.toHaveBeenCalled();
        else {
          expect(recover).toHaveBeenCalledWith(
            expect.objectContaining({
              history: expect.objectContaining({
                data: { data: { serverData: [record] } },
              }),
              previousPwdHashes: [oldHash],
            }),
          );
        }
        expect(
          backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
        ).toHaveBeenCalledTimes(1);
      } finally {
        blocked.resolve();
        recover.mockReset();
        if (realRecover) recover.mockImplementation(realRecover);
      }
    },
  );

  test('same-source re-signing recovers locally readable hardware records missing from server key history', async () => {
    const { service, backgroundApi } = setup([
      {
        pwdHash: 'hw-dek-unlisted-old-version',
        dataType: EPrimeCloudSyncDataType.Wallet,
        rawKey: 'public-test-wallet-key',
        rawData: JSON.stringify({
          rawKey: 'public-test-wallet-key',
          dataType: EPrimeCloudSyncDataType.Wallet,
          payload: { name: 'B edited after A' },
        }),
        dataTime: 200,
      },
    ]);
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockStored = undefined;
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementationOnce(
        withSignIn({
          credential: {
            ...credential,
            pwdHash: 'hw-dek-current',
            signingPrivateKey: '',
            signingPublicKey: '',
          },
          source,
        }),
      );
    const { items } =
      await backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems();
    const build = jest
      .spyOn(cloudSyncItemBuilder, 'buildSyncItemFromRawDataJson')
      .mockImplementationOnce(async () => ({
        ...items[0],
        data: 'public-test-current-ciphertext',
        pwdHash: 'hw-dek-current',
      }));
    const write = jest
      .spyOn(localDb, 'updateSyncItem')
      .mockImplementationOnce(async ({ updater }) => {
        await updater(items[0]);
      });
    try {
      await expect(
        service.enableHardwareCloudSync({ connectId }),
      ).resolves.toBeUndefined();
      expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
      expect(items[0]).toMatchObject({
        pwdHash: 'hw-dek-current',
        dataTime: 200,
        serverUploaded: false,
      });
      expect(
        backgroundApi.servicePrimeCloudSync.initLocalSyncItemsDB,
      ).toHaveBeenCalledWith(expect.objectContaining({ onlyAddMissing: true }));
      expect(
        backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
      ).toHaveBeenCalled();
    } finally {
      build.mockRestore();
      write.mockRestore();
    }
  });

  test.each([
    {
      label: 'a cached local edit',
      dataType: EPrimeCloudSyncDataType.Wallet,
      rawData: '{"unverified":"old edit"}',
      canRestore: true,
    },
    {
      label: 'a missing cache',
      dataType: EPrimeCloudSyncDataType.Wallet,
      rawData: '',
      canRestore: true,
    },
    {
      label: 'an Account',
      dataType: EPrimeCloudSyncDataType.Account,
      rawData: '',
      canRestore: false,
    },
  ])(
    'same-source re-sign retains an unlisted encrypted Wallet with $label',
    async ({ dataType, rawData, canRestore }) => {
      const rawKey = 'hd:__public-test-wallet-key:';
      const pending = {
        id: createHash('sha512').update(rawKey).digest('hex'),
        rawKey,
        rawData,
        pwdHash: `hw-dek-${'a'.repeat(64)}`,
        dataType,
        data: '0f'.repeat(80),
        dataTime: 200,
        localSceneUpdated: true,
        serverUploaded: false,
      };
      const { service, backgroundApi } = setup([pending]);
      mockConfig.hardwareCloudSyncKeySource = source;
      mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
      mockConfig.isCloudSyncEnabledKeyless = true;
      mockStored = undefined;
      const currentCredential = {
        ...credential,
        pwdHash: 'hw-dek-current',
        signingPrivateKey: '',
        signingPublicKey: '',
      };
      jest.mocked(bootstrapHardwareCloudSyncDataKey).mockResolvedValueOnce({
        dek: 'public-test-current-key',
        dekId: 'public-test-dek',
        pwdHash: currentCredential.pwdHash,
        generation: 4,
        previousPwdHashes: [],
      });
      jest
        .mocked(generateHardwareCloudSyncCredentialWithSdk)
        .mockImplementationOnce(
          withSignIn({ credential: currentCredential, source }),
        );
      const before = structuredClone(
        await backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems(),
      );
      if (canRestore) {
        await expect(
          service.enableHardwareCloudSync({ connectId }),
        ).resolves.toBeUndefined();
        expect(
          keylessSyncCredentialStorage.saveCredential,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            pwdHash: currentCredential.pwdHash,
            source,
          }),
        );
        expect(
          backgroundApi.servicePrimeCloudSync.initLocalSyncItemsDB,
        ).toHaveBeenCalledWith(
          expect.objectContaining({ onlyAddMissing: true }),
        );
        expect(
          backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
        ).toHaveBeenCalledWith(expect.objectContaining({ forceSync: true }));
      } else {
        await expect(
          service.enableHardwareCloudSync({ connectId }),
        ).rejects.toThrow("can't unlock your synced data");
        expect(
          keylessSyncCredentialStorage.saveCredential,
        ).not.toHaveBeenCalled();
        expect(
          backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
        ).not.toHaveBeenCalled();
      }
      expect(
        await backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems(),
      ).toEqual(before);
    },
  );

  test.each([true, false])(
    'an opaque historical hardware record reconnects only with known history=%s',
    async (knownHistory) => {
      const { service, backgroundApi } = setup([
        {
          pwdHash: 'hw-dek-old',
          data: 'public-test-downloaded-ciphertext',
          rawData: '',
          serverUploaded: true,
        },
      ]);
      mockConfig.hardwareCloudSyncKeySource = source;
      mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
      mockConfig.isCloudSyncEnabledKeyless = true;
      const currentCredential = {
        ...credential,
        pwdHash: 'hw-dek-current',
        signingPrivateKey: '',
        signingPublicKey: '',
      };
      jest.mocked(bootstrapHardwareCloudSyncDataKey).mockResolvedValueOnce({
        dek: 'public-test-current-key',
        dekId: 'public-test-dek',
        pwdHash: currentCredential.pwdHash,
        generation: 4,
        previousPwdHashes: knownHistory ? ['hw-dek-old'] : [],
      });
      jest
        .mocked(generateHardwareCloudSyncCredentialWithSdk)
        .mockImplementationOnce(
          withSignIn({ credential: currentCredential, source }),
        );
      const before = structuredClone(
        await backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems(),
      );
      if (knownHistory) {
        await service.enableHardwareCloudSync({ connectId });
        expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
        expect(
          backgroundApi.servicePrimeCloudSync.initLocalSyncItemsDB,
        ).toHaveBeenCalledWith(
          expect.objectContaining({ onlyAddMissing: true }),
        );
        expect(
          backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
        ).toHaveBeenCalled();
      } else {
        await expect(
          service.enableHardwareCloudSync({ connectId }),
        ).rejects.toMatchObject({
          reason: expect.stringContaining('Local hardware sync record'),
        });
        expect(
          keylessSyncCredentialStorage.saveCredential,
        ).not.toHaveBeenCalled();
      }
      expect(
        await backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems(),
      ).toEqual(before);
    },
  );

  test.each([EPrimeCloudSyncDataType.Wallet, EPrimeCloudSyncDataType.Account])(
    'same-source restore skips a settled opaque %s under a different key',
    async (dataType) => {
      const { service, backgroundApi } = setup([
        {
          pwdHash: 'legacy-keyless',
          dataType,
          data: 'public-test-opaque-ciphertext',
          rawData: '',
          serverUploaded: true,
        },
      ]);
      mockConfig.hardwareCloudSyncKeySource = source;
      mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
      mockConfig.isCloudSyncEnabledKeyless = true;
      const currentCredential = {
        ...credential,
        pwdHash: 'hw-dek-current',
        signingPrivateKey: '',
        signingPublicKey: '',
      };
      jest.mocked(bootstrapHardwareCloudSyncDataKey).mockResolvedValueOnce({
        dek: 'public-test-current-key',
        dekId: 'public-test-dek',
        pwdHash: currentCredential.pwdHash,
        generation: 4,
        previousPwdHashes: [],
      });
      jest
        .mocked(generateHardwareCloudSyncCredentialWithSdk)
        .mockImplementationOnce(
          withSignIn({ credential: currentCredential, source }),
        );
      const before = structuredClone(
        await backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems(),
      );

      await service.enableHardwareCloudSync({ connectId });
      expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
      expect(
        backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
      ).toHaveBeenCalled();
      expect(
        await backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems(),
      ).toEqual(before);
    },
  );

  test.each([
    ['unreadable cache', true, false, true, true, undefined, true],
    ['settled tombstone', false, true, true, true, undefined, true],
    ['unapplied tombstone', false, true, false, true, undefined, false],
    ['unsent tombstone', false, true, true, false, undefined, false],
    ['pending removal', true, true, true, true, 200, false],
  ] as const)(
    'same-source restore preserves %s without treating it as a new upload',
    async (
      _scenario,
      knownHistory,
      isDeleted,
      localSceneUpdated,
      serverUploaded,
      pendingPublicAccountDeletionAt,
      canRestore,
    ) => {
      const { service, backgroundApi } = setup([
        {
          dataType: EPrimeCloudSyncDataType.Account,
          pwdHash: 'hw-dek-old',
          data: 'public-test-old-ciphertext',
          rawData: '{unreadable-cache',
          isDeleted,
          localSceneUpdated,
          serverUploaded,
          pendingPublicAccountDeletionAt,
        },
      ]);
      mockConfig.hardwareCloudSyncKeySource = source;
      mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
      mockConfig.isCloudSyncEnabledKeyless = true;
      jest.mocked(bootstrapHardwareCloudSyncDataKey).mockResolvedValueOnce({
        dek: 'public-test-current-key',
        dekId: 'public-test-dek',
        pwdHash: 'hw-dek-current',
        generation: 4,
        previousPwdHashes: knownHistory ? ['hw-dek-old'] : [],
      });
      jest
        .mocked(generateHardwareCloudSyncCredentialWithSdk)
        .mockImplementationOnce(
          withSignIn({
            credential: {
              ...credential,
              pwdHash: 'hw-dek-current',
              signingPrivateKey: '',
              signingPublicKey: '',
            },
            source,
          }),
        );
      const { items } =
        await backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems();
      const before = structuredClone(items);
      const write = jest.spyOn(localDb, 'updateSyncItem');
      try {
        const restore = service.enableHardwareCloudSync({ connectId });
        if (canRestore) {
          await expect(restore).resolves.toBeUndefined();
          expect(
            backgroundApi.servicePrimeCloudSync.initLocalSyncItemsDB,
          ).toHaveBeenCalledWith(
            expect.objectContaining({ onlyAddMissing: true }),
          );
          expect(
            backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
          ).toHaveBeenCalledTimes(1);
        } else {
          await expect(restore).rejects.toThrow();
          expect(
            keylessSyncCredentialStorage.saveCredential,
          ).not.toHaveBeenCalled();
          expect(
            backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
          ).not.toHaveBeenCalled();
        }
        expect(items).toEqual(before);
        expect(write).not.toHaveBeenCalled();
      } finally {
        write.mockRestore();
      }
    },
  );

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
          backgroundApi.servicePrimeCloudSync.updateLastSyncTime,
        ).not.toHaveBeenCalled();
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
      skipWalletPreparation: true,
      password: 'public-test-password',
      syncCredential: expect.objectContaining({
        keylessCredential,
      }),
    });
  });

  test('prepare rejects a same-identity data-key rotation during wallet preparation', async () => {
    const { service, backgroundApi, initLocalSyncItemsDB } =
      setupKeylessPrepare();
    const selected = { ...keylessCredential, signingPublicKey: '' };
    const getCredential = jest
      .spyOn(service, 'getKeylessCloudSyncCredential')
      .mockImplementation(async () => selected);
    backgroundApi.servicePrimeCloudSync.prepareLocalSyncWallets.mockImplementation(
      async () => {
        // A same-source rotation keeps its signing identity but changes its DEK.
        getCredential.mockResolvedValue({
          ...selected,
          pwdHash: 'rotated-hash',
          encryptionKey: 'rotated-data-key',
        });
      },
    );
    await expect(
      service.prepareCloudSyncKeyless({ silentEnable: true }),
    ).rejects.toThrow('The encryption method for Cloud sync changed');
    expect(initLocalSyncItemsDB).not.toHaveBeenCalled();
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
  const activeCredential: IKeylessCloudSyncCredential = {
    ...credential,
    hardwareSession: {
      deviceKeyJwk: {
        kty: 'EC',
        crv: 'P-256',
        x: 'public-test-x',
        y: 'public-test-y',
        d: 'public-test-d',
      },
      accessToken: 'public-test-access',
      accessTokenExpiresAt: Number.MAX_SAFE_INTEGER,
      refreshToken: 'public-test-refresh',
      sessionId: 'public-test-session',
      dekId: 'public-test-dek',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = {
      isCloudSyncEnabled: false,
      isCloudSyncEnabledKeyless: true,
      hardwareCloudSyncKeySource: source,
      currentCloudSyncKeylessWalletId: source.credentialId,
    };
    mockStored = activeCredential;
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementation(withSignIn({ credential: activeCredential, source }));
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
    expect(mockStored).toBe(activeCredential);
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

  test('reports a selected API node mismatch without touching the hardware credential and clears it on switch back', async () => {
    const { service, getClient } = setup();
    const session = activeCredential.hardwareSession;
    if (!session) throw new OneKeyLocalError('Missing fixture session');
    const oldEndpoint = 'https://prime.onekeycn.com';
    const old = {
      ...activeCredential,
      hardwareSession: {
        ...session,
        boundBaseURL: oldEndpoint,
      },
    };
    mockStored = old;
    const request = jest.fn();
    getClient.mockResolvedValue({
      defaults: { baseURL: 'https://prime.onekeytest.com' },
      request,
    } as unknown as AxiosInstance);
    await expect(
      service.getSelectedHardwareCloudKeyAvailability(),
    ).resolves.toBe('endpoint-mismatch');
    await expect(service.isSelectedHardwareCloudKeyMissing()).resolves.toBe(
      false,
    );
    getClient.mockResolvedValue({
      defaults: { baseURL: oldEndpoint },
      request,
    } as unknown as AxiosInstance);
    await expect(
      service.getSelectedHardwareCloudKeyAvailability(),
    ).resolves.toBe('available');
    expect(mockStored).toBe(old);
    expect(request).not.toHaveBeenCalled();
    expect(
      keylessSyncCredentialStorage.removeAllCredentials,
    ).not.toHaveBeenCalled();
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
  });

  test('a pending availability read cannot report for a superseded selection', async () => {
    const { service, getClient } = setup();
    const session = activeCredential.hardwareSession;
    if (!session) throw new OneKeyLocalError('Missing fixture session');
    mockStored = {
      ...activeCredential,
      hardwareSession: {
        ...session,
        boundBaseURL: 'https://prime.onekeycn.com',
      },
    };
    getClient.mockImplementationOnce(async () => {
      mockConfig.hardwareCloudSyncKeySource = undefined;
      return {
        defaults: { baseURL: 'https://prime.onekeytest.com' },
      } as AxiosInstance;
    });
    await expect(
      service.getSelectedHardwareCloudKeyAvailability(),
    ).resolves.toBe('selection-changed');
    expect(
      keylessSyncCredentialStorage.removeAllCredentials,
    ).not.toHaveBeenCalled();
  });

  test.each([
    undefined,
    'invalid origin',
    'https://u:p@prime.onekeycn.com',
    12 as unknown as string,
  ])(
    'leaves old or malformed bindings in the existing recovery state (%s)',
    async (boundBaseURL) => {
      const { service, getClient } = setup();
      const session = activeCredential.hardwareSession;
      if (!session) throw new OneKeyLocalError('Missing fixture session');
      mockStored = {
        ...activeCredential,
        hardwareSession: { ...session, boundBaseURL },
      };
      await expect(
        service.getSelectedHardwareCloudKeyAvailability(),
      ).resolves.toBe('available');
      expect(getClient).not.toHaveBeenCalled();
      mockStored = credential;
      await expect(
        service.getSelectedHardwareCloudKeyAvailability(),
      ).resolves.toBe('missing');
    },
  );

  test('a legacy credential without a session offers reconnect without deleting its key', async () => {
    const { service } = setup();
    mockStored = credential;
    await expect(service.isSelectedHardwareCloudKeyMissing()).resolves.toBe(
      true,
    );
    expect(mockStored).toBe(credential);
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(source);
    expect(
      keylessSyncCredentialStorage.removeAllCredentials,
    ).not.toHaveBeenCalled();
  });

  test('the selected legacy key can sign in again while sync remains enabled', async () => {
    const { service } = setup([{ pwdHash: credential.pwdHash }]);
    mockStored = credential;
    await service.enableHardwareCloudSync({ connectId });
    expect(generateHardwareCloudSyncCredentialWithSdk).toHaveBeenCalledWith(
      expect.objectContaining({ expectedCredentialId: source.credentialId }),
    );
    expect(mockStored).toEqual(expect.objectContaining(activeCredential));
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(source);
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
    expect(
      keylessSyncCredentialStorage.removeAllCredentials,
    ).not.toHaveBeenCalled();
  });

  test('a failed legacy sign-in preserves the existing key and sync selection', async () => {
    const { service } = setup([{ pwdHash: credential.pwdHash }]);
    mockStored = credential;
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockRejectedValueOnce(new Error('Synthetic device cancellation'));
    await expect(
      service.enableHardwareCloudSync({ connectId }),
    ).rejects.toThrow('Synthetic device cancellation');
    expect(mockStored).toBe(credential);
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(source);
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
    expect(
      keylessSyncCredentialStorage.removeAllCredentials,
    ).not.toHaveBeenCalled();
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
    expect(
      backgroundApi.servicePrimeCloudSync.startServerSyncFlowSilently,
    ).toHaveBeenCalledWith(expect.objectContaining({ forceSync: true }));
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
    const preDisableGeneration = service.getHardwareUploadGeneration();
    const refreshing = service['getFreshHardwareCredential'](stale);
    const observedRefresh = refreshing.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    await entered;
    const disabling = service.setCloudSyncEnabledKeyless(false);
    // Let the disable flow reach its wait before the server answers refresh.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(service.getHardwareUploadGeneration()).toBeUndefined();
    const postData = { pwdHash: stale.pwdHash, localData: [], nonce: 0 };
    const prepareWalletRetry = jest.fn(async () => undefined);
    await expect(
      service.apiUploadItemsKeyless({
        postData,
        urlPath: '/prime/v1/sync/upload',
        prepareWalletRetry,
      }),
    ).rejects.toThrow('Hardware Cloud upload cancelled');
    // Check the standard direct-admission path independently of the caller's
    // generation check, while the original credential is still present.
    await expect(
      service.apiUploadItemsKeyless({
        postData,
        urlPath: '/prime/v1/sync/upload',
        canUploadHardware: () => true,
      }),
    ).rejects.toThrow('Hardware Cloud upload cancelled');
    expect(prepareWalletRetry).not.toHaveBeenCalled();
    expect(
      sessionApi.requestRawWithHardwareCloudSyncSession,
    ).not.toHaveBeenCalled();
    const blockedRefresh = service['getFreshHardwareCredential'](stale).then(
      () => undefined,
      (error: unknown) => error,
    );
    finishRefresh();
    await disabling;
    expect(service.getHardwareUploadGeneration()).not.toBe(
      preDisableGeneration,
    );
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

  test.each(['ending-session', 'caller-abort'] as const)(
    'cancels a protected request already admitted into the real Axios pipeline: %s',
    async (scenario) => {
      const { service, getClient } = setup();
      mockStored = current;
      const caller = new AbortController();
      const adapter = jest.fn();
      const client = axios.create({
        baseURL: 'https://prime.example.invalid',
        adapter,
      });
      let enterInterceptor = () => {};
      const entered = new Promise<void>((resolve) => {
        enterInterceptor = resolve;
      });
      let resumeInterceptor = () => {};
      const paused = new Promise<void>((resolve) => {
        resumeInterceptor = resolve;
      });
      let transportSignal: { readonly aborted: boolean } | undefined;
      client.interceptors.request.use(async (config) => {
        transportSignal = config.signal;
        enterInterceptor();
        await paused;
        return config;
      });
      getClient.mockResolvedValue(client);
      const selected = jest
        .spyOn(service, 'getLocalMutationSyncCredential')
        .mockResolvedValueOnce({
          primeAccountSalt: '',
          masterPasswordUUID: '',
          securityPasswordR1: '',
          keylessCredential: current,
        });
      jest
        .mocked(sessionApi.requestRawWithHardwareCloudSyncSession)
        .mockImplementationOnce(
          async ({ client: requestClient, urlPath, data, requestOptions }) =>
            requestClient.post(urlPath, data, requestOptions),
        );
      const request = service.apiUploadItemsKeyless({
        postData: { pwdHash: current.pwdHash, localData: [], nonce: 0 },
        urlPath: '/prime/v1/sync/upload',
        requestOptions: { signal: caller.signal, timeout: 1000 },
        prepareWalletRetry: async () => undefined,
      });
      const settlement = request.then(
        () => undefined,
        (error: unknown) => error,
      );
      await entered;
      if (scenario === 'caller-abort') caller.abort();
      else await service.setCloudSyncEnabledKeyless(false);
      expect(transportSignal?.aborted).toBe(true);
      resumeInterceptor();
      expect(await settlement).toMatchObject(
        scenario === 'caller-abort'
          ? { message: 'Hardware Cloud upload cancelled' }
          : { code: 'ERR_CANCELED' },
      );
      expect(adapter).not.toHaveBeenCalled();
      expect(service['hardwareUploadAbortControllers'].size).toBe(0);
      selected.mockRestore();
    },
  );

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

  test.each([
    'verified',
    'no-final-url',
    'wrong-final-url',
    'newer-stored-pair',
    'new-selected-source',
    'revoked',
  ] as const)(
    'only retains the original node rotation with verified current storage: %s',
    async (scenario) => {
      const { service, getClient } = setup();
      const actual = jest.requireActual<
        typeof import('./hardwareCloudSyncSession')
      >('./hardwareCloudSyncSession');
      const A = 'https://prime.example.invalid';
      const B = 'https://alternate-prime.example.invalid';
      const refreshPath = '/prime/v1/hw-sync/auth/refresh';
      const stale = {
        ...current,
        hardwareSession: {
          ...session,
          accessTokenExpiresAt: 0,
          deviceKeyJwk: actual.createHardwareCloudSyncDeviceKey(),
          boundBaseURL: A,
          boundBaseURLVerified: true,
        },
      };
      mockStored = stale;
      const other = {
        ...stale,
        hardwareSession: {
          ...stale.hardwareSession,
          accessToken: 'public-other-access',
          refreshToken: 'public-other-refresh',
        },
      };
      const otherSource = {
        ...source,
        credentialId: `hardware-cloud-v1-${'b'.repeat(64)}`,
      };
      const replacement = {
        ...other,
        source: otherSource,
        keylessWalletId: otherSource.credentialId,
        hardwareSession: { ...other.hardwareSession, boundBaseURL: B },
      };
      const sent = Promise.withResolvers<void>();
      const returnResponse = Promise.withResolvers<void>();
      const postB = jest.fn();
      const alternate = axios.create({ baseURL: B, adapter: postB });
      const endpointA = axios.create({
        baseURL: A,
        adapter: async (config) => {
          expect(config.baseURL).toBe(A);
          expect(config.url).toBe(refreshPath);
          const rawData: unknown = config.data;
          expect(rawData).toBe(
            JSON.stringify({ refreshToken: session.refreshToken }),
          );
          sent.resolve();
          await returnResponse.promise;
          let finalURL: string | undefined;
          if (scenario !== 'no-final-url')
            finalURL = `${scenario === 'wrong-final-url' ? B : A}${refreshPath}`;
          return {
            config,
            data: {
              data: {
                sessionId: session.sessionId,
                accessToken: 'public-rotated-access',
                refreshToken: 'public-rotated-refresh',
                accessTokenExpiresIn: 300,
              },
            },
            status: 200,
            statusText: 'OK',
            headers: {},
            request: { oneKeyVerifiedFinalUrl: finalURL },
          };
        },
      });
      getClient.mockResolvedValue(endpointA);
      jest
        .spyOn(systemTimeUtils, 'ensureFreshServerTime')
        .mockResolvedValue(true);
      const refresh = jest.mocked(
        sessionApi.refreshHardwareCloudSyncSessionIfNeeded,
      );
      refresh.mockImplementation(
        actual.refreshHardwareCloudSyncSessionIfNeeded,
      );
      const save = jest.spyOn(keylessSyncCredentialStorage, 'saveCredential');
      const work = service['getFreshHardwareCredential'](stale, {
        force: true,
      });
      try {
        await sent.promise;
        getClient.mockResolvedValue(alternate);
        if (scenario === 'newer-stored-pair') {
          // Model the admitted write from the locally active replacement.
          await service['saveHardwareCredential'](other, {
            expected: stale,
            refreshedSession: true,
          });
          save.mockClear();
        } else if (scenario === 'new-selected-source') {
          // Another physical key finished selection and owns the single slot.
          mockConfig.hardwareCloudSyncKeySource = otherSource;
          mockStored = replacement;
        } else if (scenario === 'revoked') {
          await expect(
            service['requireHardwareCloudSyncSignIn'](stale),
          ).rejects.toThrow('Reconnect your hardware wallet');
        }
      } finally {
        returnResponse.resolve();
      }
      await expect(work).rejects.toThrow(
        scenario === 'wrong-final-url'
          ? 'endpoint changed'
          : 'settings changed',
      );
      expect(postB).not.toHaveBeenCalled();
      expect(
        service.getKeylessCloudSyncCredentialCacheSync(stale.keylessWalletId),
      ).toEqual(scenario === 'newer-stored-pair' ? other : undefined);

      if (scenario === 'verified') {
        expect(save).toHaveBeenCalledTimes(1);
        const durable = mockStored;
        expect(durable?.hardwareSession).toMatchObject({
          accessToken: 'public-rotated-access',
          refreshToken: 'public-rotated-refresh',
          boundBaseURL: A,
          boundBaseURLVerified: true,
        });
        if (!durable)
          throw new OneKeyLocalError('Missing retained test rotation');
        const cold = setup();
        cold.getClient.mockResolvedValue(alternate);
        await expect(
          cold.service['getFreshHardwareCredential'](durable, { force: true }),
        ).rejects.toThrow('settings changed');
        expect(postB).not.toHaveBeenCalled();
        expect(refresh).toHaveBeenCalledTimes(1);
        cold.getClient.mockResolvedValue(endpointA);
        await expect(
          cold.service['getFreshHardwareCredential'](durable),
        ).resolves.toEqual(durable);
      } else {
        expect(save).not.toHaveBeenCalled();
        let expected: IKeylessCloudSyncCredential | undefined = stale;
        if (scenario === 'newer-stored-pair') expected = other;
        if (scenario === 'new-selected-source') expected = replacement;
        if (scenario === 'revoked') expected = undefined;
        expect(mockStored).toEqual(expected);
      }
    },
  );

  test.each([
    'tokens-only',
    'different-session',
    'endpoint-changed-before-save',
    'endpoint-changed-during-save',
    'endpoint-changed-during-save-no-marker',
    'no-final-marker',
    'revoke-after-refresh',
    'cancel-after-refresh',
  ] as const)(
    'ordinary queued hardware Wallet upload keeps only its exact refreshed scope: %s',
    async (scenario) => {
      const { service, backgroundApi, getClient } = setup();
      const prime = new ServicePrimeCloudSync({
        backgroundApi: { serviceKeylessCloudSync: service },
      });
      Object.assign(backgroundApi, { servicePrimeCloudSync: prime });
      jest
        .spyOn(prime, 'getActiveSyncMode')
        .mockResolvedValue(ECloudSyncMode.Keyless);
      jest.spyOn(prime, 'getCloudSyncDataTime').mockResolvedValue(777);
      const updateLastSyncTime = jest
        .spyOn(prime, 'updateLastSyncTime')
        .mockResolvedValue(undefined);
      const clear = jest.spyOn(prime, 'clearCachedSyncCredential');
      const tokenMemo = jest.spyOn(prime, 'invalidateSyncCredentialMemo');
      jest
        .spyOn(prime.syncManagers.wallet, 'canUploadPendingWalletName')
        .mockResolvedValue(true);
      const stale = {
        ...current,
        pwdHash: 'hw-dek-public-fixture-refresh',
        hardwareSession: { ...session, accessTokenExpiresAt: 0 },
      };
      mockStored = stale;
      const selected = {
        primeAccountSalt: '',
        masterPasswordUUID: '',
        securityPasswordR1: '',
        keylessCredential: stale,
      };
      jest.spyOn(prime, 'getSyncCredentialSafe').mockResolvedValue(selected);
      jest
        .spyOn(service, 'getLocalMutationSyncCredential')
        .mockResolvedValue(selected);
      const refreshed = {
        ...session,
        accessToken: 'public-fixture-fresh-token',
        refreshToken: 'public-fixture-next-refresh',
        boundBaseURL: 'https://prime.example.invalid',
        boundBaseURLVerified:
          scenario !== 'no-final-marker' &&
          scenario !== 'endpoint-changed-during-save-no-marker',
        sessionId:
          scenario === 'different-session'
            ? 'different-fixture-session'
            : session.sessionId,
      };
      const refresh = jest
        .mocked(sessionApi.refreshHardwareCloudSyncSessionIfNeeded)
        .mockResolvedValueOnce(refreshed);
      const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => ({
        config,
        data: { data: { nonce: 1, created: 1, updated: 0 } },
        status: 200,
        statusText: 'OK',
        headers: {},
      }));
      const client = axios.create({
        baseURL: 'https://prime.example.invalid',
        adapter,
      });
      let enterMiddleware = () => {};
      const entered = new Promise<void>((resolve) => {
        enterMiddleware = resolve;
      });
      let unpause = () => {};
      const paused = new Promise<void>((resolve) => {
        unpause = resolve;
      });
      if (
        scenario === 'revoke-after-refresh' ||
        scenario === 'cancel-after-refresh'
      ) {
        client.interceptors.request.use(async (config) => {
          enterMiddleware();
          await paused;
          return config;
        });
      }
      const alternateAdapter = jest.fn();
      const alternateClient = axios.create({
        baseURL: 'https://alternate-prime.example.invalid',
        adapter: alternateAdapter,
      });
      if (scenario === 'endpoint-changed-before-save') {
        refresh.mockReset().mockImplementationOnce(async () => {
          getClient.mockResolvedValue(alternateClient);
          return refreshed;
        });
      } else if (
        scenario === 'endpoint-changed-during-save' ||
        scenario === 'endpoint-changed-during-save-no-marker'
      ) {
        jest
          .mocked(keylessSyncCredentialStorage.saveCredential)
          .mockImplementationOnce(async (updated) => {
            mockStored = JSON.parse(
              JSON.stringify(updated),
            ) as IKeylessCloudSyncCredential;
            getClient.mockResolvedValue(alternateClient);
          });
      }
      getClient.mockResolvedValue(client);
      const send = jest
        .mocked(sessionApi.requestRawWithHardwareCloudSyncSession)
        .mockImplementationOnce(
          async ({ client: requestClient, urlPath, data, requestOptions }) =>
            requestClient.post(urlPath, data, requestOptions),
        );
      const wallet: IDBCloudSyncItem = {
        ...unknownItem,
        dataType: EPrimeCloudSyncDataType.Wallet,
        pwdHash: stale.pwdHash,
      };
      const generation = prime.getPublicAccountSnapshotImportGeneration();
      const request = prime._callApiUploadItemsDebounceMerge({
        localItems: [wallet],
        pwdHash: stale.pwdHash,
        noDebounceUpload: true,
      });
      if (
        scenario === 'revoke-after-refresh' ||
        scenario === 'cancel-after-refresh'
      ) {
        await entered;
        if (scenario === 'revoke-after-refresh') {
          await expect(
            service['requireHardwareCloudSyncSignIn'](stale),
          ).rejects.toThrow('Reconnect your hardware wallet');
        } else {
          await prime.cancelPublicAccountSnapshotImport();
        }
        unpause();
      }
      if (
        scenario === 'endpoint-changed-before-save' ||
        scenario === 'endpoint-changed-during-save' ||
        scenario === 'endpoint-changed-during-save-no-marker'
      ) {
        await expect(request).rejects.toThrow('settings changed');
        expect(refresh).toHaveBeenCalledWith(
          expect.objectContaining({ boundBaseURL: client.defaults.baseURL }),
        );
        expect(send).not.toHaveBeenCalled();
        expect(adapter).not.toHaveBeenCalled();
        expect(alternateAdapter).not.toHaveBeenCalled();
        expect(tokenMemo).not.toHaveBeenCalled();
        expect(updateLastSyncTime).not.toHaveBeenCalled();
        expect(
          service.getKeylessCloudSyncCredentialCacheSync(
            current.keylessWalletId,
          ),
        ).toBeUndefined();
        expect(prime.uploadItemsToMerge).toEqual([wallet]);
        expect(mockStored?.hardwareSession).toEqual(refreshed);
        const durable = mockStored;
        if (!durable)
          throw new OneKeyLocalError('Missing durable refresh fixture');
        const cold = setup();
        const coldPrime = new ServicePrimeCloudSync({
          backgroundApi: { serviceKeylessCloudSync: cold.service },
        });
        Object.assign(cold.backgroundApi, {
          servicePrimeCloudSync: coldPrime,
        });
        cold.getClient.mockResolvedValue(alternateClient);
        jest.spyOn(coldPrime, 'getSyncCredentialSafe').mockResolvedValue({
          ...selected,
          keylessCredential: durable,
        });
        await expect(
          cold.service['getFreshHardwareCredential'](durable, {
            force: true,
          }),
        ).rejects.toThrow('settings changed');
        await expect(
          cold.service.apiUploadItemsKeyless({
            postData: { pwdHash: stale.pwdHash, localData: [], nonce: 0 },
            urlPath: '/prime/v1/sync/upload',
            canUploadHardware: () => true,
          }),
        ).rejects.toThrow('settings changed');
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(send).not.toHaveBeenCalled();
        expect(alternateAdapter).not.toHaveBeenCalled();
        return;
      }
      await request;
      expect(refresh).toHaveBeenCalledTimes(1);
      if (scenario === 'no-final-marker') {
        expect(clear).toHaveBeenCalledTimes(1);
        expect(send).not.toHaveBeenCalled();
        expect(adapter).not.toHaveBeenCalled();
        expect(updateLastSyncTime).not.toHaveBeenCalled();
        expect(mockStored?.hardwareSession).toEqual(refreshed);
        expect(
          service.getKeylessCloudSyncCredentialCacheSync(
            current.keylessWalletId,
          ),
        ).toBeUndefined();
        const durable = mockStored;
        if (!durable)
          throw new OneKeyLocalError('Missing retained renewal fixture');
        const cold = setup();
        const coldPrime = new ServicePrimeCloudSync({
          backgroundApi: { serviceKeylessCloudSync: cold.service },
        });
        Object.assign(cold.backgroundApi, { servicePrimeCloudSync: coldPrime });
        cold.getClient.mockResolvedValue(client);
        jest.spyOn(coldPrime, 'getSyncCredentialSafe').mockResolvedValue({
          ...selected,
          keylessCredential: durable,
        });
        await expect(
          cold.service.apiUploadItemsKeyless({
            postData: { pwdHash: stale.pwdHash, localData: [], nonce: 0 },
            urlPath: '/prime/v1/sync/upload',
          }),
        ).resolves.toEqual({ nonce: 1, created: 1, updated: 0 });
        expect(adapter).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledWith(
          expect.objectContaining({
            session: refreshed,
            boundBaseURL: client.defaults.baseURL,
          }),
        );
        return;
      }
      expect(send).toHaveBeenCalledTimes(
        scenario === 'different-session' ? 0 : 1,
      );
      if (scenario === 'tokens-only') {
        expect(clear).not.toHaveBeenCalled();
        expect(tokenMemo).toHaveBeenCalledTimes(1);
        expect(prime.getPublicAccountSnapshotImportGeneration()).toBe(
          generation,
        );
        expect(mockStored?.hardwareSession).toEqual(refreshed);
        expect(
          service.getKeylessCloudSyncCredentialCacheSync(
            current.keylessWalletId,
          )?.hardwareSession,
        ).toEqual(refreshed);
        expect(send).toHaveBeenCalledWith(
          expect.objectContaining({
            session: refreshed,
            boundBaseURL: client.defaults.baseURL,
          }),
        );
        expect(adapter).toHaveBeenCalledTimes(1);
        expect(updateLastSyncTime).toHaveBeenCalledTimes(1);
      } else {
        expect(
          prime.getPublicAccountSnapshotImportGeneration(),
        ).toBeGreaterThan(generation);
        expect(adapter).not.toHaveBeenCalled();
        expect(updateLastSyncTime).not.toHaveBeenCalled();
        if (scenario === 'revoke-after-refresh')
          expect(mockStored).toBeUndefined();
      }
    },
  );

  test.each(['response', 'secure-save'] as const)(
    'the actual App lock never repopulates hardware credential memory from a late refresh: %s',
    async (phase) => {
      const { service, backgroundApi } = setup();
      const prime = new ServicePrimeCloudSync({
        backgroundApi: { serviceKeylessCloudSync: service },
      });
      Object.assign(backgroundApi, { servicePrimeCloudSync: prime });
      const password = new ServicePassword({
        backgroundApi: {
          serviceKeylessCloudSync: service,
          servicePrimeCloudSync: prime,
        },
      });
      jest.spyOn(password, 'clearCachedPrfMasterKey').mockResolvedValue();
      jest
        .spyOn(password, 'refreshHyperLiquidAgentPasswordStatus')
        .mockResolvedValue({
          isPasswordSet: false,
          requiresPasswordSetupOrVerify: true,
        });
      service.setKeylessCloudSyncCredentialCache(current);
      const invalidate = jest.spyOn(prime, 'invalidateSyncCredentialMemo');
      let reached = () => {};
      const entered = new Promise<void>((resolve) => {
        reached = resolve;
      });
      let resume = () => {};
      const release = new Promise<void>((resolve) => {
        resume = resolve;
      });
      const fresh = { ...session, refreshToken: 'public-fixture-new-token' };
      const refresh = jest.mocked(
        sessionApi.refreshHardwareCloudSyncSessionIfNeeded,
      );
      const secureSave = jest.mocked(
        keylessSyncCredentialStorage.saveCredential,
      );
      if (phase === 'response') {
        refresh.mockImplementationOnce(async () => {
          reached();
          await release;
          return fresh;
        });
      } else {
        refresh.mockResolvedValueOnce(fresh);
        secureSave.mockImplementationOnce(async (updated) => {
          reached();
          await release;
          mockStored = updated;
        });
      }
      const refreshing = service['getFreshHardwareCredential'](current, {
        force: true,
      }).then(
        () => undefined,
        (error: unknown) => error,
      );
      await entered;
      await password.clearCachedPassword();
      expect(
        service.getKeylessCloudSyncCredentialCacheSync(current.keylessWalletId),
      ).toBeUndefined();
      expect(invalidate).toHaveBeenCalledTimes(1);
      resume();
      expect(await refreshing).toMatchObject({
        message: expect.stringContaining('settings changed'),
      });
      expect(
        service.getKeylessCloudSyncCredentialCacheSync(current.keylessWalletId),
      ).toBeUndefined();
      expect(invalidate).toHaveBeenCalledTimes(1);
      expect(secureSave).toHaveBeenCalledTimes(phase === 'response' ? 0 : 1);
      expect(mockStored?.hardwareSession).toEqual(
        phase === 'response' ? session : fresh,
      );
    },
  );

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

  test.each([
    'success',
    'missing proof',
    'pool failure',
    'no-marker pool failure',
    'secure failure',
    'node changed',
    'nonce refused',
    'nonce refused after node change',
    'nonce refused during cleanup',
  ] as const)(
    'an already authorized own reset commits the pool before key activation: %s',
    async (failure) => {
      const origin = 'https://prime.example.invalid';
      const poolFailure =
        failure === 'pool failure' || failure === 'no-marker pool failure';
      const noMarker =
        failure === 'missing proof' || failure === 'no-marker pool failure';
      const nonceError = Object.assign(new Error('Refused nonce'), {
        code: 90_705,
      });
      const actualSession = jest.requireActual<
        typeof import('./hardwareCloudSyncSession')
      >('./hardwareCloudSyncSession');
      const original = {
        ...current,
        hardwareSession: {
          ...session,
          dekId: '12'.repeat(16),
          boundBaseURL: origin,
          deviceKeyJwk: actualSession.createHardwareCloudSyncDeviceKey(),
        },
      };
      const recoveryKey = { ...next, dekId: 'ab'.repeat(16) };
      const pending = { ...recoveryKey, generation: 2 };
      const { service, getClient, backgroundApi } = setup();
      let record = { ...unknownItem };
      const realmNullableTime = failure === 'no-marker pool failure';
      if (realmNullableTime) Object.assign(record, { dataTime: null });
      const readPool = async () => ({
        items: [{ ...record, dataTime: record.dataTime ?? undefined }],
      });
      backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems.mockImplementation(
        readPool,
      );
      const mockRekey = jest.mocked(sessionApi.reencryptHardwareCloudSyncItems);
      const rekey: Parameters<
        typeof mockRekey.mockImplementationOnce
      >[0] = async ({ items, from, to }) =>
        items
          .filter((item) => item.pwdHash === from.pwdHash)
          .map((item) => ({
            ...item,
            data: `rekeyed:${item.data}`,
            pwdHash: to.pwdHash,
          }));
      mockRekey.mockImplementationOnce(rekey);
      if (poolFailure || failure === 'secure failure')
        mockRekey.mockImplementationOnce(rekey).mockImplementationOnce(rekey);
      let serverDekId: string | undefined = pending.dekId;
      const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => ({
        data: {
          code: 0,
          message: 'success',
          data: {
            lock: serverDekId && {
              data: JSON.stringify({
                dekId: serverDekId,
                generation: 2,
                kekVersion: 1,
                kekSalt: 'cd'.repeat(16),
                wrappedDek: 'fixture-envelope',
              }),
            },
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        // Native pinned-IP transport does not supply a final URL marker.
        request: {},
      }));
      getClient.mockResolvedValue(axios.create({ baseURL: origin, adapter }));
      mockStored = original;
      jest
        .mocked(generateHardwareCloudSyncCredentialWithSdk)
        .mockImplementationOnce(async (params) => {
          await signIn(params);
          return { credential: original, source };
        });
      jest
        .mocked(sessionApi.rotateHardwareCloudSyncDataKey)
        .mockImplementationOnce(
          async ({ savePending, beforeFlush, flushSignal, isCurrent }) => {
            await savePending(pending);
            await beforeFlush?.();
            expect(isCurrent?.()).toBe(true);
            expect(flushSignal?.aborted).toBe(false);
            if (
              failure === 'node changed' ||
              failure === 'nonce refused after node change'
            ) {
              changeMockTestEndpoint();
              expect(isCurrent?.()).toBe(false);
              expect(flushSignal?.aborted).toBe(true);
            }
            if (failure.startsWith('nonce refused')) {
              jest
                .mocked(sessionApi.isHardwareCloudSyncNonceInvalidError)
                .mockImplementationOnce((error) => error === nonceError);
              if (failure === 'nonce refused during cleanup') {
                jest
                  .mocked(keylessSyncCredentialStorage.getCredential)
                  .mockImplementationOnce(async () => {
                    changeMockTestEndpoint();
                    return mockStored ?? null;
                  });
              }
              throw nonceError;
            }
            return {
              next: recoveryKey,
              generation: 2,
              items: [],
              verifiedFlushOrigin: noMarker ? undefined : origin,
            };
          },
        );
      const interrupted = new Error('interrupted local rotation');
      const pool = jest
        .spyOn(localDb, 'updateSyncItem')
        .mockImplementationOnce(async ({ updater }) => {
          expect(mockStored?.pendingDataKey).toEqual(pending);
          expect(mockStored?.pwdHash).toBe(original.pwdHash);
          if (poolFailure) throw interrupted;
          record = await updater(record);
          if (failure === 'secure failure') {
            jest
              .mocked(keylessSyncCredentialStorage.saveCredential)
              .mockRejectedValueOnce(interrupted);
          }
        });
      const reset = service.resetHardwareCloudSyncKey({ connectId });
      if (failure.startsWith('nonce refused')) {
        const refused = failure === 'nonce refused';
        if (failure === 'nonce refused during cleanup') {
          await expect(reset).rejects.toThrow('settings changed');
        } else {
          await expect(reset).rejects.toMatchObject({
            key: refused
              ? ETranslations.cloud_sync_data_changed_during_key_change__msg
              : ETranslations.update_operation_canceled,
          });
        }
        expect(mockStored?.pwdHash).toBe(original.pwdHash);
        expect(mockStored?.pendingDataKey).toEqual(
          refused ? undefined : pending,
        );
        expect(pool).not.toHaveBeenCalled();
        return;
      }
      if (failure === 'success' || failure === 'missing proof') {
        await reset;
        expect(pool).toHaveBeenCalledTimes(1);
        expect(mockStored?.pwdHash).toBe(recoveryKey.pwdHash);
        expect(mockStored?.pendingDataKey).toBeUndefined();
        return;
      }
      await expect(reset).rejects.toThrow(
        failure === 'node changed' ? 'settings changed' : interrupted.message,
      );
      expect(mockStored?.pendingDataKey).toEqual(pending);
      expect(mockStored?.pwdHash).toBe(original.pwdHash);
      if (failure === 'node changed') {
        expect(pool).not.toHaveBeenCalled();
        return;
      }
      // An independently interrupted recovery must leave the same journal
      // available to a newly constructed service, even without a URL marker.
      const readLock = jest.mocked(
        sessionApi.getCurrentHardwareCloudSyncDataKeyId,
      );
      if (failure === 'secure failure') {
        for (const lock of [original.hardwareSession.dekId, undefined]) {
          serverDekId = lock;
          readLock.mockImplementationOnce(
            actualSession.getCurrentHardwareCloudSyncDataKeyId,
          );
          await expect(
            service['handleHardwareDataKeyRefused']({
              ...original,
              pendingDataKey: pending,
            }),
          ).resolves.toBeUndefined();
          expect(mockStored?.pendingDataKey).toEqual(pending);
          expect(record.pwdHash).toBe(pending.pwdHash);
          expect(record.dataTime).toBe(unknownItem.dataTime);
        }
        serverDekId = pending.dekId;
      }
      readLock.mockImplementationOnce(
        actualSession.getCurrentHardwareCloudSyncDataKeyId,
      );
      pool.mockImplementationOnce(async () => {
        expect(mockStored?.pendingDataKey).toEqual(pending);
        throw interrupted;
      });
      await expect(
        service['handleHardwareDataKeyRefused'](original),
      ).rejects.toThrow(interrupted.message);
      expect(mockStored?.pendingDataKey).toEqual(pending);
      expect(mockStored?.pwdHash).toBe(original.pwdHash);

      const restarted = setup();
      restarted.getClient.mockResolvedValue(
        axios.create({ baseURL: origin, adapter }),
      );
      restarted.backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems.mockImplementation(
        readPool,
      );
      readLock.mockImplementationOnce(
        actualSession.getCurrentHardwareCloudSyncDataKeyId,
      );
      pool.mockImplementationOnce(async ({ ids, updater }) => {
        if (ids.includes(record.id)) record = await updater(record);
      });
      await restarted.service['handleHardwareDataKeyRefused'](original);
      expect(record.data).toBe(`rekeyed:${unknownItem.data}`);
      expect(record.dataTime).toBe(
        realmNullableTime ? null : unknownItem.dataTime,
      );
      expect(record.pwdHash).toBe(recoveryKey.pwdHash);
      expect(adapter).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/prime/v1/sync/lock',
          method: 'get',
        }),
      );
      expect(pool).toHaveBeenCalledTimes(3);
      expect(mockStored?.hardwareSession?.dekId).toBe(recoveryKey.dekId);
      expect(mockStored?.pwdHash).toBe(recoveryKey.pwdHash);
      expect(mockStored?.pendingDataKey).toBeUndefined();
    },
  );

  test.each(['old', 'missing'] as const)(
    'a pre-flush interrupted reset still clears a %s Lock journal without rekeying',
    async (lock) => {
      const { service } = setup();
      const before = { ...current, pendingDataKey: { ...next, generation: 2 } };
      mockStored = before;
      const pool = jest.spyOn(localDb, 'updateSyncItem');
      jest
        .mocked(sessionApi.getCurrentHardwareCloudSyncDataKeyId)
        .mockResolvedValueOnce(lock === 'old' ? session.dekId : undefined);
      await expect(
        service['handleHardwareDataKeyRefused'](before),
      ).resolves.toBeUndefined();
      expect(pool).not.toHaveBeenCalled();
      expect(mockStored?.pwdHash).toBe(current.pwdHash);
      expect(mockStored?.pendingDataKey).toBeUndefined();
      expect(sessionApi.revokeHardwareCloudSyncSession).not.toHaveBeenCalled();
    },
  );

  test('a stalled stale-Lock pool read releases the lock and keeps the pending key', async () => {
    const { service, backgroundApi } = setup();
    const before = { ...current, pendingDataKey: { ...next, generation: 2 } };
    mockStored = before;
    jest
      .mocked(sessionApi.getCurrentHardwareCloudSyncDataKeyId)
      .mockResolvedValueOnce(session.dekId);
    backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems.mockImplementationOnce(
      async () => new Promise(() => undefined),
    );
    await expect(
      service['handleHardwareDataKeyRefused'](before),
    ).resolves.toBeUndefined();
    await expect(
      service.runWithCloudSyncKeyLock(async () => 'available'),
    ).resolves.toBe('available');
    expect(mockStored).toEqual(before);
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
    ).not.toHaveBeenCalled();
  });

  test('refreshes the committed physical source even when the post-reset sync fails', async () => {
    const { service, backgroundApi } = setup();
    jest.spyOn(localDb, 'updateSyncItem').mockResolvedValue(undefined);
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementationOnce(async (params) => {
        await signIn(params);
        return {
          credential: current,
          source: {
            ...source,
            deviceName: 'Latest label',
            deviceSerialNoHash: displayDeviceSerialNoHash,
          },
        };
      });
    jest
      .mocked(sessionApi.rotateHardwareCloudSyncDataKey)
      .mockImplementationOnce(async (params) => {
        await params.savePending({ ...next, generation: 2 });
        await params.beforeFlush?.();
        return { next, generation: 2, items: [] };
      });
    const syncError = new OneKeyLocalError('Post-reset sync unavailable');
    backgroundApi.servicePrimeCloudSync.startServerSyncFlow
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(syncError);
    await expect(service.resetHardwareCloudSyncKey({ connectId })).rejects.toBe(
      syncError,
    );
    expect(mockStored?.pwdHash).toBe(next.pwdHash);
    expect(mockConfig.hardwareCloudSyncKeySource?.deviceName).toBe(
      'Latest label',
    );
    expect(mockConfig.hardwareCloudSyncKeySource?.deviceSerialNoHash).toBe(
      displayDeviceSerialNoHash,
    );
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

  test.each(['rename first', 'rotation first'] as const)(
    'wallet rename shares the key lock from credential read through commit: %s',
    async (order) => {
      const { service, backgroundApi } = setup();
      const wallet = { id: 'hd-1', name: 'Original name' };
      const record: IDBCloudSyncItem = {
        id: 'wallet-metadata-sync-id',
        dataType: EPrimeCloudSyncDataType.Wallet,
        rawKey: 'Wallet >> test-wallet',
        rawData: 'Original name',
        data: 'original-ciphertext',
        pwdHash: current.pwdHash,
        dataTime: 1,
        isDeleted: false,
        localSceneUpdated: true,
        serverUploaded: true,
      };
      let release = () => {};
      let entered = () => {};
      const paused = new Promise<void>((resolve) => {
        release = resolve;
      });
      const ready = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const getSyncCredential = jest.fn(async () => mockStored);
      const buildSyncItemByDBQuery = jest.fn(
        async ({
          dbRecord,
          syncCredential,
        }: {
          dbRecord: { name: string };
          syncCredential: IKeylessCloudSyncCredential;
        }): Promise<IDBCloudSyncItem> => ({
          ...record,
          rawData: dbRecord.name,
          data: `rename-ciphertext:${syncCredential.pwdHash}`,
          pwdHash: syncCredential.pwdHash,
          dataTime: 2,
          serverUploaded: false,
        }),
      );
      const txAddAndUpdateFreshSyncItems = jest.fn(
        async ({ items }: { items: IDBCloudSyncItem[] }) => {
          if (order === 'rename first') {
            entered();
            await paused;
          }
          Object.assign(record, items[0]);
        },
      );
      const db: LocalDbBase = Object.assign(
        Object.create(LocalDbBase.prototype) as LocalDbBase,
        {
          backgroundApi: {
            serviceKeylessCloudSync: service,
            servicePrimeCloudSync: {
              apiUploadItems: jest.fn(async () => undefined),
              syncManagers: {
                wallet: { getSyncCredential, buildSyncItemByDBQuery },
              },
            },
          },
          getWallet: async () => ({ ...wallet }),
          withTransaction: async (
            _bucket: EIndexedDBBucketNames,
            fn: (tx: object) => Promise<unknown>,
          ) => fn({}),
          txAssertCloudSyncMetadataSource: async () => undefined,
          txGetRecordsByIds: async () => ({ records: [{ ...record }] }),
          txAddAndUpdateFreshSyncItems,
          txUpdateWallet: async ({
            updater,
          }: {
            updater: (value: typeof wallet) => typeof wallet;
          }) => updater(wallet),
        },
      );
      backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems.mockImplementation(
        async () => ({ items: [{ ...record }] }),
      );
      jest
        .mocked(sessionApi.reencryptHardwareCloudSyncItems)
        .mockImplementationOnce(async ({ items }) => {
          if (order === 'rotation first') {
            entered();
            await paused;
          }
          return items.map((item) => ({
            ...item,
            data: `rotate-ciphertext:${item.data}`,
            pwdHash: next.pwdHash,
          }));
        });
      jest
        .spyOn(localDb, 'updateSyncItem')
        .mockImplementation(async ({ updater }) => {
          await updater(record);
        });
      const rename = () =>
        db.setWalletNameAndAvatar({
          walletId: wallet.id,
          name: 'New wallet name',
        });
      const rotate = () => service['commitHardwareDataKey'](current, next);
      const first = order === 'rename first' ? rename() : rotate();
      await ready;
      const second = order === 'rename first' ? rotate() : rename();
      try {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        if (order === 'rename first') {
          expect(
            backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems,
          ).not.toHaveBeenCalled();
        } else {
          expect(getSyncCredential).not.toHaveBeenCalled();
        }
      } finally {
        release();
        await Promise.all([first, second]);
      }
      expect(txAddAndUpdateFreshSyncItems).toHaveBeenCalledTimes(1);
      expect(wallet.name).toBe('New wallet name');
      expect(record).toMatchObject({
        rawData: 'New wallet name',
        data:
          order === 'rename first'
            ? `rotate-ciphertext:rename-ciphertext:${current.pwdHash}`
            : `rename-ciphertext:${next.pwdHash}`,
        pwdHash: next.pwdHash,
        dataTime: 2,
        localSceneUpdated: true,
        serverUploaded: false,
      });
    },
  );

  test.each([
    { skipSaveLocalSyncItem: true },
    { applyRestoreSyncPolicy: true },
  ])(
    'wallet metadata without a new sync item does not reacquire the key lock: %j',
    async (options) => {
      const { service } = setup();
      const lock = jest.spyOn(service, 'runWithCloudSyncKeyLock');
      const wallet = { id: 'hd-1', name: 'Local name' };
      const write = jest.fn(async () => wallet);
      const db: LocalDbBase = Object.assign(
        Object.create(LocalDbBase.prototype) as LocalDbBase,
        {
          backgroundApi: { serviceKeylessCloudSync: service },
          setWalletNameAndAvatarInternal: write,
        },
      );
      const params = { walletId: wallet.id, name: 'Cloud name', ...options };
      await expect(db.setWalletNameAndAvatar(params)).resolves.toBe(wallet);
      expect(write).toHaveBeenCalledWith(params);
      expect(lock).not.toHaveBeenCalled();
    },
  );

  test('scene account rename does not reacquire the key lock', async () => {
    const { service } = setup();
    const lock = jest.spyOn(service, 'runWithCloudSyncKeyLock');
    const write = jest.fn(async () => undefined);
    const db: LocalDbBase = Object.assign(
      Object.create(LocalDbBase.prototype) as LocalDbBase,
      {
        backgroundApi: { serviceKeylessCloudSync: service },
        setAccountNameInternal: write,
      },
    );
    const params = {
      accountId: 'hd-1--account',
      name: 'Public name',
      skipSaveLocalSyncItem: true,
    };
    await db.setAccountName(params);
    expect(write).toHaveBeenCalledWith(params, undefined);
    expect(lock).not.toHaveBeenCalled();
  });

  test.each([false, true])(
    'local public-account write admitted before rotation is migrated (deleted=%s)',
    async (isDeleted) => {
      const { service, backgroundApi } = setup();
      const record = {
        id: 'public-account',
        dataType: 'Account',
        rawData: '',
        rawKey: '',
        data: 'old-version',
        pwdHash: current.pwdHash,
        dataTime: 1,
        isDeleted: false,
        serverUploaded: false,
        localSceneUpdated: true,
      } as IDBCloudSyncItem;
      let release = () => {};
      let entered = () => {};
      const paused = new Promise<void>((resolve) => {
        release = resolve;
      });
      const ready = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const write = async () => {
        const selectedHash = mockStored?.pwdHash;
        entered();
        await paused;
        Object.assign(record, {
          pwdHash: selectedHash,
          data: 'new-version',
          dataTime: 2,
          isDeleted,
        });
        return { isOverrideAccounts: false, existsAccounts: [] };
      };
      const db: LocalDbBase = Object.assign(
        Object.create(LocalDbBase.prototype) as LocalDbBase,
        {
          backgroundApi: { serviceKeylessCloudSync: service },
          addAccountsToWalletWithCloudKeyLock: write,
          removeAccountWithCloudKeyLock: write,
        },
      );
      backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems.mockImplementation(
        async () => ({ items: [{ ...record }] }),
      );
      jest
        .mocked(sessionApi.reencryptHardwareCloudSyncItems)
        .mockImplementation(async ({ items }) =>
          items.map((item) => ({
            ...item,
            data: 'new-key-version',
            pwdHash: next.pwdHash,
          })),
        );
      jest
        .spyOn(localDb, 'updateSyncItem')
        .mockImplementation(async ({ updater }) => {
          await updater(record);
        });
      const writing = isDeleted
        ? db.removeAccount({ accountId: 'hd-1--account', walletId: 'hd-1' })
        : db.addAccountsToWallet({ walletId: 'hd-1', accounts: [] });
      await ready;
      const rotating = service['commitHardwareDataKey'](current, next);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(
        backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems,
      ).not.toHaveBeenCalled();
      release();
      await Promise.all([writing, rotating]);
      expect(record).toMatchObject({
        rawData: '',
        pwdHash: next.pwdHash,
        data: 'new-key-version',
        dataTime: 2,
        isDeleted,
        serverUploaded: false,
      });
    },
  );

  test.each([false, true])(
    'local public-account write admitted after rotation reads the new credential (deleted=%s)',
    async (isDeleted) => {
      const { service } = setup();
      let release = () => {};
      let entered = () => {};
      const paused = new Promise<void>((resolve) => {
        release = resolve;
      });
      const ready = new Promise<void>((resolve) => {
        entered = resolve;
      });
      jest
        .mocked(sessionApi.reencryptHardwareCloudSyncItems)
        .mockImplementationOnce(async ({ items }) => {
          entered();
          await paused;
          return items;
        });
      jest.spyOn(localDb, 'updateSyncItem').mockResolvedValue(undefined);
      let record: Partial<IDBCloudSyncItem> | undefined;
      const write = jest.fn(async () => {
        record = {
          rawData: '',
          pwdHash: mockStored?.pwdHash,
          dataTime: 2,
          isDeleted,
          serverUploaded: false,
        };
        return { isOverrideAccounts: false, existsAccounts: [] };
      });
      const db: LocalDbBase = Object.assign(
        Object.create(LocalDbBase.prototype) as LocalDbBase,
        {
          backgroundApi: { serviceKeylessCloudSync: service },
          addAccountsToWalletWithCloudKeyLock: write,
          removeAccountWithCloudKeyLock: write,
        },
      );
      const rotating = service['commitHardwareDataKey'](current, next);
      await ready;
      const writing = isDeleted
        ? db.removeAccount({ accountId: 'hd-1--account', walletId: 'hd-1' })
        : db.addAccountsToWallet({ walletId: 'hd-1', accounts: [] });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(write).not.toHaveBeenCalled();
      release();
      await Promise.all([rotating, writing]);
      expect(record).toMatchObject({
        rawData: '',
        pwdHash: next.pwdHash,
        dataTime: 2,
        isDeleted,
        serverUploaded: false,
      });
    },
  );

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
