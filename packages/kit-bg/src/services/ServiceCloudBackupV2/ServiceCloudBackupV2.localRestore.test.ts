/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import { webcrypto } from 'crypto';

import {
  ESecretEncryptPayloadFormat,
  decryptAsyncWithMetadata,
  encryptAsync,
} from '@onekeyhq/core/src/secret';
import { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import type {
  IBackupDataEncryptedPayload,
  IBackupProviderAccountInfo,
} from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import cache from './localBackupPasswordCache';
import ServiceCloudBackupV2 from './ServiceCloudBackupV2';

const mockProvider = {
  getCloudAccountInfo: jest.fn<Promise<IBackupProviderAccountInfo>, []>(),
  checkAvailability: jest.fn(),
  setBackupPassword: jest.fn(),
  verifyBackupPassword: jest.fn(),
  clearBackupPassword: jest.fn(),
  backupData: jest.fn<
    Promise<{ recordID: string; content: string }>,
    [IBackupDataEncryptedPayload]
  >(),
  downloadData: jest.fn(),
  getAllBackups: jest.fn(),
  deleteBackup: jest.fn(),
};

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const passthroughDecorator =
    () =>
    (...args: unknown[]) =>
      args.length === 1 ? args[0] : args[2];
  return {
    backgroundClass: passthroughDecorator,
    backgroundMethod: passthroughDecorator,
    toastIfError: passthroughDecorator,
  };
});
jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;
    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('./backupProviders/OneKeyBackupProvider', () => ({
  OneKeyBackupProvider: jest.fn(() => mockProvider),
}));
jest.mock('../../states/jotai/atoms/cloudBackup', () => ({
  cloudBackupStatusAtom: {},
}));
jest.mock('./localBackupPasswordCache', () => ({
  __esModule: true,
  default: { get: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));

const accountInfo: IBackupProviderAccountInfo = {
  userId: 'synthetic-cloudkit-account',
  userEmail: '',
  providerType: ECloudBackupProviderType.iCloud,
};

const data: IPrimeTransferData = {
  privateData: {
    credentials: {},
    decryptedCredentials: { fixture: { privateKey: 'synthetic-private-key' } },
    importedAccounts: {},
    watchingAccounts: {},
    wallets: {},
  },
  publicData: {
    dataTime: 1,
    totalWalletsCount: 0,
    totalAccountsCount: 0,
    walletDetails: [],
  },
  appVersion: 'test',
  isEmptyData: false,
  isWatchingOnly: false,
};

describe('local iCloud restore integration', () => {
  const originalIOS = platformEnv.isNativeIOS;
  const originalAndroid = platformEnv.isNativeAndroid;
  const originalDesktopMac = platformEnv.isDesktopMac;
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'crypto',
  );
  const password = 'synthetic-backup-password';
  const recordId = 'synthetic-backup';
  const selectedTransferData = {
    wallets: [{ credentialDecrypted: { privateKey: 'synthetic-private-key' } }],
  };
  const transfer = {
    isImportTaskActive: jest.fn(),
    getSelectedTransferData: jest.fn(),
    initImportProgress: jest.fn(),
    startImport: jest.fn(),
    completeImportProgress: jest.fn(),
    resetImportProgress: jest.fn(),
    decryptTransferDataCredentials: jest.fn(),
  };
  const promptPasswordVerify = jest.fn();
  const updateBackupStatus = jest.fn();
  const cached = jest.mocked(cache);
  let payload: IBackupDataEncryptedPayload;
  let service: ServiceCloudBackupV2;

  beforeAll(async () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
    const encrypted = await encryptAsync({
      data: Buffer.from(stringUtils.stableStringify(data.privateData)),
      password: `${accountInfo.userId}:${password}:4A561E9E-E747-4AFF-B835-FE2EF2D61B41`,
      allowRawPassword: true,
      format: ESecretEncryptPayloadFormat.legacy,
    });
    const { privateData: _privateData, ...publicFields } = data;
    payload = {
      ...publicFields,
      privateDataEncrypted: encrypted.toString('base64'),
    };
  });
  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockProvider).forEach((mock) => mock.mockReset());
    Object.values(transfer).forEach((mock) => mock.mockReset());
    cached.get.mockReset();
    cached.set.mockReset();
    cached.remove.mockReset();
    promptPasswordVerify.mockReset();
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    platformEnv.isNativeIOS = true;
    platformEnv.isNativeAndroid = false;
    platformEnv.isDesktopMac = false;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(ServiceCloudBackupV2.prototype, 'init').mockResolvedValue();
    mockProvider.getCloudAccountInfo.mockResolvedValue({ ...accountInfo });
    mockProvider.downloadData.mockImplementation(async () => ({
      payload,
      content: stringUtils.stableStringify(payload),
    }));
    mockProvider.setBackupPassword.mockResolvedValue({
      recordID: 'password-verify-record',
    });
    mockProvider.verifyBackupPassword.mockResolvedValue(true);
    cached.get.mockResolvedValue(undefined);
    cached.set.mockResolvedValue();
    cached.remove.mockResolvedValue();
    transfer.isImportTaskActive.mockResolvedValue(true);
    transfer.getSelectedTransferData.mockResolvedValue(selectedTransferData);
    transfer.startImport.mockResolvedValue({
      success: true,
      errorsInfo: {},
      taskUUID: 'import-task',
    });
    promptPasswordVerify.mockResolvedValue({
      password: 'synthetic-local-password',
    });
    service = new ServiceCloudBackupV2({
      backgroundApi: {
        servicePrimeTransfer: transfer,
        servicePassword: { promptPasswordVerify },
        serviceAccount: {
          updateHdWalletsBackedUpStatusForCloudBackup: updateBackupStatus,
        },
      },
    });
    jest
      .spyOn(service, 'getCloudAccountInfo')
      .mockImplementation(() => mockProvider.getCloudAccountInfo());
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    platformEnv.isNativeIOS = originalIOS;
    platformEnv.isNativeAndroid = originalAndroid;
    platformEnv.isDesktopMac = originalDesktopMac;
    jest.restoreAllMocks();
  });
  afterAll(() => {
    if (cryptoDescriptor)
      Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
    else Reflect.deleteProperty(globalThis, 'crypto');
  });

  async function prepareCached() {
    cached.get.mockResolvedValueOnce(password);
    const prepared = await service.prepareLocalRestore({ recordId });
    expect(prepared).not.toBeNull();
    if (!prepared) throw new OneKeyLocalError('Expected a prepared restore');
    return prepared;
  }

  function readUploadedBackup() {
    const [uploaded] = mockProvider.backupData.mock.calls[0];
    return {
      payload: uploaded,
      content: stringUtils.stableStringify(uploaded),
    };
  }

  function mockSuccessfulBackup() {
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    mockProvider.backupData.mockImplementation(async (uploaded) => ({
      recordID: recordId,
      content: stringUtils.stableStringify(uploaded),
    }));
    mockProvider.downloadData.mockImplementation(async () =>
      readUploadedBackup(),
    );
    mockProvider.getAllBackups.mockResolvedValue({
      items: [{ recordID: recordId }],
      total: 1,
    });
  }

  it('decrypts in bg, returns only a one-use handle, and preserves local password authorization', async () => {
    const prepared = await prepareCached();
    expect(Object.keys(prepared)).toEqual(['restoreId']);
    expect(transfer.startImport).not.toHaveBeenCalled();
    expect(
      await service.restorePreparedLocalBackup({
        ...prepared,
        taskUUID: 'import-task',
      }),
    ).toEqual({
      success: true,
    });
    expect(promptPasswordVerify).toHaveBeenCalledTimes(1);
    expect(transfer.getSelectedTransferData).toHaveBeenCalledWith({
      data: { ...payload, privateData: data.privateData },
      selectedItemMap: 'ALL',
    });
    expect(transfer.startImport).toHaveBeenCalledWith(
      expect.objectContaining({
        password: 'synthetic-local-password',
        localPassword: 'synthetic-local-password',
        isFromCloudBackupRestore: true,
      }),
    );
    expect(
      await service.restorePreparedLocalBackup({
        ...prepared,
        taskUUID: 'import-task',
      }),
    ).toBeNull();
    expect(transfer.startImport).toHaveBeenCalledTimes(1);
  });

  describe.each(['iOS', 'Android'])('%s restore record binding', (platform) => {
    beforeEach(() => {
      platformEnv.isNativeIOS = platform === 'iOS';
      platformEnv.isNativeAndroid = platform === 'Android';
      mockProvider.getCloudAccountInfo.mockResolvedValue({
        ...accountInfo,
        providerType:
          platform === 'iOS'
            ? ECloudBackupProviderType.iCloud
            : ECloudBackupProviderType.GoogleDrive,
      });
    });

    it.each([undefined, password])(
      'uses the downloaded record instead of caller-supplied data (password: %s)',
      async (manualPassword) => {
        const unrelatedPrivateData = {
          ...data.privateData,
          decryptedCredentials: {
            unrelated: { privateKey: 'synthetic-unrelated-private-key' },
          },
        };
        const encrypted = await encryptAsync({
          data: Buffer.from(stringUtils.stableStringify(unrelatedPrivateData)),
          password: `${accountInfo.userId}:${password}:4A561E9E-E747-4AFF-B835-FE2EF2D61B41`,
          allowRawPassword: true,
          format: ESecretEncryptPayloadFormat.legacy,
        });
        // A bridge caller can send extra fields regardless of the TypeScript signature.
        const untrustedRequest = {
          recordId,
          password: manualPassword,
          payload: {
            ...payload,
            publicData: { ...payload.publicData, dataTime: 999 },
            privateDataEncrypted: encrypted.toString('base64'),
          },
        };
        cached.get.mockResolvedValue(password);
        const prepared = await service.prepareLocalRestore(untrustedRequest);
        if (!prepared)
          throw new OneKeyLocalError('Expected a prepared restore');
        await service.restorePreparedLocalBackup({
          ...prepared,
          taskUUID: 'import-task',
        });
        expect(transfer.getSelectedTransferData).toHaveBeenCalledWith({
          data: { ...payload, privateData: data.privateData },
          selectedItemMap: 'ALL',
        });
        expect(mockProvider.downloadData).toHaveBeenCalledWith({ recordId });
      },
    );

    it.each([undefined, password])(
      'does not cache or prepare data after an account switch during decryption (password: %s)',
      async (manualPassword) => {
        cached.get.mockResolvedValue(password);
        const buildPassword = service.buildFullBackupPassword.bind(service);
        jest
          .spyOn(service, 'buildFullBackupPassword')
          .mockImplementationOnce(async (params, cloudAccount) => {
            const fullPassword = await buildPassword(params, cloudAccount);
            mockProvider.getCloudAccountInfo.mockResolvedValue({
              ...accountInfo,
              userId: 'another-cloud-account',
            });
            return fullPassword;
          });
        const preparation = service.prepareLocalRestore({
          recordId,
          password: manualPassword,
        });
        if (manualPassword === undefined) {
          expect(await preparation).toBeNull();
        } else {
          await expect(preparation).rejects.toThrow('Cloud account changed');
        }
        expect(cached.set).not.toHaveBeenCalled();
        expect(cached.remove).not.toHaveBeenCalled();
        expect(transfer.startImport).not.toHaveBeenCalled();
      },
    );

    it.each(['missing record', 'download failure', 'account change'])(
      'does not use caller data or cached passwords after %s',
      async (failure) => {
        if (failure === 'missing record') {
          mockProvider.downloadData.mockResolvedValue(null);
        } else if (failure === 'download failure') {
          mockProvider.downloadData.mockRejectedValue(
            new Error('Download failed'),
          );
        } else {
          mockProvider.downloadData.mockImplementation(async () => {
            mockProvider.getCloudAccountInfo.mockResolvedValue({
              ...accountInfo,
              providerType:
                platform === 'iOS'
                  ? ECloudBackupProviderType.iCloud
                  : ECloudBackupProviderType.GoogleDrive,
              userId: 'another-cloud-account',
            });
            return { payload, content: stringUtils.stableStringify(payload) };
          });
        }
        cached.get.mockResolvedValue(password);
        const untrustedRequest = { recordId, payload };
        expect(await service.prepareLocalRestore(untrustedRequest)).toBeNull();
        expect(cached.get).not.toHaveBeenCalled();
        expect(cached.set).not.toHaveBeenCalled();
        expect(cached.remove).not.toHaveBeenCalled();
        expect(transfer.startImport).not.toHaveBeenCalled();
      },
    );
  });

  it.each(['before import', 'during selection', 'during authorization'])(
    'does not import a prepared backup when its task is cancelled %s',
    async (stage) => {
      const prepared = await prepareCached();
      if (stage === 'before import') {
        transfer.isImportTaskActive.mockResolvedValue(false);
      } else if (stage === 'during selection') {
        transfer.getSelectedTransferData.mockImplementationOnce(async () => {
          transfer.isImportTaskActive.mockResolvedValue(false);
          return selectedTransferData;
        });
      } else {
        promptPasswordVerify.mockImplementationOnce(async () => {
          transfer.isImportTaskActive.mockResolvedValue(false);
          return { password: 'synthetic-local-password' };
        });
      }
      expect(
        await service.restorePreparedLocalBackup({
          ...prepared,
          taskUUID: 'cancelled-task',
        }),
      ).toEqual({ success: false });
      expect(promptPasswordVerify).toHaveBeenCalledTimes(
        stage === 'during authorization' ? 1 : 0,
      );
      expect(transfer.initImportProgress).not.toHaveBeenCalled();
      expect(transfer.startImport).not.toHaveBeenCalled();
      expect(transfer.completeImportProgress).not.toHaveBeenCalled();
      expect(transfer.resetImportProgress).not.toHaveBeenCalled();
    },
  );

  it('falls back for a wrong cached password, rejects wrong manual input, then refreshes after successful manual input', async () => {
    cached.get.mockResolvedValueOnce('wrong-cached-password');
    expect(await service.prepareLocalRestore({ recordId })).toBeNull();
    expect(cached.remove).toHaveBeenCalledWith({
      providerType: accountInfo.providerType,
      accountId: accountInfo.userId,
      recordId,
    });
    await expect(
      service.prepareLocalRestore({
        recordId,
        password: 'wrong-manual-password',
      }),
    ).rejects.toThrow();
    expect(cached.set).not.toHaveBeenCalled();
    const prepared = await service.prepareLocalRestore({
      recordId,
      password,
    });
    expect(prepared).not.toBeNull();
    expect(cached.set).toHaveBeenCalledWith({
      providerType: accountInfo.providerType,
      accountId: accountInfo.userId,
      recordId,
      password,
    });
  });

  it('tries the current password after a stale record entry, but retains a current password that fails on an older backup', async () => {
    cached.get
      .mockResolvedValueOnce('stale-record-password')
      .mockResolvedValueOnce(password);
    expect(await service.prepareLocalRestore({ recordId })).not.toBeNull();
    expect(cached.set).toHaveBeenCalledWith({
      providerType: accountInfo.providerType,
      accountId: accountInfo.userId,
      recordId,
      password,
    });
    cached.get
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('new-current-password');
    cached.remove.mockClear();
    expect(
      await service.prepareLocalRestore({ recordId: 'older-backup' }),
    ).toBeNull();
    expect(cached.remove).not.toHaveBeenCalled();
  });

  it('treats cache failures as optional without hiding local authorization or import failures', async () => {
    cached.get.mockRejectedValueOnce(new Error('Keychain unavailable'));
    expect(await service.prepareLocalRestore({ recordId })).toBeNull();
    cached.set.mockRejectedValueOnce(new Error('Storage unavailable'));
    const prepared = await service.prepareLocalRestore({
      recordId,
      password,
    });
    if (!prepared) throw new OneKeyLocalError('Expected a prepared restore');
    promptPasswordVerify.mockRejectedValueOnce(
      new Error('User canceled local authorization'),
    );
    await expect(
      service.restorePreparedLocalBackup({
        ...prepared,
        taskUUID: 'import-task',
      }),
    ).rejects.toThrow('User canceled');
    expect(transfer.startImport).not.toHaveBeenCalled();
    const retry = await prepareCached();
    transfer.startImport.mockRejectedValueOnce(new Error('Import failed'));
    await expect(
      service.restorePreparedLocalBackup({ ...retry, taskUUID: 'import-task' }),
    ).rejects.toThrow('Import failed');
    expect(transfer.resetImportProgress).toHaveBeenCalledTimes(2);
    expect(
      await service.restorePreparedLocalBackup({
        ...retry,
        taskUUID: 'import-task',
      }),
    ).toBeNull();
  });

  it('expires prepared data and refuses to consume it after an account change', async () => {
    const expired = await prepareCached();
    jest.advanceTimersByTime(60_001);
    expect(
      await service.restorePreparedLocalBackup({
        ...expired,
        taskUUID: 'import-task',
      }),
    ).toBeNull();
    const changedAccount = await prepareCached();
    mockProvider.getCloudAccountInfo.mockResolvedValue({
      ...accountInfo,
      userId: 'another-account',
    });
    expect(
      await service.restorePreparedLocalBackup({
        ...changedAccount,
        taskUUID: 'import-task',
      }),
    ).toBeNull();
    expect(transfer.startImport).not.toHaveBeenCalled();
  });

  it('updates the current password only after successful set or verification and keeps failed operations out of the cache', async () => {
    await service.setBackupPassword({ password });
    expect(cached.set).toHaveBeenLastCalledWith({
      providerType: accountInfo.providerType,
      accountId: accountInfo.userId,
      recordId: undefined,
      password,
    });
    await service.verifyBackupPassword({ password: 'changed-password' });
    expect(cached.set).toHaveBeenLastCalledWith({
      providerType: accountInfo.providerType,
      accountId: accountInfo.userId,
      recordId: undefined,
      password: 'changed-password',
    });
    cached.set.mockClear();
    mockProvider.verifyBackupPassword.mockResolvedValueOnce(false);
    expect(
      await service.verifyBackupPassword({ password: 'wrong-password' }),
    ).toBe(false);
    mockProvider.setBackupPassword.mockRejectedValueOnce(
      new Error('Cloud write failed'),
    );
    await expect(service.setBackupPassword({ password })).rejects.toThrow();
    expect(cached.set).not.toHaveBeenCalled();
  });

  it('caches a successfully verified uploaded backup without changing the cloud payload format', async () => {
    mockSuccessfulBackup();
    await service.backup({ data, password });
    expect(cached.set).toHaveBeenCalledWith({
      providerType: accountInfo.providerType,
      accountId: accountInfo.userId,
      recordId,
      password,
    });
    expect(updateBackupStatus).toHaveBeenCalledTimes(1);
    const [uploaded] = mockProvider.backupData.mock.calls[0];
    const envelope = await decryptAsyncWithMetadata({
      data: Buffer.from(uploaded.privateDataEncrypted, 'base64'),
      password: await service.buildFullBackupPassword({ password }),
      allowRawPassword: true,
    });
    expect(envelope.format).toBe(ESecretEncryptPayloadFormat.legacy);
    expect(
      await service.restorePreparePrivateData({ payload: uploaded, password }),
    ).toEqual(data.privateData);
  });

  it('binds password setup to its initial account and rejects a switch before caching success', async () => {
    mockProvider.setBackupPassword.mockImplementationOnce(async () => {
      mockProvider.getCloudAccountInfo.mockResolvedValue({
        ...accountInfo,
        userId: 'another-cloudkit-account',
      });
      return { recordID: 'password-verify-record' };
    });
    await expect(service.setBackupPassword({ password })).rejects.toThrow(
      'Cloud account changed',
    );
    expect(mockProvider.setBackupPassword).toHaveBeenCalledWith({
      password: `${accountInfo.userId}:${password}:4A561E9E-E747-4AFF-B835-FE2EF2D61B41`,
      expectedAccountId: accountInfo.userId,
    });
    expect(cached.set).not.toHaveBeenCalled();
  });

  it.each(['password reset', 'record deletion'])(
    'clears only the original account cache when the account switches during %s',
    async (operation) => {
      const remoteOperation =
        operation === 'password reset'
          ? mockProvider.clearBackupPassword
          : mockProvider.deleteBackup;
      remoteOperation.mockImplementationOnce(async () => {
        mockProvider.getCloudAccountInfo.mockResolvedValue({
          ...accountInfo,
          userId: 'another-cloudkit-account',
        });
      });
      if (operation === 'password reset') await service.clearBackupPassword();
      else await service.deleteSilently({ recordId });
      expect(cached.remove).toHaveBeenCalledTimes(1);
      expect(cached.remove).toHaveBeenCalledWith({
        providerType: accountInfo.providerType,
        accountId: accountInfo.userId,
        recordId: operation === 'password reset' ? undefined : recordId,
      });
    },
  );

  it('does not block remote password reset if the optional cache account cannot be read', async () => {
    mockProvider.getCloudAccountInfo.mockRejectedValueOnce(
      new Error('Account lookup unavailable'),
    );
    await expect(service.clearBackupPassword()).resolves.toBeUndefined();
    expect(mockProvider.clearBackupPassword).toHaveBeenCalledTimes(1);
    expect(cached.remove).not.toHaveBeenCalled();
  });

  it('keeps the current password cache if remote password reset fails', async () => {
    mockProvider.clearBackupPassword.mockRejectedValueOnce(
      new Error('Remote reset failed'),
    );
    await expect(service.clearBackupPassword()).rejects.toThrow(
      'Remote reset failed',
    );
    expect(cached.remove).not.toHaveBeenCalled();
  });

  it.each([
    'authorization',
    'macOS authorization',
    'encryption',
    'upload',
    'readback',
    'mismatched readback',
    'listing',
    'sign-out',
  ] as const)(
    'refuses backup success after an account change during %s',
    async (stage) => {
      if (stage === 'macOS authorization') {
        platformEnv.isNativeIOS = false;
        platformEnv.isDesktopMac = true;
      }
      mockSuccessfulBackup();
      let currentAccountId = accountInfo.userId;
      const changeAccount = () => {
        currentAccountId =
          stage === 'sign-out' ? '' : 'another-cloudkit-account';
      };
      mockProvider.getCloudAccountInfo.mockImplementation(async () => ({
        ...accountInfo,
        userId: currentAccountId,
      }));
      transfer.decryptTransferDataCredentials.mockImplementation(
        async ({ data: backupData }: { data: IPrimeTransferData }) => {
          await promptPasswordVerify();
          if (
            stage === 'authorization' ||
            stage === 'macOS authorization' ||
            stage === 'sign-out'
          )
            changeAccount();
          backupData.privateData.decryptedCredentials =
            data.privateData.decryptedCredentials;
          backupData.privateData.credentials = {};
        },
      );
      if (stage === 'encryption') {
        const buildPassword = service.buildFullBackupPassword.bind(service);
        jest
          .spyOn(service, 'buildFullBackupPassword')
          .mockImplementationOnce(async (params, cloudAccount) => {
            const fullPassword = await buildPassword(params, cloudAccount);
            changeAccount();
            return fullPassword;
          });
      } else if (stage === 'upload') {
        mockProvider.backupData.mockImplementationOnce(async (uploaded) => {
          changeAccount();
          return {
            recordID: recordId,
            content: stringUtils.stableStringify(uploaded),
          };
        });
      } else if (stage === 'readback' || stage === 'mismatched readback') {
        mockProvider.downloadData.mockImplementationOnce(async () => {
          changeAccount();
          const backup = readUploadedBackup();
          return stage === 'mismatched readback'
            ? { ...backup, content: 'different-encrypted-content' }
            : backup;
        });
      } else if (stage === 'listing') {
        mockProvider.getAllBackups.mockImplementationOnce(async () => {
          changeAccount();
          return { items: [{ recordID: recordId }], total: 1 };
        });
      }
      const wrappedData: IPrimeTransferData = {
        ...data,
        privateData: {
          ...data.privateData,
          decryptedCredentials: undefined,
          credentials: { fixture: 'synthetic-wrapped-credential' },
        },
      };
      await expect(
        service.backup({ data: wrappedData, password }),
      ).rejects.toThrow('Cloud account changed');
      expect(promptPasswordVerify).toHaveBeenCalledTimes(1);
      expect(mockProvider.backupData).toHaveBeenCalledTimes(
        stage === 'authorization' ||
          stage === 'macOS authorization' ||
          stage === 'encryption' ||
          stage === 'sign-out'
          ? 0
          : 1,
      );
      expect(updateBackupStatus).not.toHaveBeenCalled();
      expect(cached.set).not.toHaveBeenCalled();
      expect(mockProvider.deleteBackup).not.toHaveBeenCalled();
    },
  );

  it('stops before upload if the account cannot be revalidated after authorization', async () => {
    mockSuccessfulBackup();
    transfer.decryptTransferDataCredentials.mockImplementationOnce(async () => {
      mockProvider.getCloudAccountInfo.mockRejectedValueOnce(
        new Error('Cloud account unavailable'),
      );
    });
    await expect(service.backup({ data, password })).rejects.toThrow(
      'Cloud account unavailable',
    );
    expect(mockProvider.backupData).not.toHaveBeenCalled();
    expect(updateBackupStatus).not.toHaveBeenCalled();
    expect(cached.set).not.toHaveBeenCalled();
  });

  it.each(['encryption', 'upload', 'readback', 'listing', 'sign-out'])(
    'refuses Google backup success after account changes during %s',
    async (stage) => {
      platformEnv.isNativeIOS = false;
      platformEnv.isNativeAndroid = true;
      mockSuccessfulBackup();
      let currentAccountId = 'synthetic-google-account-a';
      mockProvider.getCloudAccountInfo.mockImplementation(async () => ({
        ...accountInfo,
        providerType: ECloudBackupProviderType.GoogleDrive,
        userId: currentAccountId,
      }));
      const changeAccount = () => {
        currentAccountId =
          stage === 'sign-out' ? '' : 'synthetic-google-account-b';
      };
      if (stage === 'encryption' || stage === 'sign-out') {
        const buildPassword = service.buildFullBackupPassword.bind(service);
        jest
          .spyOn(service, 'buildFullBackupPassword')
          .mockImplementationOnce(async (params, cloudAccount) => {
            const fullPassword = await buildPassword(params, cloudAccount);
            changeAccount();
            return fullPassword;
          });
      } else if (stage === 'upload') {
        mockProvider.backupData.mockImplementationOnce(async (uploaded) => {
          changeAccount();
          return {
            recordID: recordId,
            content: stringUtils.stableStringify(uploaded),
          };
        });
      } else if (stage === 'readback') {
        mockProvider.downloadData.mockImplementationOnce(async () => {
          changeAccount();
          return readUploadedBackup();
        });
      } else {
        mockProvider.getAllBackups.mockImplementationOnce(async () => {
          changeAccount();
          return { items: [{ recordID: recordId }], total: 1 };
        });
      }
      await expect(service.backup({ data, password })).rejects.toThrow(
        'account changed',
      );
      expect(updateBackupStatus).not.toHaveBeenCalled();
      expect(cached.set).not.toHaveBeenCalled();
      expect(mockProvider.deleteBackup).not.toHaveBeenCalled();
      if (stage === 'encryption' || stage === 'sign-out') {
        expect(mockProvider.backupData).not.toHaveBeenCalled();
      }
    },
  );

  it('keeps non-native Google backup calls independent of native caching', async () => {
    platformEnv.isNativeIOS = false;
    mockProvider.getCloudAccountInfo.mockResolvedValue({
      ...accountInfo,
      providerType: ECloudBackupProviderType.GoogleDrive,
    });
    mockSuccessfulBackup();
    await expect(service.backup({ data, password })).resolves.toMatchObject({
      recordID: recordId,
    });
    expect(mockProvider.getCloudAccountInfo).toHaveBeenCalled();
    expect(updateBackupStatus).toHaveBeenCalledTimes(1);
    expect(cached.set).not.toHaveBeenCalled();
  });

  it('keeps non-native Google password operations independent of native caching', async () => {
    platformEnv.isNativeIOS = false;
    mockProvider.getCloudAccountInfo.mockResolvedValue({
      ...accountInfo,
      providerType: ECloudBackupProviderType.GoogleDrive,
    });
    await expect(service.setBackupPassword({ password })).resolves.toEqual({
      recordID: 'password-verify-record',
    });
    expect(mockProvider.setBackupPassword).toHaveBeenCalledWith({
      password: `${accountInfo.userId}:${password}:4A561E9E-E747-4AFF-B835-FE2EF2D61B41`,
    });
    await service.clearBackupPassword();
    expect(mockProvider.getCloudAccountInfo).toHaveBeenCalled();
    expect(mockProvider.clearBackupPassword).toHaveBeenCalledTimes(1);
    expect(cached.set).not.toHaveBeenCalled();
    expect(cached.remove).not.toHaveBeenCalled();
  });

  it('encrypts Google backups for the account selected during local authorization', async () => {
    platformEnv.isNativeIOS = false;
    platformEnv.isNativeAndroid = true;
    let currentAccountId = 'synthetic-google-account-a';
    mockProvider.getCloudAccountInfo.mockImplementation(async () => ({
      userId: currentAccountId,
      userEmail: '',
      providerType: ECloudBackupProviderType.GoogleDrive,
    }));
    mockSuccessfulBackup();
    promptPasswordVerify.mockImplementationOnce(async () => {
      currentAccountId = 'synthetic-google-account-b';
      return { password: 'synthetic-local-password' };
    });
    transfer.decryptTransferDataCredentials.mockImplementationOnce(
      async ({ data: backupData }: { data: IPrimeTransferData }) => {
        await promptPasswordVerify();
        backupData.privateData.decryptedCredentials =
          data.privateData.decryptedCredentials;
        backupData.privateData.credentials = {};
      },
    );
    const wrappedData: IPrimeTransferData = {
      ...data,
      privateData: {
        ...data.privateData,
        decryptedCredentials: undefined,
        credentials: { fixture: 'synthetic-wrapped-credential' },
      },
    };
    await expect(
      service.backup({ data: wrappedData, password }),
    ).resolves.toMatchObject({
      recordID: recordId,
    });
    expect(currentAccountId).toBe('synthetic-google-account-b');
    expect(promptPasswordVerify).toHaveBeenCalledTimes(1);
    expect(mockProvider.getCloudAccountInfo).toHaveBeenCalled();
    expect(updateBackupStatus).toHaveBeenCalledTimes(1);
    const uploaded = readUploadedBackup().payload;
    await expect(
      service.restorePreparePrivateData({
        payload: uploaded,
        password,
        recordId,
      }),
    ).resolves.toEqual(data.privateData);
    currentAccountId = 'synthetic-google-account-a';
    await expect(
      service.restorePreparePrivateData({
        payload: uploaded,
        password,
        recordId,
      }),
    ).rejects.toThrow();
    expect(cached.get).not.toHaveBeenCalled();
    expect(cached.set).toHaveBeenCalledWith({
      providerType: ECloudBackupProviderType.GoogleDrive,
      accountId: 'synthetic-google-account-b',
      recordId,
      password,
    });
    expect(
      cached.set.mock.calls.every(
        ([entry]) => entry.accountId === 'synthetic-google-account-b',
      ),
    ).toBe(true);
  });

  it('clears only the relevant cache entry after successful remote deletion or password reset', async () => {
    await service.deleteSilently({ recordId });
    expect(cached.remove).toHaveBeenLastCalledWith({
      providerType: accountInfo.providerType,
      accountId: accountInfo.userId,
      recordId,
    });
    await service.clearBackupPassword();
    expect(cached.remove).toHaveBeenLastCalledWith({
      providerType: accountInfo.providerType,
      accountId: accountInfo.userId,
      recordId: undefined,
    });
    cached.remove.mockClear();
    mockProvider.deleteBackup.mockRejectedValueOnce(
      new Error('Cloud unavailable'),
    );
    await expect(service.deleteSilently({ recordId })).rejects.toThrow();
    expect(cached.remove).not.toHaveBeenCalled();
  });

  it('rejects provider/platform mismatches and keeps non-native manual restore available', async () => {
    mockProvider.getCloudAccountInfo.mockResolvedValue({
      ...accountInfo,
      providerType: ECloudBackupProviderType.GoogleDrive,
    });
    expect(await service.prepareLocalRestore({ recordId })).toBeNull();
    await service.verifyBackupPassword({ password });
    platformEnv.isNativeIOS = false;
    expect(
      await service.prepareLocalRestore({ recordId, password }),
    ).toBeNull();
    expect(
      (
        await service.restore({
          recordId,
          payload,
          password,
          taskUUID: 'import-task',
        })
      ).success,
    ).toBe(true);
    expect(cached.get).not.toHaveBeenCalled();
    expect(cached.set).not.toHaveBeenCalled();
    expect(promptPasswordVerify).toHaveBeenCalledTimes(1);
  });
  describe('Android Google Drive', () => {
    const googleAccount = {
      userId: 'synthetic-google-account',
      userEmail: '',
      providerType: ECloudBackupProviderType.GoogleDrive,
    };
    const googleScope = {
      providerType: googleAccount.providerType,
      accountId: googleAccount.userId,
      recordId,
    };

    beforeEach(async () => {
      platformEnv.isNativeIOS = false;
      platformEnv.isNativeAndroid = true;
      mockProvider.getCloudAccountInfo.mockResolvedValue({ ...googleAccount });
      const encrypted = await encryptAsync({
        data: Buffer.from(stringUtils.stableStringify(data.privateData)),
        password: `${googleAccount.userId}:${password}:4A561E9E-E747-4AFF-B835-FE2EF2D61B41`,
        allowRawPassword: true,
        format: ESecretEncryptPayloadFormat.legacy,
      });
      const { privateData: _privateData, ...publicFields } = data;
      payload = {
        ...publicFields,
        privateDataEncrypted: encrypted.toString('base64'),
      };
    });

    it('uses a one-use background handle and still requires local wallet authorization', async () => {
      const prepared = await prepareCached();
      expect(cached.get).toHaveBeenCalledWith(googleScope);
      expect(Object.keys(prepared)).toEqual(['restoreId']);
      expect(
        await service.restorePreparedLocalBackup({
          ...prepared,
          taskUUID: 'import-task',
        }),
      ).toEqual({ success: true });
      expect(promptPasswordVerify).toHaveBeenCalledTimes(1);
      expect(transfer.getSelectedTransferData).toHaveBeenCalledWith({
        data: { ...payload, privateData: data.privateData },
        selectedItemMap: 'ALL',
      });
      expect(
        await service.restorePreparedLocalBackup({
          ...prepared,
          taskUUID: 'import-task',
        }),
      ).toBeNull();
      expect(transfer.startImport).toHaveBeenCalledTimes(1);
    });

    it('falls back after wrong cached passwords, rejects wrong manual input, and caches successful manual decryption', async () => {
      cached.get.mockResolvedValue('wrong-cached-password');
      expect(await service.prepareLocalRestore({ recordId })).toBeNull();
      expect(cached.remove).toHaveBeenCalledWith(googleScope);
      await expect(
        service.prepareLocalRestore({
          recordId,
          password: 'wrong-manual-password',
        }),
      ).rejects.toThrow();
      expect(cached.set).not.toHaveBeenCalled();
      expect(
        await service.prepareLocalRestore({ recordId, password }),
      ).toHaveProperty('restoreId');
      expect(cached.set).toHaveBeenCalledWith({ ...googleScope, password });
    });

    it('falls back when secure storage or the signed-in account is unavailable', async () => {
      cached.get.mockRejectedValueOnce(new Error('Keystore unavailable'));
      expect(await service.prepareLocalRestore({ recordId })).toBeNull();
      mockProvider.getCloudAccountInfo.mockResolvedValueOnce({
        ...googleAccount,
        userId: '',
      });
      expect(await service.prepareLocalRestore({ recordId })).toBeNull();
      expect(transfer.startImport).not.toHaveBeenCalled();
    });

    it.each(['account change', 'sign-out', 'expiry'])(
      'rejects a prepared Google restore after %s',
      async (reason) => {
        const prepared = await prepareCached();
        if (reason === 'expiry') jest.advanceTimersByTime(60_001);
        else
          mockProvider.getCloudAccountInfo.mockResolvedValue({
            ...googleAccount,
            userId: reason === 'sign-out' ? '' : 'another-google-account',
          });
        expect(
          await service.restorePreparedLocalBackup({
            ...prepared,
            taskUUID: 'import-task',
          }),
        ).toBeNull();
        expect(promptPasswordVerify).not.toHaveBeenCalled();
        expect(transfer.startImport).not.toHaveBeenCalled();
      },
    );

    it('updates the current Google password only after successful setup or verification', async () => {
      await service.setBackupPassword({ password });
      expect(mockProvider.setBackupPassword).toHaveBeenCalledWith({
        password: `${googleAccount.userId}:${password}:4A561E9E-E747-4AFF-B835-FE2EF2D61B41`,
      });
      expect(cached.set).toHaveBeenLastCalledWith({
        ...googleScope,
        recordId: undefined,
        password,
      });
      await service.verifyBackupPassword({ password: 'changed-password' });
      expect(cached.set).toHaveBeenLastCalledWith({
        ...googleScope,
        recordId: undefined,
        password: 'changed-password',
      });
      cached.set.mockClear();
      mockProvider.verifyBackupPassword.mockResolvedValueOnce(false);
      expect(
        await service.verifyBackupPassword({ password: 'wrong-password' }),
      ).toBe(false);
      mockProvider.setBackupPassword.mockRejectedValueOnce(
        new Error('Cloud write failed'),
      );
      await expect(service.setBackupPassword({ password })).rejects.toThrow(
        'Cloud write failed',
      );
      expect(cached.set).not.toHaveBeenCalled();
    });

    it('keeps cache write failures optional after successful manual decryption', async () => {
      cached.set.mockRejectedValueOnce(new Error('Keystore unavailable'));
      const prepared = await service.prepareLocalRestore({
        recordId,
        password,
      });
      if (!prepared) throw new OneKeyLocalError('Expected a prepared restore');
      expect(
        await service.restorePreparedLocalBackup({
          ...prepared,
          taskUUID: 'import-task',
        }),
      ).toEqual({ success: true });
    });

    it.each(['password reset', 'record deletion'])(
      'keeps cache removal scoped to the original Google account during %s',
      async (operation) => {
        const remoteOperation =
          operation === 'password reset'
            ? mockProvider.clearBackupPassword
            : mockProvider.deleteBackup;
        remoteOperation.mockImplementationOnce(async () => {
          mockProvider.getCloudAccountInfo.mockResolvedValue({
            ...googleAccount,
            userId: 'another-google-account',
          });
        });
        if (operation === 'password reset') await service.clearBackupPassword();
        else await service.deleteSilently({ recordId });
        expect(cached.remove).toHaveBeenCalledTimes(1);
        expect(cached.remove).toHaveBeenCalledWith({
          ...googleScope,
          recordId: operation === 'password reset' ? undefined : recordId,
        });
      },
    );

    it('does not suppress local authorization failures or import into a cancelled task', async () => {
      const prepared = await prepareCached();
      promptPasswordVerify.mockRejectedValueOnce(
        new Error('Authorization cancelled'),
      );
      await expect(
        service.restorePreparedLocalBackup({
          ...prepared,
          taskUUID: 'import-task',
        }),
      ).rejects.toThrow('Authorization cancelled');
      expect(transfer.resetImportProgress).toHaveBeenCalledWith({
        taskUUID: 'import-task',
      });
      const retry = await prepareCached();
      transfer.isImportTaskActive.mockResolvedValue(false);
      expect(
        await service.restorePreparedLocalBackup({
          ...retry,
          taskUUID: 'cancelled-task',
        }),
      ).toEqual({ success: false });
      expect(transfer.startImport).not.toHaveBeenCalled();
    });
  });
});
