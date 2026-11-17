/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import type {
  IBackupDataEncryptedPayload,
  IBackupDataManifest,
} from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { googleDriveStorage } from '@onekeyhq/shared/src/storage/GoogleDriveStorage';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { GoogleDriveBackupProvider } from './GoogleDriveBackupProvider';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {},
}));
jest.mock('@onekeyhq/shared/src/googlePlayService/googlePlayService', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/storage/GoogleDriveStorage', () => ({
  googleDriveStorage: {
    isAvailable: jest.fn(),
    uploadFile: jest.fn(),
    getFileObject: jest.fn(),
    downloadFile: jest.fn(),
  },
}));

describe('Google Drive backup account consistency', () => {
  const originalAndroid = platformEnv.isNativeAndroid;
  const storage = jest.mocked(googleDriveStorage);
  const touchLegacyMetaDataFile = jest.fn();
  const provider = new GoogleDriveBackupProvider({
    serviceCloudBackup: { touchLegacyMetaDataFile },
  } as unknown as IBackgroundApi);
  const expectedAccountId = 'synthetic-google-account-a';
  const options = { expectedAccountId };
  const manifestFileName = 'OnekeyBackup_V2_Rev202510--manifest.json';
  const payload: IBackupDataEncryptedPayload = {
    privateDataEncrypted: 'synthetic-encrypted-private-data',
    publicData: {
      dataTime: 1,
      totalWalletsCount: 1,
      totalAccountsCount: 1,
      walletDetails: [],
    },
    isEmptyData: false,
    isWatchingOnly: false,
    appVersion: '1.0.0',
  };
  const emptyManifest: IBackupDataManifest = { items: [], total: 0 };
  let accountId: string;
  const writes: Array<{
    accountId: string;
    fileName: string;
    content: string;
  }> = [];

  beforeEach(() => {
    jest.resetAllMocks();
    accountId = expectedAccountId;
    writes.length = 0;
    platformEnv.isNativeAndroid = true;
    jest
      .spyOn(provider, 'getCloudAccountInfo')
      .mockImplementation(async () => ({
        userId: accountId,
        userEmail: '',
        providerType: ECloudBackupProviderType.GoogleDrive,
      }));
    storage.isAvailable.mockResolvedValue(true);
    storage.getFileObject.mockResolvedValue({
      id: 'synthetic-manifest-id',
      name: manifestFileName,
    });
    storage.downloadFile.mockResolvedValue({
      id: 'synthetic-manifest-id',
      content: stringUtils.stableStringify(emptyManifest),
    });
    storage.uploadFile.mockImplementation(async (file) => {
      writes.push({ ...file, accountId });
      return { fileId: 'synthetic-backup-id' };
    });
  });

  afterEach(() => {
    platformEnv.isNativeAndroid = originalAndroid;
    jest.restoreAllMocks();
  });

  it('writes the backup and manifest for the expected account', async () => {
    await expect(provider.backupData(payload, options)).resolves.toEqual({
      recordID: 'synthetic-backup-id',
      content: stringUtils.stableStringify(payload),
    });
    expect(writes).toHaveLength(2);
    expect(writes.every((write) => write.accountId === expectedAccountId)).toBe(
      true,
    );
    const manifest = JSON.parse(writes[1].content) as IBackupDataManifest;
    expect(manifest.total).toBe(1);
    expect(manifest.items[0].recordID).toBe('synthetic-backup-id');
    expect(touchLegacyMetaDataFile).toHaveBeenCalledTimes(1);
  });

  it('preserves calls that do not supply an expected account', async () => {
    await expect(provider.backupData(payload)).resolves.toMatchObject({
      recordID: 'synthetic-backup-id',
    });
    expect(provider.getCloudAccountInfo).not.toHaveBeenCalled();
    expect(writes).toHaveLength(2);
  });

  it.each(['stale account', 'availability', 'sign-out'] as const)(
    'does not upload after %s',
    async (stage) => {
      if (stage === 'availability') {
        storage.isAvailable.mockImplementationOnce(async () => {
          accountId = 'synthetic-google-account-b';
          return true;
        });
      } else {
        accountId = stage === 'sign-out' ? '' : 'synthetic-google-account-b';
      }
      await expect(provider.backupData(payload, options)).rejects.toThrow(
        'Google Drive account changed',
      );
      expect(storage.uploadFile).not.toHaveBeenCalled();
      expect(storage.getFileObject).not.toHaveBeenCalled();
      expect(touchLegacyMetaDataFile).not.toHaveBeenCalled();
    },
  );

  it('does not append to the new account manifest after switching during upload', async () => {
    storage.uploadFile.mockImplementationOnce(async (file) => {
      writes.push({ ...file, accountId });
      accountId = 'synthetic-google-account-b';
      return { fileId: 'synthetic-backup-id' };
    });
    await expect(provider.backupData(payload, options)).rejects.toThrow(
      'Google Drive account changed',
    );
    expect(storage.uploadFile).toHaveBeenCalledTimes(1);
    expect(storage.getFileObject).not.toHaveBeenCalled();
    expect(touchLegacyMetaDataFile).not.toHaveBeenCalled();
  });

  it('does not write a manifest read while the account changed', async () => {
    storage.downloadFile.mockImplementationOnce(async () => {
      accountId = 'synthetic-google-account-b';
      return {
        id: 'synthetic-manifest-id',
        content: stringUtils.stableStringify(emptyManifest),
      };
    });
    await expect(provider.backupData(payload, options)).rejects.toThrow(
      'Google Drive account changed',
    );
    expect(storage.uploadFile).toHaveBeenCalledTimes(1);
    expect(writes.some((write) => write.fileName === manifestFileName)).toBe(
      false,
    );
    expect(touchLegacyMetaDataFile).not.toHaveBeenCalled();
  });

  it('does not report success when the account changes during manifest upload', async () => {
    storage.uploadFile.mockImplementation(async (file) => {
      writes.push({ ...file, accountId });
      if (file.fileName === manifestFileName) {
        accountId = 'synthetic-google-account-b';
      }
      return { fileId: 'synthetic-backup-id' };
    });
    await expect(provider.backupData(payload, options)).rejects.toThrow(
      'Google Drive account changed',
    );
    expect(storage.uploadFile).toHaveBeenCalledTimes(2);
    expect(touchLegacyMetaDataFile).not.toHaveBeenCalled();
  });

  it('does not upload when the account cannot be checked', async () => {
    jest
      .mocked(provider.getCloudAccountInfo)
      .mockRejectedValueOnce(new Error('Cloud account unavailable'));
    await expect(provider.backupData(payload, options)).rejects.toThrow(
      'Cloud account unavailable',
    );
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });
});
