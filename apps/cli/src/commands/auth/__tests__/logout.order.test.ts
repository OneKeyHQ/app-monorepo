import { performance } from 'node:perf_hooks';

import {
  type ILogoutPipelineDependencies,
  LEGACY_KEYCHAIN_ACCOUNTS,
  executeLogoutPipeline,
} from '../_internal/logout-pipeline';

import type {
  IVaultMutationResult,
  IVaultPlaintext,
} from '../../../infra/vault';

const MASTER_KEY_ACCOUNT = 'bot-wallet/master-key';
type IVaultClientLike = NonNullable<ILogoutPipelineDependencies['vaultClient']>;

function createDeps(events: string[] = []) {
  return {
    readVaultRecords: jest.fn(async () => {
      events.push('read');
      return [{ keyId: 'key1', accessToken: 'token' }];
    }),
    revokeKey: jest.fn(async () => {
      events.push('revoke');
    }),
    keychainStorage: {
      delete: jest.fn(async (account: string) => {
        events.push(`delete:${account}`);
      }),
    },
    unlink: jest.fn(async (filePath: string) => {
      events.push(`unlink:${filePath}`);
    }),
    clearSecureCache: jest.fn(() => {
      events.push('clear-cache');
    }),
    warn: jest.fn(),
    masterKeyAccount: MASTER_KEY_ACCOUNT,
    vaultFile: 'vault.enc',
    vaultLock: 'vault.enc.lock',
  };
}

describe('auth logout pipeline order', () => {
  it('executes the strict logout order', async () => {
    const events: string[] = [];
    const deps = createDeps(events);

    await executeLogoutPipeline(deps);

    expect(events).toEqual([
      'read',
      'revoke',
      `delete:${MASTER_KEY_ACCOUNT}`,
      'unlink:vault.enc',
      'unlink:vault.enc.lock',
      ...LEGACY_KEYCHAIN_ACCOUNTS.map((account) => `delete:${account}`),
      'clear-cache',
    ]);
  });

  it('revokes before deleting the master key', async () => {
    const events: string[] = [];
    const deps = createDeps(events);

    await executeLogoutPipeline(deps);

    expect(events.indexOf('revoke')).toBeLessThan(
      events.indexOf(`delete:${MASTER_KEY_ACCOUNT}`),
    );
  });

  it('uses a timeout for hung revoke calls', async () => {
    const deps = createDeps();
    deps.revokeKey.mockImplementationOnce(
      () => new Promise<void>(() => undefined),
    );
    const startedAt = performance.now();

    await executeLogoutPipeline({ ...deps, revokeTimeoutMs: 10 });

    expect(performance.now() - startedAt).toBeLessThan(8000);
    expect(deps.keychainStorage.delete).toHaveBeenCalledWith(
      MASTER_KEY_ACCOUNT,
    );
  });

  it('runs production cleanup inside vaultClient.atomicMutate', async () => {
    const events: string[] = [];
    let atomicMutateCallCount = 0;
    let readOnlyCallCount = 0;
    type IVaultMutator<TResult> = (
      currentVault: IVaultPlaintext,
    ) => Promise<IVaultMutationResult<TResult>> | IVaultMutationResult<TResult>;
    const keychainStorage = {
      delete: jest.fn(async (account: string) => {
        events.push(`delete:${account}`);
      }),
    };
    const vaultClient: IVaultClientLike = {
      atomicMutate: async <TResult>(mutator: IVaultMutator<TResult>) => {
        atomicMutateCallCount += 1;
        events.push('lock:start');
        const result = await mutator({
          schemaVersion: 1,
          cache: {},
          metadata: {
            activeKeyId: 'key1',
            activeWalletId: 'wallet1',
            schemaVersion: 1,
            vaultCreatedAt: 1,
          },
          records: {
            key1: {
              walletId: 'wallet1',
              accessToken: 'token1',
              ciphertextBase64: 'ciphertext',
              createdAt: 1,
            },
          },
          sessionLabels: {},
        });
        events.push('lock:end');
        return result.result;
      },
      readOnly: async () => {
        readOnlyCallCount += 1;
        return undefined as never;
      },
    };

    await executeLogoutPipeline({
      clearSecureCache: () => events.push('clear-cache'),
      keychainStorage,
      revokeKey: jest.fn(async () => {
        events.push('revoke');
      }),
      unlink: jest.fn(async (filePath: string) => {
        events.push(`unlink:${filePath}`);
      }),
      vaultClient,
      masterKeyAccount: MASTER_KEY_ACCOUNT,
      vaultFile: 'vault.enc',
      vaultLock: 'vault.enc.lock',
    });

    expect(atomicMutateCallCount).toBe(1);
    expect(readOnlyCallCount).toBe(0);
    expect(events.slice(0, -1)).toEqual([
      'lock:start',
      'revoke',
      `delete:${MASTER_KEY_ACCOUNT}`,
      'unlink:vault.enc',
      ...LEGACY_KEYCHAIN_ACCOUNTS.map((account) => `delete:${account}`),
      'clear-cache',
      'lock:end',
    ]);
    expect(events.at(-1)).toBe('unlink:vault.enc.lock');
  });
});
