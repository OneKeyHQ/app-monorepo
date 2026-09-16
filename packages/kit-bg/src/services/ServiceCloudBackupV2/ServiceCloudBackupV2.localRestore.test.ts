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
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(ServiceCloudBackupV2.prototype, 'init').mockResolvedValue();
    mockProvider.getCloudAccountInfo.mockResolvedValue({ ...accountInfo });
    mockProvider.setBackupPassword.mockResolvedValue({
      recordID: 'password-verify-record',
    });
    mockProvider.verifyBackupPassword.mockResolvedValue(true);
    cached.get.mockResolvedValue(undefined);
    cached.set.mockResolvedValue();
    cached.remove.mockResolvedValue();
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
    jest.restoreAllMocks();
  });
  afterAll(() => {
    if (cryptoDescriptor)
      Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
    else Reflect.deleteProperty(globalThis, 'crypto');
  });

  async function prepareCached() {
    cached.get.mockResolvedValueOnce(password);
    const prepared = await service.prepareLocalRestore({ recordId, payload });
    expect(prepared).not.toBeNull();
    if (!prepared) throw new OneKeyLocalError('Expected a prepared restore');
    return prepared;
  }

  it('decrypts in bg, returns only a one-use handle, and preserves local password authorization', async () => {
    const prepared = await prepareCached();
    expect(Object.keys(prepared)).toEqual(['restoreId']);
    expect(transfer.startImport).not.toHaveBeenCalled();
    expect(await service.restorePreparedLocalBackup(prepared)).toEqual({
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
    expect(await service.restorePreparedLocalBackup(prepared)).toBeNull();
    expect(transfer.startImport).toHaveBeenCalledTimes(1);
  });

  it('falls back for a wrong cached password, rejects wrong manual input, then refreshes after successful manual input', async () => {
    cached.get.mockResolvedValueOnce('wrong-cached-password');
    expect(await service.prepareLocalRestore({ recordId, payload })).toBeNull();
    expect(cached.remove).toHaveBeenCalledWith({
      accountId: accountInfo.userId,
      recordId,
    });
    await expect(
      service.prepareLocalRestore({
        recordId,
        payload,
        password: 'wrong-manual-password',
      }),
    ).rejects.toThrow();
    expect(cached.set).not.toHaveBeenCalled();
    const prepared = await service.prepareLocalRestore({
      recordId,
      payload,
      password,
    });
    expect(prepared).not.toBeNull();
    expect(cached.set).toHaveBeenCalledWith({
      accountId: accountInfo.userId,
      recordId,
      password,
    });
  });

  it('tries the current password after a stale record entry, but retains a current password that fails on an older backup', async () => {
    cached.get
      .mockResolvedValueOnce('stale-record-password')
      .mockResolvedValueOnce(password);
    expect(
      await service.prepareLocalRestore({ recordId, payload }),
    ).not.toBeNull();
    expect(cached.set).toHaveBeenCalledWith({
      accountId: accountInfo.userId,
      recordId,
      password,
    });
    cached.get
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('new-current-password');
    cached.remove.mockClear();
    expect(
      await service.prepareLocalRestore({ recordId: 'older-backup', payload }),
    ).toBeNull();
    expect(cached.remove).not.toHaveBeenCalled();
  });

  it('treats cache failures as optional without hiding local authorization or import failures', async () => {
    cached.get.mockRejectedValueOnce(new Error('Keychain unavailable'));
    expect(await service.prepareLocalRestore({ recordId, payload })).toBeNull();
    cached.set.mockRejectedValueOnce(new Error('Storage unavailable'));
    const prepared = await service.prepareLocalRestore({
      recordId,
      payload,
      password,
    });
    if (!prepared) throw new OneKeyLocalError('Expected a prepared restore');
    promptPasswordVerify.mockRejectedValueOnce(
      new Error('User canceled local authorization'),
    );
    await expect(service.restorePreparedLocalBackup(prepared)).rejects.toThrow(
      'User canceled',
    );
    expect(transfer.startImport).not.toHaveBeenCalled();
    const retry = await prepareCached();
    transfer.startImport.mockRejectedValueOnce(new Error('Import failed'));
    await expect(service.restorePreparedLocalBackup(retry)).rejects.toThrow(
      'Import failed',
    );
    expect(transfer.resetImportProgress).toHaveBeenCalledTimes(1);
    expect(await service.restorePreparedLocalBackup(retry)).toBeNull();
  });

  it('expires prepared data and refuses to consume it after an account change', async () => {
    const expired = await prepareCached();
    jest.advanceTimersByTime(60_001);
    expect(await service.restorePreparedLocalBackup(expired)).toBeNull();
    const changedAccount = await prepareCached();
    mockProvider.getCloudAccountInfo.mockResolvedValue({
      ...accountInfo,
      userId: 'another-account',
    });
    expect(await service.restorePreparedLocalBackup(changedAccount)).toBeNull();
    expect(transfer.startImport).not.toHaveBeenCalled();
  });

  it('updates the current password only after successful set or verification and keeps failed operations out of the cache', async () => {
    await service.setBackupPassword({ password });
    expect(cached.set).toHaveBeenLastCalledWith({
      accountId: accountInfo.userId,
      recordId: undefined,
      password,
    });
    await service.verifyBackupPassword({ password: 'changed-password' });
    expect(cached.set).toHaveBeenLastCalledWith({
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
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    mockProvider.backupData.mockResolvedValue({
      recordID: recordId,
      content: 'synthetic-encrypted-content',
    });
    mockProvider.downloadData.mockResolvedValue({
      payload,
      content: 'synthetic-encrypted-content',
    });
    mockProvider.getAllBackups.mockResolvedValue({
      items: [{ recordID: recordId }],
      total: 1,
    });
    await service.backup({ data, password });
    expect(cached.set).toHaveBeenCalledWith({
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

  it('clears only the relevant cache entry after successful remote deletion or password reset', async () => {
    await service.deleteSilently({ recordId });
    expect(cached.remove).toHaveBeenLastCalledWith({
      accountId: accountInfo.userId,
      recordId,
    });
    await service.clearBackupPassword();
    expect(cached.remove).toHaveBeenLastCalledWith({
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

  it('leaves Google Drive and non-iOS manual restore behavior unchanged', async () => {
    mockProvider.getCloudAccountInfo.mockResolvedValue({
      ...accountInfo,
      providerType: ECloudBackupProviderType.GoogleDrive,
    });
    expect(await service.prepareLocalRestore({ recordId, payload })).toBeNull();
    await service.verifyBackupPassword({ password });
    platformEnv.isNativeIOS = false;
    expect(
      await service.prepareLocalRestore({ recordId, payload, password }),
    ).toBeNull();
    expect(
      (await service.restore({ recordId, payload, password })).success,
    ).toBe(true);
    expect(cached.get).not.toHaveBeenCalled();
    expect(cached.set).not.toHaveBeenCalled();
    expect(promptPasswordVerify).toHaveBeenCalledTimes(1);
  });
});
