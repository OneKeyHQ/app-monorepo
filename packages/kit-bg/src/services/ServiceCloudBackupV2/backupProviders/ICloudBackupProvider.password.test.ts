/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import { webcrypto } from 'crypto';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { appleCloudKitStorage } from '@onekeyhq/shared/src/storage/AppleCloudKitStorage';
import type { IAppleCloudKitRecord } from '@onekeyhq/shared/src/storage/AppleCloudKitStorage/types';

import { encryptStringAsyncWithFormat } from '../../../utils/secretEncryptFormat';

import { ICloudBackupProvider } from './ICloudBackupProvider';

jest.mock('../../../utils/secretEncryptFormat', () => ({
  ...jest.requireActual<typeof import('../../../utils/secretEncryptFormat')>(
    '../../../utils/secretEncryptFormat',
  ),
  encryptStringAsyncWithFormat: jest.fn(),
}));
const actualEncrypt = jest.requireActual<
  typeof import('../../../utils/secretEncryptFormat')
>('../../../utils/secretEncryptFormat').encryptStringAsyncWithFormat;

jest.mock('@onekeyhq/shared/src/storage/AppleCloudKitStorage', () => ({
  appleCloudKitStorage: {
    getAccountInfo: jest.fn(),
    saveRecord: jest.fn(),
    fetchRecord: jest.fn(),
  },
}));
jest.mock('@onekeyhq/shared/src/storage/AppleKeyChainStorage', () => ({
  appleKeyChainStorage: {},
}));

describe.each(['iOS', 'macOS'])('iCloud password setup on %s', (platform) => {
  const originalIOS = platformEnv.isNativeIOS;
  const originalMac = platformEnv.isDesktopMac;
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'crypto',
  );
  const cloud = jest.mocked(appleCloudKitStorage);
  const provider = new ICloudBackupProvider({} as IBackgroundApi);
  const params = {
    password:
      'synthetic-account-a:synthetic-password:4A561E9E-E747-4AFF-B835-FE2EF2D61B41',
    expectedAccountId: 'synthetic-account-a',
  };
  let accountId: string;
  const records = new Map<string, IAppleCloudKitRecord>();

  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
  });
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(encryptStringAsyncWithFormat).mockImplementation(actualEncrypt);
    accountId = params.expectedAccountId;
    records.clear();
    platformEnv.isNativeIOS = platform === 'iOS';
    platformEnv.isDesktopMac = platform === 'macOS';
    cloud.getAccountInfo.mockImplementation(async () => ({
      containerUserId: accountId,
      status: 1,
      statusName: 'available',
    }));
    cloud.saveRecord.mockImplementation(async (record) => {
      records.set(accountId, record);
      return { recordID: record.recordID, createdAt: 1 };
    });
    cloud.fetchRecord.mockImplementation(
      async () => records.get(accountId) ?? null,
    );
  });
  afterEach(() => {
    platformEnv.isNativeIOS = originalIOS;
    platformEnv.isDesktopMac = originalMac;
    jest.restoreAllMocks();
  });
  afterAll(() => {
    if (cryptoDescriptor)
      Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
    else Reflect.deleteProperty(globalThis, 'crypto');
  });

  it('writes a password verification record that the same account can decrypt', async () => {
    await provider.setBackupPassword(params);
    await expect(
      provider.verifyBackupPassword({ password: params.password }),
    ).resolves.toBe(true);
    expect(cloud.saveRecord).toHaveBeenCalledTimes(1);
  });

  it('refuses a stale account before writing and allows a successful retry for the new account', async () => {
    jest
      .mocked(encryptStringAsyncWithFormat)
      .mockImplementationOnce(async (options) => {
        const content = await actualEncrypt(options);
        accountId = 'synthetic-account-b';
        return content;
      });
    await expect(provider.setBackupPassword(params)).rejects.toThrow(
      'iCloud account changed',
    );
    expect(cloud.saveRecord).not.toHaveBeenCalled();
    const retry = {
      password: params.password.replace(params.expectedAccountId, accountId),
      expectedAccountId: accountId,
    };
    await provider.setBackupPassword(retry);
    await expect(
      provider.verifyBackupPassword({ password: retry.password }),
    ).resolves.toBe(true);
  });

  it('does not report success when the account changes during the native write', async () => {
    cloud.saveRecord.mockImplementationOnce(async (record) => {
      records.set(accountId, record);
      accountId = 'synthetic-account-b';
      return { recordID: record.recordID, createdAt: 1 };
    });
    await expect(provider.setBackupPassword(params)).rejects.toThrow(
      'iCloud account changed',
    );
    expect(cloud.saveRecord).toHaveBeenCalledTimes(1);
  });

  it('does not write when the account cannot be checked', async () => {
    cloud.getAccountInfo.mockRejectedValueOnce(
      new Error('Cloud account unavailable'),
    );
    await expect(provider.setBackupPassword(params)).rejects.toThrow(
      'Cloud account unavailable',
    );
    expect(cloud.saveRecord).not.toHaveBeenCalled();
  });

  it('does not write after sign-out', async () => {
    accountId = '';
    await expect(provider.setBackupPassword(params)).rejects.toThrow(
      'iCloud account changed',
    );
    expect(cloud.saveRecord).not.toHaveBeenCalled();
  });
});
