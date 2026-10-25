import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';

import { primeCloudSyncPersistAtom } from '../../states/jotai/atoms';
import keylessSyncCredentialStorage from '../ServiceKeylessWallet/utils/keylessSyncCredentialStorage';

import { generateHardwareCloudSyncCredentialWithSdk } from './hardwareCloudSyncSdk';
import ServiceKeylessCloudSync from './ServiceKeylessCloudSync';

import type { IPrimeCloudSyncPersistAtomData } from '../../states/jotai/atoms/prime';

let mockConfig: IPrimeCloudSyncPersistAtomData;
let mockStored: IKeylessCloudSyncCredential | undefined;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDev: true, isDesktop: true },
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

const walletXfp = `1234--xpub${'A'.repeat(107)}`;
const source = {
  type: 'hardware' as const,
  walletId: 'hw-local-original',
  walletXfp,
  credentialId: 'hardware-cloud-v1-test',
  derivationVersion: 1 as const,
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

function setup(items: Array<{ pwdHash?: string }> = []) {
  const initLocalSyncItemsDB = jest.fn(async () => undefined);
  const clearCachedSyncCredential = jest.fn(
    async (): Promise<void> => undefined,
  );
  const backgroundApi = {
    localDb: {
      getWallet: jest.fn(async () => ({ id: source.walletId, xfp: walletXfp })),
    },
    serviceAccount: {
      getKeylessWallet: jest.fn(async () => ({ id: 'hd-keyless-test' })),
    },
    serviceApp: { isAppLocked: jest.fn(async () => false) },
    servicePrimeCloudSync: {
      startServerSyncFlow: jest.fn(async () => undefined),
      getAllLocalSyncItems: jest.fn(async () => ({ items })),
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
      .mockResolvedValue({ credential, source });
  });

  test('activates one source using the existing credential storage and cache', async () => {
    const { service, initLocalSyncItemsDB } = setup();
    await service.enableHardwareCloudSync({ walletId: source.walletId });
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(source);
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
    expect(mockConfig.isCloudSyncEnabled).toBe(false);
    expect(mockStored).toEqual(credential);
    expect(await service.getKeylessCloudSyncCredential()).toEqual(credential);
    expect(initLocalSyncItemsDB).toHaveBeenCalledWith({
      syncCredential: expect.objectContaining({
        keylessCredential: credential,
      }),
    });
    service.clearKeylessCloudSyncCredentialCache();
    expect(await service.getKeylessCloudSyncCredential()).toEqual(credential);
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

  test('preserves the existing space when switching would overwrite encrypted records', async () => {
    const { service } = setup([{ pwdHash: 'keyless-old-space' }]);
    mockStored = {
      ...credential,
      keylessWalletId: 'hd-keyless-old',
      source: undefined,
    };
    await expect(
      service.enableHardwareCloudSync({ walletId: source.walletId }),
    ).rejects.toThrow('migration');
    expect(generateHardwareCloudSyncCredentialWithSdk).not.toHaveBeenCalled();
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
    expect(mockConfig.hardwareCloudSyncKeySource).toBeUndefined();
  });

  test('switching back to Keyless preserves an encrypted hardware space', async () => {
    const { service } = setup([{ pwdHash: credential.pwdHash }]);
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockStored = credential;
    await expect(service.selectKeylessCloudSyncKey()).rejects.toThrow(
      'migration',
    );
    expect(mockStored).toBe(credential);
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(source);
  });

  test('disabling clears memory while preserving the shared stored hardware key', async () => {
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
    ).not.toHaveBeenCalled();
    expect(await service.getKeylessCloudSyncCredential()).toEqual(credential);
    expect(generateHardwareCloudSyncCredentialWithSdk).not.toHaveBeenCalled();
  });

  test('resumes a disabled saved key without SDK, seed repair or a connected device', async () => {
    const { service, backgroundApi } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockStored = credential;
    await service.setCloudSyncEnabledKeyless(false);
    const repair = jest.spyOn(service, 'repairKeylessSyncCredentialIfNeeded');
    await expect(
      service.toggleCloudSyncKeyless({
        enabled: true,
        expectedHardwareCloudKeySourceId: source.credentialId,
      }),
    ).resolves.toEqual({ requiresHardware: false });
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
    expect(mockStored).toBe(credential);
    expect(repair).not.toHaveBeenCalled();
    expect(generateHardwareCloudSyncCredentialWithSdk).not.toHaveBeenCalled();
    expect(
      backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
    ).toHaveBeenCalledTimes(1);
    repair.mockRestore();
  });

  test('missing saved credentials request explicit hardware recovery without enabling', async () => {
    const { service, backgroundApi } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    await expect(
      service.toggleCloudSyncKeyless({
        enabled: true,
        expectedHardwareCloudKeySourceId: source.credentialId,
      }),
    ).resolves.toEqual({ requiresHardware: true });
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(source);
    expect(generateHardwareCloudSyncCredentialWithSdk).not.toHaveBeenCalled();
    expect(
      backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
    ).not.toHaveBeenCalled();
  });

  test('stale UI source cannot enable or disable the newly selected source', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = {
      ...source,
      credentialId: 'other-selected',
    };
    mockConfig.isCloudSyncEnabledKeyless = true;
    await expect(
      service.toggleCloudSyncKeyless({
        enabled: true,
        expectedHardwareCloudKeySourceId: source.credentialId,
      }),
    ).rejects.toThrow('selected Cloud key changed');
    expect(mockConfig.hardwareCloudSyncKeySource.credentialId).toBe(
      'other-selected',
    );
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
  });

  test('cancellation during initialization preserves the disabled saved key', async () => {
    const { service, initLocalSyncItemsDB, backgroundApi } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockStored = credential;
    initLocalSyncItemsDB.mockImplementationOnce(async () => {
      await service.cancelHardwareCloudKeyOperation();
    });
    await expect(
      service.toggleCloudSyncKeyless({
        enabled: true,
        expectedHardwareCloudKeySourceId: source.credentialId,
      }),
    ).rejects.toThrow('cancelled');
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
    expect(mockStored).toBe(credential);
    expect(
      backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
    ).not.toHaveBeenCalled();
  });

  test('locking inside the enable setter still cancels saved-key resume', async () => {
    const { service, backgroundApi } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockStored = credential;
    backgroundApi.localDb.getWallet.mockImplementationOnce(async () => {
      backgroundApi.serviceApp.isAppLocked.mockResolvedValue(true);
      expect(await service.cancelHardwareCloudKeyOperation()).toBe(true);
      return { id: source.walletId, xfp: walletXfp };
    });
    await expect(
      service.toggleCloudSyncKeyless({
        enabled: true,
        expectedHardwareCloudKeySourceId: source.credentialId,
      }),
    ).rejects.toThrow('cancelled');
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
    expect(
      service.getKeylessCloudSyncCredentialCacheSync(source.credentialId),
    ).toBeUndefined();
    expect(mockStored).toBe(credential);
    expect(
      backgroundApi.servicePrimeCloudSync.startServerSyncFlow,
    ).not.toHaveBeenCalled();
  });

  test('a hydration failure rolls back a fresh resume without deleting its saved key', async () => {
    const { service } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockStored = credential;
    jest
      .mocked(keylessSyncCredentialStorage.getCredential)
      .mockResolvedValueOnce(credential)
      .mockRejectedValueOnce(new Error('Synthetic storage read failed'));
    await expect(
      service.toggleCloudSyncKeyless({
        enabled: true,
        expectedHardwareCloudKeySourceId: source.credentialId,
      }),
    ).rejects.toThrow('Synthetic storage read failed');
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
    expect(mockStored).toBe(credential);
  });

  test('a cancelled duplicate resume does not turn off an already enabled source', async () => {
    const { service, backgroundApi } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockConfig.isCloudSyncEnabledKeyless = true;
    mockStored = credential;
    backgroundApi.localDb.getWallet.mockImplementationOnce(async () => {
      await service.cancelHardwareCloudKeyOperation();
      return { id: source.walletId, xfp: walletXfp };
    });
    await expect(
      service.toggleCloudSyncKeyless({
        enabled: true,
        expectedHardwareCloudKeySourceId: source.credentialId,
      }),
    ).rejects.toThrow('cancelled');
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(true);
    expect(
      service.getKeylessCloudSyncCredentialCacheSync(source.credentialId),
    ).toBeUndefined();
  });

  test('resume retains the production gate and rejects a locked app', async () => {
    const { service, backgroundApi } = setup();
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockStored = credential;
    const production = jest.replaceProperty(platformEnv, 'isDev', false);
    await expect(
      service.toggleCloudSyncKeyless({
        enabled: true,
        expectedHardwareCloudKeySourceId: source.credentialId,
      }),
    ).rejects.toThrow('compatibility validation');
    production.restore();
    backgroundApi.serviceApp.isAppLocked.mockResolvedValueOnce(true);
    await expect(
      service.toggleCloudSyncKeyless({
        enabled: true,
        expectedHardwareCloudKeySourceId: source.credentialId,
      }),
    ).rejects.toThrow('Unlock the App');
    expect(mockConfig.isCloudSyncEnabledKeyless).toBe(false);
    expect(generateHardwareCloudSyncCredentialWithSdk).not.toHaveBeenCalled();
  });

  test('allows replacement physical hardware with the same standard wallet and key', async () => {
    const { service } = setup([{ pwdHash: credential.pwdHash }]);
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockStored = credential;
    const replacement = { ...source, walletId: 'hw-local-replacement' };
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockResolvedValue({ credential, source: replacement });
    await service.enableHardwareCloudSync({ walletId: replacement.walletId });
    expect(mockConfig.hardwareCloudSyncKeySource).toEqual(replacement);
    expect(mockStored?.pwdHash).toBe(credential.pwdHash);
  });

  test('rejects a historically different signature-derived key even with identical XFP', async () => {
    const { service } = setup([{ pwdHash: credential.pwdHash }]);
    mockConfig.hardwareCloudSyncKeySource = source;
    mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
    mockStored = credential;
    jest.mocked(generateHardwareCloudSyncCredentialWithSdk).mockResolvedValue({
      credential: { ...credential, pwdHash: 'keyless-different' },
      source,
    });
    await expect(
      service.enableHardwareCloudSync({ walletId: source.walletId }),
    ).rejects.toThrow('different Cloud key');
    expect(mockStored).toBe(credential);
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
  });

  test('rejects cancelled and failed hardware results before persisting anything', async () => {
    const { service } = setup();
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockImplementation(async () => {
        await service.cancelHardwareCloudKeyOperation();
        return { credential, source };
      });
    await expect(
      service.enableHardwareCloudSync({ walletId: source.walletId }),
    ).rejects.toThrow('cancelled');
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
    jest
      .mocked(generateHardwareCloudSyncCredentialWithSdk)
      .mockRejectedValue(new Error('device cancelled'));
    await expect(
      service.enableHardwareCloudSync({ walletId: source.walletId }),
    ).rejects.toThrow('device cancelled');
    expect(mockConfig.hardwareCloudSyncKeySource).toBeUndefined();
  });

  test('does not acknowledge cancellation once the atomic commit has started', async () => {
    const { service } = setup();
    jest
      .mocked(keylessSyncCredentialStorage.saveCredential)
      .mockImplementationOnce(async (value) => {
        expect(await service.cancelHardwareCloudKeyOperation()).toBe(false);
        mockStored = value;
      });
    await service.enableHardwareCloudSync({ walletId: source.walletId });
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

  test('serializes a new Keyless save behind hardware selection', async () => {
    const { service } = setup();
    let release: () => void = () => undefined;
    const pause = new Promise<void>((resolve) => {
      release = resolve;
    });
    const selection = service.runWithCloudSyncKeyLock(async () => {
      await pause;
      mockConfig.hardwareCloudSyncKeySource = source;
      mockConfig.currentCloudSyncKeylessWalletId = source.credentialId;
      mockStored = credential;
    });
    const pendingSave = service.persistNewKeylessCloudSyncCredential({
      ...credential,
      keylessWalletId: 'hd-new-keyless',
      source: undefined,
    });
    await Promise.resolve();
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
    release();
    await Promise.all([selection, pendingSave]);
    expect(mockStored).toBe(credential);
    expect(keylessSyncCredentialStorage.saveCredential).not.toHaveBeenCalled();
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
    const activation = service.enableHardwareCloudSync({
      walletId: source.walletId,
    });
    release();
    await Promise.all([sweep, activation]);
    expect(mockStored).toEqual(credential);
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
