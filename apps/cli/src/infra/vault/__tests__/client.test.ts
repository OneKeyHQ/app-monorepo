import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// eslint-disable-next-line jest/no-mocks-import
import { createKeychainStorageMock } from '../../../__mocks__/keychain-storage.mock';
import { VaultClient } from '../client';
import { serialize } from '../codec';
import { deriveVaultKey } from '../crypto';
import { VaultClientError } from '../errors';
import { createMasterKey } from '../master-key';

import type { IVaultClientPaths } from '../client';
import type { IVaultPlaintext } from '../types';

const tempDirs: string[] = [];
const MASTER_KEY = Buffer.alloc(32, 0x99);

async function createPaths(): Promise<IVaultClientPaths> {
  const vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ok-vault-client-'));
  tempDirs.push(vaultDir);
  const vaultFile = path.join(vaultDir, 'vault.enc');
  return {
    vaultDir,
    vaultFile,
    vaultLock: `${vaultFile}.lock`,
    masterKeyAccount: 'bot-wallet/master-key',
  };
}

function createVault(): IVaultPlaintext {
  return {
    schemaVersion: 1,
    records: {
      key1: {
        walletId: 'wallet1',
        accessToken: 'token',
        ciphertextBase64: 'ciphertext',
        createdAt: 1,
      },
    },
    cache: {},
    metadata: {
      activeWalletId: 'wallet1',
      activeKeyId: 'key1',
      schemaVersion: 1,
      vaultCreatedAt: 1,
    },
    sessionLabels: {
      key1: {
        displayAddress: '0x1234567890',
        sourceLabel: 'BotWallet',
      },
    },
  };
}

async function writeVault(paths: IVaultClientPaths, vault: IVaultPlaintext) {
  await fs.mkdir(paths.vaultDir, { recursive: true });
  await fs.writeFile(
    paths.vaultFile,
    serialize(vault, deriveVaultKey(MASTER_KEY)),
  );
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function createClientContext(paths: IVaultClientPaths) {
  const keychainStorage = createKeychainStorageMock();
  await createMasterKey({
    keychainStorage,
    account: paths.masterKeyAccount,
    randomBytes: () => Buffer.from(MASTER_KEY),
  });
  const client = new VaultClient({ keychainStorage, paths });
  return { client, keychainStorage };
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) =>
      fs.rm(dir, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

describe('VaultClient', () => {
  it('atomicMutate writes the next vault and returns the mutator result', async () => {
    const paths = await createPaths();
    await writeVault(paths, createVault());
    const { client } = await createClientContext(paths);

    await expect(
      client.atomicMutate((vault) => ({
        nextVault: {
          ...vault,
          cache: {
            'wallet1:key1': {
              hdCredentialBlob: 'blob',
              issuedAt: 1,
              expiresAt: 2,
            },
          },
        },
        result: 'updated',
      })),
    ).resolves.toBe('updated');

    await expect(client.readOnly((vault) => vault.cache)).resolves.toEqual({
      'wallet1:key1': {
        hdCredentialBlob: 'blob',
        issuedAt: 1,
        expiresAt: 2,
      },
    });
  });

  it('readOnly leaves vault mtime unchanged', async () => {
    const paths = await createPaths();
    await writeVault(paths, createVault());
    const { client } = await createClientContext(paths);
    const before = (await fs.stat(paths.vaultFile)).mtimeMs;

    await expect(
      client.readOnly((vault) => vault.metadata.activeKeyId),
    ).resolves.toBe('key1');

    expect((await fs.stat(paths.vaultFile)).mtimeMs).toBe(before);
  });

  it('destroy deletes vault file, lock file, and master key', async () => {
    const paths = await createPaths();
    await writeVault(paths, createVault());
    await fs.writeFile(paths.vaultLock, 'lock');
    const { client, keychainStorage } = await createClientContext(paths);

    await client.destroy();

    expect(await pathExists(paths.vaultFile)).toBe(false);
    expect(await pathExists(paths.vaultLock)).toBe(false);
    await expect(
      keychainStorage.get(paths.masterKeyAccount),
    ).resolves.toBeNull();
  });

  it('throws VAULT_MISSING when master key exists but vault.enc does not', async () => {
    const paths = await createPaths();
    const { client } = await createClientContext(paths);

    await expect(client.readOnly((vault) => vault)).rejects.toMatchObject({
      code: 'VAULT_MISSING',
    });
    expect(await pathExists(paths.vaultFile)).toBe(false);
  });

  it('throws VAULT_CORRUPT when vault decrypt fails', async () => {
    const paths = await createPaths();
    await fs.writeFile(paths.vaultFile, Buffer.from('corrupt'));
    const { client } = await createClientContext(paths);

    await expect(client.readOnly((vault) => vault)).rejects.toMatchObject({
      code: 'VAULT_CORRUPT',
    });
  });

  it('throws VAULT_CORRUPT when invariants fail', async () => {
    const paths = await createPaths();
    const vault = createVault();
    vault.records.key2 = {
      walletId: 'wallet2',
      accessToken: 'token2',
      ciphertextBase64: 'ciphertext2',
      createdAt: 2,
    };
    await writeVault(paths, vault);
    const { client } = await createClientContext(paths);

    await expect(
      client.readOnly((currentVault) => currentVault),
    ).rejects.toMatchObject({
      code: 'VAULT_CORRUPT',
    });
  });

  it('does not return the mutator result when write fails', async () => {
    const paths = await createPaths();
    await writeVault(paths, createVault());
    const keychainStorage = createKeychainStorageMock();
    await createMasterKey({
      keychainStorage,
      account: paths.masterKeyAccount,
      randomBytes: () => Buffer.from(MASTER_KEY),
    });
    const client = new VaultClient({
      keychainStorage,
      paths,
      writeFileAtomic: async () => {
        throw new OneKeyLocalError('disk full');
      },
    });

    await expect(
      client.atomicMutate((vault) => ({
        nextVault: vault,
        result: 'should-not-return',
      })),
    ).rejects.toMatchObject({
      code: 'VAULT_WRITE_FAILED',
      cause: expect.objectContaining({ message: 'disk full' }),
    });
  });

  it('releases the lock when an error is thrown', async () => {
    const paths = await createPaths();
    const keychainStorage = createKeychainStorageMock();
    const release = jest.fn(async () => undefined);
    const client = new VaultClient({
      keychainStorage,
      paths,
      acquireLock: async () => release,
    });

    await expect(client.readOnly((vault) => vault)).rejects.toBeInstanceOf(
      VaultClientError,
    );
    expect(release).toHaveBeenCalledTimes(1);
  });
});
