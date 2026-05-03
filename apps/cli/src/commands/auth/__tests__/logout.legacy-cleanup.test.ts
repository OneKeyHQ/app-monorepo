import {
  MASTER_KEY_ACCOUNT,
  VAULT_FILE,
  VAULT_LOCK,
} from '../../../infra/vault';
import {
  LEGACY_ENCRYPTION_KEY_ACCOUNT,
  LEGACY_MNEMONIC_ACCOUNT,
  executeLogoutPipeline,
} from '../_internal/logout-pipeline';

function createError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

describe('auth logout legacy cleanup', () => {
  it('warns and succeeds when the legacy mnemonic entry is missing', async () => {
    const warn = jest.fn();
    const clearSecureCache = jest.fn();
    const keychainStorage = {
      delete: jest.fn(async (account: string) => {
        if (account === LEGACY_MNEMONIC_ACCOUNT) {
          throw createError('NotFound');
        }
      }),
    };

    await executeLogoutPipeline({
      clearSecureCache,
      keychainStorage,
      readVaultRecords: async () => [],
      unlink: async () => undefined,
      warn,
    });

    expect(warn).toHaveBeenCalledWith(
      `Failed to delete ${LEGACY_MNEMONIC_ACCOUNT}`,
      expect.objectContaining({ code: 'NotFound' }),
    );
    expect(clearSecureCache).toHaveBeenCalledTimes(1);
  });

  it('warns and succeeds when the legacy encryption-key entry is permission denied', async () => {
    const warn = jest.fn();
    const clearSecureCache = jest.fn();
    const keychainStorage = {
      delete: jest.fn(async (account: string) => {
        if (account === LEGACY_ENCRYPTION_KEY_ACCOUNT) {
          throw createError('PermissionDenied');
        }
      }),
    };

    await executeLogoutPipeline({
      clearSecureCache,
      keychainStorage,
      readVaultRecords: async () => [],
      unlink: async () => undefined,
      warn,
    });

    expect(warn).toHaveBeenCalledWith(
      `Failed to delete ${LEGACY_ENCRYPTION_KEY_ACCOUNT}`,
      expect.objectContaining({ code: 'PermissionDenied' }),
    );
    expect(clearSecureCache).toHaveBeenCalledTimes(1);
  });

  it('deletes legacy entries only after the new master key and vault files', async () => {
    const calls: string[] = [];
    const keychainStorage = {
      delete: jest.fn(async (account: string) => {
        calls.push(`delete:${account}`);
      }),
    };

    await executeLogoutPipeline({
      clearSecureCache: () => calls.push('clear'),
      keychainStorage,
      readVaultRecords: async () => [],
      unlink: async (filePath: string) => {
        calls.push(`unlink:${filePath}`);
      },
      warn: jest.fn(),
    });

    expect(calls).toEqual([
      `delete:${MASTER_KEY_ACCOUNT}`,
      `unlink:${VAULT_FILE}`,
      `unlink:${VAULT_LOCK}`,
      `delete:${LEGACY_MNEMONIC_ACCOUNT}`,
      `delete:${LEGACY_ENCRYPTION_KEY_ACCOUNT}`,
      'clear',
    ]);
  });

  it('does not attempt legacy cleanup when new master-key deletion fails', async () => {
    const clearSecureCache = jest.fn();
    const keychainStorage = {
      delete: jest.fn(async (account: string) => {
        if (account === MASTER_KEY_ACCOUNT) {
          throw createError('PermissionDenied');
        }
      }),
    };

    await expect(
      executeLogoutPipeline({
        clearSecureCache,
        keychainStorage,
        readVaultRecords: async () => [],
        unlink: async () => undefined,
        warn: jest.fn(),
      }),
    ).rejects.toMatchObject({ code: 'PermissionDenied' });

    expect(keychainStorage.delete).toHaveBeenCalledTimes(1);
    expect(keychainStorage.delete).not.toHaveBeenCalledWith(
      LEGACY_MNEMONIC_ACCOUNT,
    );
    expect(clearSecureCache).not.toHaveBeenCalled();
  });
});
