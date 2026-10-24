import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';

import keylessStorageUtils from './keylessStorageUtils';
import keylessSyncCredentialStorage from './keylessSyncCredentialStorage';

let mockStoredPayload: string | null = null;

jest.mock('./keylessStorageUtils', () => ({
  __esModule: true,
  default: {
    storageGetItem: jest.fn(async () => mockStoredPayload),
    storageSetItem: jest.fn(async (_key: string, value: string) => {
      mockStoredPayload = value;
    }),
    storageRemoveItem: jest.fn(async () => {
      mockStoredPayload = null;
    }),
  },
}));

const credential: IKeylessCloudSyncCredential = {
  keylessWalletId: 'public-hardware-storage-fixture',
  signingPrivateKey: 'public-test-placeholder-signing',
  signingPublicKey: 'public-test-placeholder-public',
  encryptionKey: 'public-test-placeholder-encryption',
  pwdHash: 'keyless-public-test-fixture',
};

describe('shared Cloud credential storage source changes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoredPayload = null;
  });

  test('a stale source lookup cannot delete the currently encrypted credential', async () => {
    await keylessSyncCredentialStorage.saveCredential(credential);
    expect(mockStoredPayload).not.toContain(credential.signingPrivateKey);
    await expect(
      keylessSyncCredentialStorage.getCredential('old-keyless-id'),
    ).resolves.toBeNull();
    expect(keylessStorageUtils.storageRemoveItem).not.toHaveBeenCalled();
    await expect(
      keylessSyncCredentialStorage.getCredential(credential.keylessWalletId),
    ).resolves.toEqual(credential);
  });

  test('a corrupt read completing after a new save cannot remove the new credential', async () => {
    let release: () => void = () => undefined;
    let reached: () => void = () => undefined;
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      reached = resolve;
    });
    jest
      .mocked(keylessStorageUtils.storageGetItem)
      .mockImplementationOnce(async () => {
        reached();
        await paused;
        return 'corrupt-payload';
      });
    const staleRead =
      keylessSyncCredentialStorage.getCredential('old-keyless-id');
    await entered;
    await keylessSyncCredentialStorage.saveCredential(credential);
    release();
    await expect(staleRead).resolves.toBeNull();
    expect(keylessStorageUtils.storageRemoveItem).not.toHaveBeenCalled();
    await expect(
      keylessSyncCredentialStorage.getCredential(credential.keylessWalletId),
    ).resolves.toEqual(credential);
  });

  test('explicit disable cleanup still removes the shared persisted credential', async () => {
    await keylessSyncCredentialStorage.saveCredential(credential);
    await keylessSyncCredentialStorage.removeAllCredentials();
    expect(keylessStorageUtils.storageRemoveItem).toHaveBeenCalledTimes(1);
    await expect(
      keylessSyncCredentialStorage.getCredential(credential.keylessWalletId),
    ).resolves.toBeNull();
  });
});
