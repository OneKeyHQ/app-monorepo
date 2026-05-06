import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

// eslint-disable-next-line jest/no-mocks-import
import { createKeychainStorageMock } from '../../../__mocks__/keychain-storage.mock';
import { VaultClient } from '../client';
import { serialize } from '../codec';
import { deriveVaultKey } from '../crypto';
import { acquireVaultLock } from '../lock';
import { createMasterKey } from '../master-key';

import type { IVaultClientPaths } from '../client';
import type { IVaultLockRelease } from '../lock';
import type { IVaultCacheEntry, IVaultPlaintext } from '../types';

const tempDirs: string[] = [];
const MASTER_KEY = Buffer.alloc(32, 0xbb);
const LOCK_WAIT_STRESS_CLIENTS = 5;
const LOCK_WAIT_STRESS_MUTATIONS_PER_CLIENT = 50;
const LOCK_WAIT_P95_LIMIT_MS = 150;

async function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function createPaths(): Promise<IVaultClientPaths> {
  const vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ok-vault-lost-'));
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

function createCacheEntry(label: string): IVaultCacheEntry {
  return {
    hdCredentialBlob: label,
    issuedAt: 1,
    expiresAt: 2,
  };
}

async function createClients(paths: IVaultClientPaths, count: number) {
  const keychainStorage = createKeychainStorageMock();
  await createMasterKey({
    keychainStorage,
    account: paths.masterKeyAccount,
    randomBytes: () => Buffer.from(MASTER_KEY),
  });
  return Array.from(
    { length: count },
    () => new VaultClient({ keychainStorage, paths }),
  );
}

async function addCacheEntry(
  client: VaultClient,
  label: string,
  mutateDelayMs = 0,
): Promise<string> {
  return client.atomicMutate(async (vault) => {
    await delay(mutateDelayMs);
    return {
      nextVault: {
        ...vault,
        cache: {
          ...vault.cache,
          [`${label}:key1`]: createCacheEntry(label),
        },
      },
      result: label,
    };
  });
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

describe('VaultClient lost-update protection', () => {
  it('serializes two concurrent clients without losing cache entries', async () => {
    const paths = await createPaths();
    await writeVault(paths, createVault());
    const [clientA, clientB] = await createClients(paths, 2);

    await expect(
      Promise.all([
        addCacheEntry(clientA, 'A', 10),
        addCacheEntry(clientB, 'B'),
      ]),
    ).resolves.toEqual(['A', 'B']);

    await expect(clientA.readOnly((vault) => vault.cache)).resolves.toEqual({
      'A:key1': createCacheEntry('A'),
      'B:key1': createCacheEntry('B'),
    });
  });

  it.each([
    ['A slow, B fast', 10, 0],
    ['A fast, B slow', 0, 10],
    ['both fast', 0, 0],
    ['both slow', 5, 5],
    ['A delayed lightly', 2, 0],
    ['B delayed lightly', 0, 2],
  ])(
    'keeps final state equivalent for timing case %s',
    async (_name, aDelay, bDelay) => {
      const paths = await createPaths();
      await writeVault(paths, createVault());
      const [clientA, clientB] = await createClients(paths, 2);

      await Promise.all([
        addCacheEntry(clientA, 'A', aDelay),
        addCacheEntry(clientB, 'B', bDelay),
      ]);

      const cache = await clientA.readOnly((vault) => vault.cache);
      expect(cache['A:key1']).toEqual(createCacheEntry('A'));
      expect(cache['B:key1']).toEqual(createCacheEntry('B'));
    },
  );

  it('keeps 95p lock wait bounded under concurrent mutations', async () => {
    const paths = await createPaths();
    await writeVault(paths, createVault());
    const waits: number[] = [];
    const acquireLock = async (
      lockPaths: IVaultClientPaths,
    ): Promise<IVaultLockRelease> => {
      const startedAt = performance.now();
      const release = await acquireVaultLock({
        vaultDir: lockPaths.vaultDir,
        vaultFile: lockPaths.vaultFile,
        vaultLock: lockPaths.vaultLock,
      });
      waits.push(performance.now() - startedAt);
      return release;
    };
    const keychainStorage = createKeychainStorageMock();
    await createMasterKey({
      keychainStorage,
      account: paths.masterKeyAccount,
      randomBytes: () => Buffer.from(MASTER_KEY),
    });
    const clients = Array.from(
      { length: LOCK_WAIT_STRESS_CLIENTS },
      () => new VaultClient({ keychainStorage, paths, acquireLock }),
    );

    await Promise.all(
      clients.map((client, clientIndex) =>
        Array.from({ length: LOCK_WAIT_STRESS_MUTATIONS_PER_CLIENT }).reduce<
          Promise<void>
        >(
          (previous, _unused, mutationIndex) =>
            previous.then(async () => {
              await addCacheEntry(
                client,
                `client${clientIndex}-${mutationIndex}`,
              );
            }),
          Promise.resolve(),
        ),
      ),
    );

    const sortedWaits = [...waits].toSorted((left, right) => left - right);
    const p95 = sortedWaits[Math.floor((sortedWaits.length - 1) * 0.95)] ?? 0;
    expect(p95).toBeLessThan(LOCK_WAIT_P95_LIMIT_MS);
    await expect(
      clients[0].readOnly((vault) => Object.keys(vault.cache)),
    ).resolves.toHaveLength(
      LOCK_WAIT_STRESS_CLIENTS * LOCK_WAIT_STRESS_MUTATIONS_PER_CLIENT,
    );
  });
});
