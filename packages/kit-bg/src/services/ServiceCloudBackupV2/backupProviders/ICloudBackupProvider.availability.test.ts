/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { appleCloudKitStorage } from '@onekeyhq/shared/src/storage/AppleCloudKitStorage';
import { appleKeyChainStorage } from '@onekeyhq/shared/src/storage/AppleKeyChainStorage';

import { ICloudBackupProvider } from './ICloudBackupProvider';

jest.mock('@onekeyhq/shared/src/storage/AppleCloudKitStorage', () => ({
  appleCloudKitStorage: { isAvailable: jest.fn(), getAccountInfo: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/storage/AppleKeyChainStorage', () => ({
  appleKeyChainStorage: { isICloudSyncEnabled: jest.fn() },
}));
jest.mock('react-native-cloud-fs', () => ({
  __esModule: true,
  default: { isAvailable: jest.fn(async () => true) },
}));

describe('iCloud backup availability without synchronizable Keychain', () => {
  const originalIOS = platformEnv.isNativeIOS;
  const originalMac = platformEnv.isDesktopMac;
  const provider = new ICloudBackupProvider({} as IBackgroundApi);

  beforeEach(() => {
    jest.resetAllMocks();
    platformEnv.isNativeIOS = true;
    platformEnv.isDesktopMac = false;
    jest.mocked(appleCloudKitStorage.isAvailable).mockResolvedValue(true);
    jest.mocked(appleCloudKitStorage.getAccountInfo).mockResolvedValue({
      status: 1,
      statusName: 'available',
      containerUserId: 'synthetic-account',
    });
  });
  afterEach(() => {
    platformEnv.isNativeIOS = originalIOS;
    platformEnv.isDesktopMac = originalMac;
  });

  it('allows iOS password backups even if the iCloud Keychain API is unavailable', async () => {
    jest
      .mocked(appleKeyChainStorage.isICloudSyncEnabled)
      .mockRejectedValue(new Error('iCloud Keychain unavailable'));
    await expect(provider.checkAvailability()).resolves.toBeUndefined();
    expect((await provider.getCloudAccountInfo()).userId).toBe(
      'synthetic-account',
    );
    expect(appleKeyChainStorage.isICloudSyncEnabled).not.toHaveBeenCalled();
  });

  it('still requires CloudKit availability on iOS', async () => {
    jest.mocked(appleCloudKitStorage.isAvailable).mockResolvedValue(false);
    await expect(provider.checkAvailability()).rejects.toThrow(
      'CloudKit is not available',
    );
  });

  it('preserves the macOS availability check', async () => {
    platformEnv.isNativeIOS = false;
    platformEnv.isDesktopMac = true;
    jest
      .mocked(appleKeyChainStorage.isICloudSyncEnabled)
      .mockResolvedValue(false);
    await expect(provider.checkAvailability()).rejects.toThrow(
      'iCloud Keychain sync is not enabled',
    );
    jest
      .mocked(appleKeyChainStorage.isICloudSyncEnabled)
      .mockResolvedValue(true);
    await expect(provider.checkAvailability()).resolves.toBeUndefined();
  });
});
