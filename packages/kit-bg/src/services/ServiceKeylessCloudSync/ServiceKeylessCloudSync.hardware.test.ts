import { EDeviceType } from '@onekeyfe/hd-shared';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';
import { ECloudSyncMode } from '@onekeyhq/shared/types/keylessCloudSync';

import { primeCloudSyncPersistAtom } from '../../states/jotai/atoms';
import keylessSyncCredentialStorage from '../ServiceKeylessWallet/utils/keylessSyncCredentialStorage';

import { generateHardwareCloudSyncCredentialWithSdk } from './hardwareCloudSyncSdk';
import ServiceKeylessCloudSync from './ServiceKeylessCloudSync';

import type { IPrimeCloudSyncPersistAtomData } from '../../states/jotai/atoms/prime';

let mockConfig: IPrimeCloudSyncPersistAtomData;
let mockStored: IKeylessCloudSyncCredential | undefined;

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
// Sign-in and the data key need the server; the key under test stays the
// device-derived one, as if this device created the data key.
jest.mock('./hardwareCloudSyncSession', () => ({
  createHardwareCloudSyncDeviceKey: jest.fn(() => ({
    kty: 'EC',
    crv: 'P-256',
    x: 'public-test-x',
    y: 'public-test-y',
    d: 'public-test-d',
  })),
  requestHardwareCloudSyncChallenge: jest.fn(async () => ({
    challengeId: 'public-test-challenge',
    message: 'public-test-message',
  })),
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
  isHardwareCloudSyncKeyEnvelopeItem: jest.fn(() => false),
  refreshHardwareCloudSyncSessionIfNeeded: jest.fn(async () => undefined),
  requestRawWithHardwareCloudSyncSession: jest.fn(),
}));

type IDeviceParams = Pick<
  Parameters<typeof generateHardwareCloudSyncCredentialWithSdk>[0],
  'unlock'
>;
// Runs the service's unlock (sign-in, then the data key) as the SDK does.
const signIn = async ({ unlock }: IDeviceParams) => {
  await unlock({
    credentialId: 'hardware-cloud-v1-test',
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
  credentialId: 'hardware-cloud-v1-test',
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
});

function setup(items: Array<{ pwdHash?: string }> = []) {
  const initLocalSyncItemsDB = jest.fn(async () => undefined);
  const clearCachedSyncCredential = jest.fn(
    async (): Promise<void> => undefined,
  );
  const backgroundApi = {
    serviceAccount: {
      getKeylessWallet: jest.fn(async () => ({ id: 'hd-keyless-test' })),
    },
    servicePrime: {
      apiFetchPrimeUserInfo: jest.fn(async () => undefined),
      getPrimeClient: jest.fn(async () => ({})),
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
      startServerSyncFlow: jest.fn(async () => undefined),
      getAllLocalSyncItems: jest.fn(async () => ({ items })),
      resolvePasswordOnlyIfHdXfpMissing: jest.fn(
        async (): Promise<string | undefined> => undefined,
      ),
      clearCachedSyncCredential,
      initLocalSyncItemsDB,
    },
  };
  const service = new ServiceKeylessCloudSync({ backgroundApi });
  clearCachedSyncCredential.mockImplementation(async () =>
    service.clearKeylessCloudSyncCredentialCache(),
  );
  servicesToClear.add(service);
  return { service, backgroundApi, initLocalSyncItemsDB };
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
    const { service } = setup([{ pwdHash: credential.pwdHash }]);
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
      ).rejects.toThrow('not available here');
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
    ).rejects.toThrow('cancelled');
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
    await expect(activation).rejects.toThrow('cancelled');
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
    await expect(first).rejects.toThrow('cancelled');
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
});
