import { EDeviceType } from '@onekeyfe/hd-shared';
import { Semaphore } from 'async-mutex';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ECloudSyncMode } from '@onekeyhq/shared/types/keylessCloudSync';
import type {
  ICloudSyncCheckServerStatusResult,
  ICloudSyncCredential,
  ICloudSyncServerItem,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import {
  primeCloudSyncPersistAtom,
  primeMasterPasswordPersistAtom,
} from '../../states/jotai/atoms';

import ServicePrimeCloudSync from './ServicePrimeCloudSync';

import type { IDBCloudSyncItem } from '../../dbs/local/types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const passthroughDecorator =
    () =>
    (...args: unknown[]) =>
      args.length === 1 ? args[0] : args[2];

  return {
    backgroundClass: passthroughDecorator,
    backgroundMethod: passthroughDecorator,
    backgroundMethodForDev: passthroughDecorator,
    toastIfError: passthroughDecorator,
  };
});

jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBaseMock {
    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }

    backgroundApi: unknown;
  },
}));

jest.mock('../../states/jotai/atoms', () => ({
  primeCloudSyncPersistAtom: {
    get: jest.fn(),
    set: jest.fn(),
  },
  addressBookPersistAtom: {},
  devSettingsPersistAtom: {},
  primeMasterPasswordPersistAtom: {},
  primePersistAtom: {},
}));

jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerAccount', () => ({
  CloudSyncFlowManagerAccount: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerAddressBook', () => ({
  CloudSyncFlowManagerAddressBook: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerBotWallet', () => ({
  CloudSyncFlowManagerBotWallet: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerBrowserBookmark', () => ({
  CloudSyncFlowManagerBrowserBookmark: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerCustomNetwork', () => ({
  CloudSyncFlowManagerCustomNetwork: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerCustomRpc', () => ({
  CloudSyncFlowManagerCustomRpc: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerCustomToken', () => ({
  CloudSyncFlowManagerCustomToken: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerIndexedAccount', () => ({
  CloudSyncFlowManagerIndexedAccount: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerLock', () => ({
  CloudSyncFlowManagerLock: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerMarketWatchList', () => ({
  CloudSyncFlowManagerMarketWatchList: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerWallet', () => ({
  CloudSyncFlowManagerWallet: jest.fn(),
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('./botWalletCloudSyncUtils', () => ({
  filterBotWalletRecordsByCurrentKeylessSyncScope: jest.fn(),
}));

jest.mock('./cloudSyncCheckUtils', () => ({
  buildOnlyCheckLocalDataTypes: jest.fn(),
}));

jest.mock('./cloudSyncItemBuilder', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('./keylessCloudSyncUtils', () => ({
  __esModule: true,
  default: {},
}));

type ISyncNowKeylessService = ServicePrimeCloudSync & {
  getSyncCredentialSafe: jest.Mock;
  initLocalSyncItemsDB: jest.Mock;
  startServerSyncFlow: jest.Mock;
  updateLastSyncTime: jest.Mock;
};

function buildService({
  isCloudSyncEnabledKeyless = true,
  syncCredential = {
    primeAccountSalt: 'prime-account-salt',
    securityPasswordR1: 'security-password-r1',
    masterPasswordUUID: 'master-password-uuid',
    keylessCredential: {
      keylessWalletId: 'hd-keyless-wallet-id',
      signingPrivateKey: 'signing-private-key',
      signingPublicKey: 'signing-public-key',
      encryptionKey: 'encryption-key',
      pwdHash: 'pwd-hash',
    },
  },
}: {
  isCloudSyncEnabledKeyless?: boolean;
  syncCredential?: Awaited<
    ReturnType<ServicePrimeCloudSync['getSyncCredentialSafe']>
  >;
} = {}) {
  const repairKeylessSyncCredentialIfNeeded = jest.fn(async () => undefined);
  const runWithCloudSyncKeyLock = jest.fn((operation: () => Promise<unknown>) =>
    operation(),
  );
  const promptPasswordVerify = jest.fn(async () => ({
    password: 'prompted-pwd',
  }));
  const service = new ServicePrimeCloudSync({
    backgroundApi: {
      serviceKeylessCloudSync: {
        repairKeylessSyncCredentialIfNeeded,
        runWithCloudSyncKeyLock,
      },
      servicePassword: { promptPasswordVerify },
    },
  }) as ISyncNowKeylessService;

  jest.mocked(primeCloudSyncPersistAtom.get).mockResolvedValue({
    isCloudSyncEnabled: false,
    isCloudSyncEnabledKeyless,
  });
  service.getSyncCredentialSafe = jest.fn(async () => syncCredential);
  const emptyLocalSyncItems: Awaited<
    ReturnType<ServicePrimeCloudSync['initLocalSyncItemsDB']>
  > = {
    allWallets: [],
    allDevices: undefined,
    allAccounts: [],
    allIndexedAccounts: [],
  };
  service.initLocalSyncItemsDB = jest.fn(async () => emptyLocalSyncItems);
  service.startServerSyncFlow = jest.fn(async () => undefined);
  service.updateLastSyncTime = jest.fn(async () => undefined);

  return {
    service,
    repairKeylessSyncCredentialIfNeeded,
    runWithCloudSyncKeyLock,
    promptPasswordVerify,
  };
}

describe('ServicePrimeCloudSync.syncNowKeyless', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('manual keyless sync repairs credential with local secret envelope errors enabled', async () => {
    const { service, repairKeylessSyncCredentialIfNeeded } = buildService();

    await expect(
      service.syncNowKeyless({
        password: 'pwd',
      }),
    ).resolves.toBe(true);

    expect(repairKeylessSyncCredentialIfNeeded).toHaveBeenCalledWith({
      password: 'pwd',
      throwOnLocalSecretEnvelopeUnavailable: true,
    });
    expect(service.startServerSyncFlow).toHaveBeenCalledWith({
      callerName: 'Manual Cloud Sync Keyless',
      noDebounceUpload: true,
      forceSync: undefined,
    });
    expect(service.updateLastSyncTime).toHaveBeenCalledWith({
      syncMode: ECloudSyncMode.Keyless,
    });
  });

  test('manual keyless sync rethrows local secret envelope repair errors before sync starts', async () => {
    const { service, repairKeylessSyncCredentialIfNeeded } = buildService();
    const error = {
      className: EOneKeyErrorClassNames.LocalSecretEnvelopeUnavailable,
      message: 'Local secret envelope wrapping key unavailable',
    };
    repairKeylessSyncCredentialIfNeeded.mockRejectedValue(error);

    await expect(
      service.syncNowKeyless({
        password: 'pwd',
      }),
    ).rejects.toBe(error);

    expect(service.getSyncCredentialSafe).not.toHaveBeenCalled();
    expect(service.initLocalSyncItemsDB).not.toHaveBeenCalled();
    expect(service.startServerSyncFlow).not.toHaveBeenCalled();
    expect(service.updateLastSyncTime).not.toHaveBeenCalled();
  });

  test('manual keyless sync returns false without success side effects when sync cannot run', async () => {
    const { service, repairKeylessSyncCredentialIfNeeded } = buildService();
    service.getSyncCredentialSafe = jest.fn(async () => undefined);

    await expect(
      service.syncNowKeyless({
        password: 'pwd',
      }),
    ).resolves.toBe(false);

    expect(repairKeylessSyncCredentialIfNeeded).toHaveBeenCalledWith({
      password: 'pwd',
      throwOnLocalSecretEnvelopeUnavailable: true,
    });
    expect(service.initLocalSyncItemsDB).not.toHaveBeenCalled();
    expect(service.startServerSyncFlow).not.toHaveBeenCalled();
    expect(service.updateLastSyncTime).not.toHaveBeenCalled();
  });

  test('keyless sync without password skips repair and prompts before the key lock', async () => {
    const {
      service,
      repairKeylessSyncCredentialIfNeeded,
      runWithCloudSyncKeyLock,
      promptPasswordVerify,
    } = buildService();

    await expect(
      service.syncNowKeyless({
        callerName: 'Keyless Wallet Login Success',
        noDebounceUpload: true,
        forceSync: true,
      }),
    ).resolves.toBe(true);

    expect(repairKeylessSyncCredentialIfNeeded).not.toHaveBeenCalled();
    expect(service.initLocalSyncItemsDB).toHaveBeenCalledWith({
      syncCredential: expect.objectContaining({
        primeAccountSalt: 'prime-account-salt',
      }),
      password: 'prompted-pwd',
    });
    // A password prompt must never be open while the key lock is held.
    expect(promptPasswordVerify.mock.invocationCallOrder[0]).toBeLessThan(
      runWithCloudSyncKeyLock.mock.invocationCallOrder[0],
    );
    expect(service.startServerSyncFlow).toHaveBeenCalledWith({
      callerName: 'Keyless Wallet Login Success',
      noDebounceUpload: true,
      forceSync: true,
    });
  });

  test.each([false, true])(
    'legacy cleanup preserves hardware source=%s without reacquiring a held lock',
    async (hasHardwareSource) => {
      const sourceMutex = new Semaphore(1);
      const runWithCloudSyncKeyLock = jest.fn(
        (operation: () => Promise<unknown>) =>
          sourceMutex.runExclusive(operation),
      );
      const clearKeylessCloudSyncCredentialCache = jest.fn();
      const clearLocalMasterPassword = jest.fn(async () => undefined);
      const service = new ServicePrimeCloudSync({
        backgroundApi: {
          serviceKeylessCloudSync: {
            runWithCloudSyncKeyLock,
            clearKeylessCloudSyncCredentialCache,
          },
          serviceMasterPassword: { clearLocalMasterPassword },
        },
      });
      const hardwareSource = hasHardwareSource
        ? {
            type: 'hardware' as const,
            credentialId: 'hardware-cloud-v1-test',
            derivationVersion: 1 as const,
            deviceName: 'OneKey Pro',
            deviceType: EDeviceType.Pro,
          }
        : undefined;
      const state = {
        isCloudSyncEnabled: !hasHardwareSource,
        isCloudSyncEnabledKeyless: hasHardwareSource,
        hasEverEnabledOneKeyIdSync: true,
        hardwareCloudSyncKeySource: hardwareSource,
      };
      jest.mocked(primeCloudSyncPersistAtom.get).mockResolvedValue(state);
      jest
        .mocked(primeCloudSyncPersistAtom.set)
        .mockImplementation(async (update) => {
          if (typeof update === 'function') Object.assign(state, update(state));
        });

      const [, release] = await sourceMutex.acquire();
      try {
        // This is the nested call made by clearLocalMasterPassword when R1
        // decryption fails while a sync flow owns the same semaphore.
        const cleanup = service.setCloudSyncEnabled(false, {
          skipClearLocalMasterPassword: true,
        });
        // Assert before awaiting so a reentrant regression fails immediately.
        expect(runWithCloudSyncKeyLock).not.toHaveBeenCalled();
        await cleanup;
        expect(sourceMutex.isLocked()).toBe(true);
        expect(state.isCloudSyncEnabled).toBe(false);
        expect(state.isCloudSyncEnabledKeyless).toBe(hasHardwareSource);
        expect(state.hardwareCloudSyncKeySource).toBe(hardwareSource);
        expect(clearKeylessCloudSyncCredentialCache).toHaveBeenCalledTimes(1);
        expect(clearLocalMasterPassword).not.toHaveBeenCalled();
      } finally {
        release();
      }
    },
  );
});

describe('ServicePrimeCloudSync server sync without the Cloud key lock', () => {
  const selectedKey: ICloudSyncCredential = {
    primeAccountSalt: 'prime-account-salt',
    securityPasswordR1: 'security-password-r1',
    masterPasswordUUID: 'pwd-hash',
    keylessCredential: {
      keylessWalletId: 'hd-keyless-wallet-id',
      signingPrivateKey: 'signing-private-key',
      signingPublicKey: 'signing-public-key',
      encryptionKey: 'encryption-key',
      pwdHash: 'pwd-hash',
    },
  };
  const switchedKey: ICloudSyncCredential = {
    ...selectedKey,
    keylessCredential: {
      keylessWalletId: 'hardware-cloud-v1-test',
      signingPrivateKey: 'other-signing-private-key',
      signingPublicKey: 'other-signing-public-key',
      encryptionKey: 'other-encryption-key',
      pwdHash: 'other-pwd-hash',
    },
  };
  const serverStatus: ICloudSyncCheckServerStatusResult = {
    obsoleted: ['local-item'],
    diff: [{ key: 'diff-item' } as ICloudSyncServerItem],
    updated: [{ key: 'updated-item' } as ICloudSyncServerItem],
    deleted: ['deleted-item'],
    pwdHash: 'pwd-hash',
    serverTime: 0,
  };

  function buildSyncFlowService() {
    const runWithCloudSyncKeyLock = jest.fn(() => {
      throw new OneKeyLocalError(
        'A server sync must not take the Cloud key lock',
      );
    });
    const service = new ServicePrimeCloudSync({
      backgroundApi: {
        serviceKeylessCloudSync: { runWithCloudSyncKeyLock },
      },
    });
    let selected = selectedKey;
    const switchKey = () => {
      selected = switchedKey;
    };
    jest
      .spyOn(service, 'getSyncCredentialSafe')
      .mockImplementation(async () => selected);
    jest.spyOn(service, 'isCloudSyncIsAvailable').mockResolvedValue(true);
    jest
      .spyOn(service, 'ensureCloudSyncIsAvailable')
      .mockResolvedValue(undefined);
    const checkStatus = jest
      .spyOn(service, 'apiCheckServerStatus')
      .mockResolvedValue(serverStatus);
    const upload = jest
      .spyOn(service, 'apiUploadItems')
      .mockResolvedValue(undefined);
    const saveItems = jest
      .spyOn(service, 'saveServerSyncItemsToLocal')
      .mockResolvedValue(undefined);
    const saveDeleted = jest
      .spyOn(service, 'saveServerDeletedItemsToLocal')
      .mockResolvedValue(undefined);
    return {
      service,
      runWithCloudSyncKeyLock,
      switchKey,
      checkStatus,
      upload,
      saveItems,
      saveDeleted,
    };
  }

  const localItems = [{ id: 'local-item' } as IDBCloudSyncItem];

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uploads and writes local items when the key is unchanged', async () => {
    const { service, runWithCloudSyncKeyLock, upload, saveItems, saveDeleted } =
      buildSyncFlowService();
    await service.startServerSyncFlowForItems({
      localItems,
      expectedSyncCredential: selectedKey,
    });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(saveItems).toHaveBeenCalledTimes(2);
    expect(saveDeleted).toHaveBeenCalledTimes(1);
    expect(runWithCloudSyncKeyLock).not.toHaveBeenCalled();
  });

  test('aborts before any write when the key changes during the status request', async () => {
    const { service, switchKey, checkStatus, upload, saveItems, saveDeleted } =
      buildSyncFlowService();
    checkStatus.mockImplementation(async () => {
      switchKey();
      return serverStatus;
    });
    await expect(
      service.startServerSyncFlowForItems({
        localItems,
        expectedSyncCredential: selectedKey,
      }),
    ).rejects.toThrow('The encryption method for Cloud sync changed');
    expect(upload).not.toHaveBeenCalled();
    expect(saveItems).not.toHaveBeenCalled();
    expect(saveDeleted).not.toHaveBeenCalled();
  });

  test('aborts local writes when the key changes during the upload', async () => {
    const { service, switchKey, upload, saveItems, saveDeleted } =
      buildSyncFlowService();
    upload.mockImplementation(async () => {
      switchKey();
    });
    await expect(
      service.startServerSyncFlowForItems({
        localItems,
        expectedSyncCredential: selectedKey,
      }),
    ).rejects.toThrow('The encryption method for Cloud sync changed');
    expect(upload).toHaveBeenCalledTimes(1);
    expect(saveItems).not.toHaveBeenCalled();
    expect(saveDeleted).not.toHaveBeenCalled();
  });

  test('without an expected key, a switch during the status request still aborts', async () => {
    const { service, switchKey, checkStatus, upload, saveItems, saveDeleted } =
      buildSyncFlowService();
    checkStatus.mockImplementation(async () => {
      switchKey();
      return serverStatus;
    });
    await expect(
      service.startServerSyncFlowForItems({ localItems }),
    ).rejects.toThrow('The encryption method for Cloud sync changed');
    expect(upload).not.toHaveBeenCalled();
    expect(saveItems).not.toHaveBeenCalled();
    expect(saveDeleted).not.toHaveBeenCalled();
  });

  test('a OneKey ID sync is not aborted when its credential is briefly unavailable', async () => {
    const { service, checkStatus, saveItems, saveDeleted } =
      buildSyncFlowService();
    const oneKeyIdKey: ICloudSyncCredential = {
      ...selectedKey,
      keylessCredential: undefined,
    };
    const getCredential = jest
      .spyOn(service, 'getSyncCredentialSafe')
      .mockResolvedValue(oneKeyIdKey);
    checkStatus.mockImplementation(async () => {
      // An App lock clears the cached password the ID credential needs.
      getCredential.mockResolvedValue(undefined);
      return serverStatus;
    });
    await service.startServerSyncFlowForItems({
      localItems,
      expectedSyncCredential: oneKeyIdKey,
    });
    expect(saveItems).toHaveBeenCalledTimes(2);
    expect(saveDeleted).toHaveBeenCalledTimes(1);
  });

  test('a full sync passes the key it selected local items with', async () => {
    const { service, runWithCloudSyncKeyLock } = buildSyncFlowService();
    jest
      .spyOn(service, 'fillingSyncItemsMissingDataFromRawData')
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'getAllLocalSyncItems').mockResolvedValue({
      items: [],
    } as unknown as Awaited<
      ReturnType<ServicePrimeCloudSync['getAllLocalSyncItems']>
    >);
    jest
      .spyOn(service, 'syncToSceneByAllPendingItems')
      .mockResolvedValue(undefined);
    jest
      .spyOn(
        service as unknown as {
          notifyOnekeyIdSyncSunset: () => Promise<void>;
        },
        'notifyOnekeyIdSyncSunset',
      )
      .mockResolvedValue(undefined);
    const forItems = jest
      .spyOn(service, 'startServerSyncFlowForItems')
      .mockResolvedValue(undefined);
    await service.startServerSyncFlowSilently({ throwError: true });
    expect(forItems).toHaveBeenCalledWith(
      expect.objectContaining({ expectedSyncCredential: selectedKey }),
    );
    expect(runWithCloudSyncKeyLock).not.toHaveBeenCalled();
  });
});

describe('ServicePrimeCloudSync local writes re-check the Cloud key', () => {
  const keyA: ICloudSyncCredential = {
    primeAccountSalt: 'prime-account-salt',
    securityPasswordR1: 'security-password-r1',
    masterPasswordUUID: 'pwd-hash',
    keylessCredential: {
      keylessWalletId: 'hd-keyless-wallet-id',
      signingPrivateKey: 'signing-private-key',
      signingPublicKey: 'signing-public-key',
      encryptionKey: 'encryption-key',
      pwdHash: 'pwd-hash',
    },
  };
  const keyB: ICloudSyncCredential = {
    ...keyA,
    keylessCredential: {
      ...keyA.keylessCredential!,
      signingPublicKey: 'other-signing-public-key',
    },
  };
  const localItems = [{ id: 'server-item' } as IDBCloudSyncItem];
  const mockedLocalDb = jest.requireMock<{
    default: {
      addAndUpdateSyncItems?: jest.Mock;
      getRecordsByIds?: jest.Mock;
      removeCloudSyncPoolItems?: jest.Mock;
    };
  }>('../../dbs/local/localDb').default;

  function build(readSelected: () => ICloudSyncCredential | undefined) {
    mockedLocalDb.addAndUpdateSyncItems = jest.fn(async () => undefined);
    mockedLocalDb.getRecordsByIds = jest.fn(async () => ({
      records: localItems,
    }));
    mockedLocalDb.removeCloudSyncPoolItems = jest.fn(async () => undefined);
    const service = new ServicePrimeCloudSync({
      backgroundApi: { serviceKeylessCloudSync: {} },
    });
    jest
      .spyOn(service, 'getSyncCredentialSafe')
      .mockImplementation(async () => readSelected());
    const syncToScene = jest
      .spyOn(service, 'syncToSceneWithLocalSyncItems')
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'updateLastSyncTime').mockResolvedValue(undefined);
    return { service, syncToScene };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('a key switched right before the write leaves local items untouched', async () => {
    const { service, syncToScene } = build(() => keyB);
    await expect(
      service.updateLocalItemsByServer({
        localItems,
        syncCredential: keyA,
        shouldSyncToScene: true,
      }),
    ).rejects.toThrow('The encryption method for Cloud sync changed');
    expect(mockedLocalDb.addAndUpdateSyncItems).not.toHaveBeenCalled();
    expect(syncToScene).not.toHaveBeenCalled();
  });

  test('a key switched after the DB write does not reach the scene', async () => {
    let selected = keyA;
    const { service, syncToScene } = build(() => selected);
    mockedLocalDb.addAndUpdateSyncItems?.mockImplementation(async () => {
      selected = keyB;
    });
    await expect(
      service.updateLocalItemsByServer({
        localItems,
        syncCredential: keyA,
        shouldSyncToScene: true,
      }),
    ).rejects.toThrow('The encryption method for Cloud sync changed');
    expect(syncToScene).not.toHaveBeenCalled();
  });

  test('an unreadable credential is reported as unavailable, not as a key change', async () => {
    const { service } = build(() => undefined);
    await expect(service.assertSyncCredentialUnchanged(keyA)).rejects.toThrow(
      'Cloud key is temporarily unavailable',
    );
  });

  test('an unchanged key writes and syncs to the scene', async () => {
    const { service, syncToScene } = build(() => keyA);
    await service.updateLocalItemsByServer({
      localItems,
      syncCredential: keyA,
      shouldSyncToScene: true,
    });
    expect(mockedLocalDb.addAndUpdateSyncItems).toHaveBeenCalledTimes(1);
    expect(syncToScene).toHaveBeenCalledTimes(1);
  });
});

describe('ServicePrimeCloudSync App password with a hardware Cloud key', () => {
  const hardwareKey: ICloudSyncCredential = {
    primeAccountSalt: '',
    securityPasswordR1: '',
    masterPasswordUUID: '',
    keylessCredential: {
      keylessWalletId: 'hardware-cloud-v1-test',
      signingPrivateKey: 'signing-private-key',
      signingPublicKey: 'signing-public-key',
      encryptionKey: 'encryption-key',
      pwdHash: 'pwd-hash',
      source: {
        type: 'hardware',
        credentialId: 'hardware-cloud-v1-test',
        derivationVersion: 1,
        deviceName: 'OneKey Pro',
        deviceType: EDeviceType.Pro,
      },
    },
  };
  const keylessKey: ICloudSyncCredential = {
    ...hardwareKey,
    keylessCredential: {
      ...hardwareKey.keylessCredential!,
      keylessWalletId: 'hd-keyless-wallet-id',
      source: undefined,
    },
  };
  // Stops initLocalSyncItemsDB right after its password stage.
  const stopAfterPasswordStage = new OneKeyLocalError('stop');

  function buildInitService() {
    const promptPasswordVerify = jest.fn(async () => ({
      password: 'prompted-pwd',
    }));
    const serviceAccount = {
      generateAllHdAndQrWalletsHashAndXfp: jest.fn(async () => undefined),
      mergeDuplicateHDWallets: jest.fn(async () => undefined),
      generateAllQrWalletsMissingXfp: jest.fn(async () => undefined),
      getAllWallets: jest.fn(async () => {
        throw stopAfterPasswordStage;
      }),
    };
    const service = new ServicePrimeCloudSync({
      backgroundApi: {
        servicePassword: { promptPasswordVerify },
        serviceAccount,
      },
    });
    return { service, promptPasswordVerify, serviceAccount };
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('init with nothing to fill never asks and skips the HD steps', async () => {
    const { service, promptPasswordVerify, serviceAccount } =
      buildInitService();
    await expect(
      service.initLocalSyncItemsDB({
        syncCredential: hardwareKey,
        askPasswordOnlyIfHdXfpMissing: true,
      }),
    ).rejects.toBe(stopAfterPasswordStage);
    expect(promptPasswordVerify).not.toHaveBeenCalled();
    expect(
      serviceAccount.generateAllHdAndQrWalletsHashAndXfp,
    ).not.toHaveBeenCalled();
    expect(serviceAccount.mergeDuplicateHDWallets).not.toHaveBeenCalled();
    // QR wallets need no password for their xfp.
    expect(serviceAccount.generateAllQrWalletsMissingXfp).toHaveBeenCalled();
  });

  test('init with a given password still runs the HD steps', async () => {
    const { service, promptPasswordVerify, serviceAccount } =
      buildInitService();
    await expect(
      service.initLocalSyncItemsDB({
        syncCredential: hardwareKey,
        password: 'pwd',
      }),
    ).rejects.toBe(stopAfterPasswordStage);
    expect(promptPasswordVerify).not.toHaveBeenCalled();
    expect(
      serviceAccount.generateAllHdAndQrWalletsHashAndXfp,
    ).toHaveBeenCalledWith({ password: 'pwd' });
    expect(serviceAccount.mergeDuplicateHDWallets).toHaveBeenCalledWith({
      password: 'pwd',
    });
    expect(
      serviceAccount.generateAllQrWalletsMissingXfp,
    ).not.toHaveBeenCalled();
  });

  test.each([
    ['Keyless', keylessKey],
    ['hardware', hardwareKey],
  ])('other callers with a %s key still ask as before', async (_, key) => {
    const { service, promptPasswordVerify, serviceAccount } =
      buildInitService();
    await expect(
      service.initLocalSyncItemsDB({ syncCredential: key }),
    ).rejects.toBe(stopAfterPasswordStage);
    expect(promptPasswordVerify).toHaveBeenCalledTimes(1);
    expect(
      serviceAccount.generateAllHdAndQrWalletsHashAndXfp,
    ).toHaveBeenCalledWith({ password: 'prompted-pwd' });
  });

  test.each([
    [false, undefined],
    [true, 'prompted-pwd'],
  ])(
    'hardware key with HD wallets to fill=%s asks before the HD steps',
    async (missing, expected) => {
      const { service, promptPasswordVerify } = buildInitService();
      Object.assign(
        (service as unknown as { backgroundApi: { serviceAccount: object } })
          .backgroundApi.serviceAccount,
        { hasHdWalletsMissingHashOrXfp: jest.fn(async () => missing) },
      );
      await expect(service.resolvePasswordOnlyIfHdXfpMissing()).resolves.toBe(
        expected,
      );
      expect(promptPasswordVerify).toHaveBeenCalledTimes(missing ? 1 : 0);
    },
  );

  test('Sync now with a hardware key and nothing to fill does not ask', async () => {
    const { service, promptPasswordVerify } = buildService({
      syncCredential: hardwareKey,
    });
    Object.assign(
      (service as unknown as { backgroundApi: { serviceAccount?: object } })
        .backgroundApi,
      {
        serviceAccount: {
          hasHdWalletsMissingHashOrXfp: jest.fn(async () => false),
        },
      },
    );
    await expect(
      service.syncNowKeyless({
        callerName: 'Manual hardware Cloud sync',
        askPasswordOnlyIfHdXfpMissing: true,
      }),
    ).resolves.toBe(true);
    expect(promptPasswordVerify).not.toHaveBeenCalled();
    expect(service.initLocalSyncItemsDB).toHaveBeenCalledWith({
      syncCredential: hardwareKey,
      password: undefined,
      askPasswordOnlyIfHdXfpMissing: true,
    });
  });

  test('other Sync now callers with a hardware key ask as before', async () => {
    const { service, promptPasswordVerify } = buildService({
      syncCredential: hardwareKey,
    });
    await expect(service.syncNowKeyless()).resolves.toBe(true);
    expect(promptPasswordVerify).toHaveBeenCalledTimes(1);
  });
});

describe('ServicePrimeCloudSync flush pushes outside OneKey ID sync', () => {
  const flush = {
    msgId: 'public-test-msg',
    pwdHash: 'keyless-pwd-hash',
  } as Parameters<ServicePrimeCloudSync['onWebSocketMasterPasswordChanged']>[0];

  test.each([
    ['Keyless sync', ECloudSyncMode.Keyless],
    ['sync off', ECloudSyncMode.None],
  ])('%s never raises the OneKey ID master password alert', async (_, mode) => {
    jest.mocked(primeCloudSyncPersistAtom.get).mockResolvedValue({
      isCloudSyncEnabled: false,
      isCloudSyncEnabledKeyless: mode === ECloudSyncMode.Keyless,
    });
    // A master password UUID left from earlier OneKey ID sync.
    Object.assign(primeMasterPasswordPersistAtom, {
      get: jest.fn(async () => ({ masterPasswordUUID: 'old-master-uuid' })),
    });
    const service = new ServicePrimeCloudSync({
      backgroundApi: {
        serviceKeylessCloudSync: {
          getActiveSyncMode: jest.fn(async () => mode),
        },
      },
    });
    const alert = jest
      .spyOn(service, 'showAlertDialogIfLocalPasswordInvalid')
      .mockResolvedValue(undefined);
    await service.onWebSocketMasterPasswordChanged(flush);
    expect(alert).not.toHaveBeenCalled();
  });

  test('OneKey ID sync still checks the master password', async () => {
    jest.mocked(primeCloudSyncPersistAtom.get).mockResolvedValue({
      isCloudSyncEnabled: true,
      isCloudSyncEnabledKeyless: false,
    });
    Object.assign(primeMasterPasswordPersistAtom, {
      get: jest.fn(async () => ({ masterPasswordUUID: 'old-master-uuid' })),
    });
    const service = new ServicePrimeCloudSync({
      backgroundApi: {
        serviceKeylessCloudSync: {
          getActiveSyncMode: jest.fn(async () => ECloudSyncMode.OnekeyId),
        },
      },
    });
    const alert = jest
      .spyOn(service, 'showAlertDialogIfLocalPasswordInvalid')
      .mockResolvedValue(undefined);
    await service.onWebSocketMasterPasswordChanged(flush);
    expect(alert).toHaveBeenCalledTimes(1);
  });
});
