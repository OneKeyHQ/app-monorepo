import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  LEGACY_ENCRYPTION_KEY_ACCOUNT,
  LEGACY_MNEMONIC_ACCOUNT,
  executeLogoutPipeline,
} from '../_internal/logout-pipeline';

const MASTER_KEY_ACCOUNT = 'bot-wallet/master-key';

describe('auth logout failure matrix', () => {
  it('stops after master-key delete failure', async () => {
    const unlink = jest.fn(async () => undefined);
    const keychainStorage = {
      delete: jest.fn(async (account: string) => {
        if (account === MASTER_KEY_ACCOUNT) {
          throw new OneKeyLocalError('permission denied');
        }
      }),
    };

    await expect(
      executeLogoutPipeline({
        readVaultRecords: async () => [],
        keychainStorage,
        unlink,
        masterKeyAccount: MASTER_KEY_ACCOUNT,
      }),
    ).rejects.toThrow('permission denied');

    expect(unlink).not.toHaveBeenCalled();
    expect(keychainStorage.delete).toHaveBeenCalledTimes(1);
  });

  it('warns but succeeds when legacy deletes fail', async () => {
    const warn = jest.fn();
    const keychainStorage = {
      delete: jest.fn(async (account: string) => {
        if (
          account === LEGACY_MNEMONIC_ACCOUNT ||
          account === LEGACY_ENCRYPTION_KEY_ACCOUNT
        ) {
          throw new OneKeyLocalError('legacy delete failed');
        }
      }),
    };

    await expect(
      executeLogoutPipeline({
        readVaultRecords: async () => [],
        keychainStorage,
        unlink: async () => undefined,
        warn,
        masterKeyAccount: MASTER_KEY_ACCOUNT,
      }),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('calls readVaultRecords so vault access remains centralized', async () => {
    const readVaultRecords = jest.fn(async () => []);

    await executeLogoutPipeline({
      readVaultRecords,
      keychainStorage: { delete: jest.fn(async () => undefined) },
      unlink: async () => undefined,
    });

    expect(readVaultRecords).toHaveBeenCalledTimes(1);
  });
});
