import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';

// eslint-disable-next-line jest/no-mocks-import
import { createKeychainStorageMock } from '../__mocks__/keychain-storage.mock';
import { secureWipe as defaultSecureWipe } from '../core/crypto-utils';
import { AppError } from '../errors';
import {
  VaultClient,
  VaultClientError,
  assertVaultInvariants,
  createMasterKey,
  deriveVaultKeyFromMasterKey,
  serialize,
} from '../infra/vault';
import { SignerSoftwareBase } from '../signer/base/SignerSoftwareBase';

import type { ISecureCacheKey } from '../core/secure-cache';
import type {
  IVaultClientPaths,
  IVaultMutationResult,
  IVaultPlaintext,
} from '../infra/vault';
import type {
  IServiceResponse,
  IServiceSelfHealReason,
} from '../infra/vault/service-client';

const T0 = 1_714_000_000_000;
const MASTER_KEY_ACCOUNT = 'bot-wallet/master-key';

function createVault(
  overrides: Partial<IVaultPlaintext> = {},
): IVaultPlaintext {
  return {
    schemaVersion: 1,
    records: {
      'key-1': {
        walletId: 'wallet-1',
        accessToken: 'token-1',
        ciphertextBase64: 'ciphertext-1',
        createdAt: T0,
      },
    },
    cache: {},
    metadata: {
      activeWalletId: 'wallet-1',
      activeKeyId: 'key-1',
      schemaVersion: 1,
      vaultCreatedAt: T0,
    },
    sessionLabels: {},
    ...overrides,
  };
}

class MatrixVaultClient {
  release = jest.fn();

  /* eslint-disable no-useless-constructor, no-empty-function */
  constructor(
    private readonly vault: IVaultPlaintext,
    private readonly afterMutationError?: Error,
  ) {}
  /* eslint-enable no-useless-constructor, no-empty-function */

  async atomicMutate<TResult>(
    mutator: (
      currentVault: IVaultPlaintext,
    ) => Promise<IVaultMutationResult<TResult>> | IVaultMutationResult<TResult>,
  ): Promise<TResult> {
    try {
      assertVaultInvariants(this.vault);
      const mutation = await mutator(this.vault);
      assertVaultInvariants(mutation.nextVault);
      if (this.afterMutationError) {
        throw this.afterMutationError;
      }
      return mutation.result;
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'VAULT_CORRUPT'
      ) {
        throw new VaultClientError('VAULT_CORRUPT');
      }
      throw error;
    } finally {
      this.release();
    }
  }
}

function createCache() {
  return {
    get: jest.fn(() => null),
    set: jest.fn<void, [ISecureCacheKey, Buffer]>(),
  };
}

function createWipeRecorder() {
  const wiped: string[] = [];
  const secureWipe = jest.fn((buffer: Buffer) => {
    wiped.push(buffer.toString('utf8'));
    buffer.fill(0);
  });
  return { secureWipe, wiped };
}

function createMasterKeyPayload(masterKey: Buffer): Buffer {
  return Buffer.from(
    stableStringify({
      masterKeyBase64: masterKey.toString('base64'),
      schemaVersion: 1,
      createdAt: T0,
    }),
    'utf8',
  );
}

async function createTempVaultPaths(): Promise<{
  tempDir: string;
  paths: IVaultClientPaths;
}> {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'onekey-cli-fail-injection-'),
  );
  const vaultDir = path.join(tempDir, 'bot-wallet');
  return {
    tempDir,
    paths: {
      vaultDir,
      vaultFile: path.join(vaultDir, 'vault.enc'),
      vaultLock: path.join(vaultDir, 'vault.enc.lock'),
      masterKeyAccount: MASTER_KEY_ACCOUNT,
    },
  };
}

async function createPersistedVaultFixture(
  vault: IVaultPlaintext,
  secureWipe: (buffer: Buffer) => void,
): Promise<{
  tempDir: string;
  release: jest.Mock<Promise<void>, []>;
  vaultClient: VaultClient;
}> {
  const { tempDir, paths } = await createTempVaultPaths();
  const keychainStorage = createKeychainStorageMock();
  const release = jest.fn(async () => undefined);
  const masterKey = await createMasterKey({
    keychainStorage,
    account: paths.masterKeyAccount,
    randomBytes: () => Buffer.from('K'.repeat(32), 'utf8'),
    now: () => T0,
  });
  const vaultKey = deriveVaultKeyFromMasterKey(Buffer.from(masterKey));

  try {
    await fs.mkdir(paths.vaultDir, { recursive: true });
    await fs.writeFile(paths.vaultFile, serialize(vault, vaultKey));
  } finally {
    defaultSecureWipe(masterKey);
    defaultSecureWipe(vaultKey);
  }

  return {
    tempDir,
    release,
    vaultClient: new VaultClient({
      keychainStorage,
      paths,
      acquireLock: async () => release,
      secureWipe,
    }),
  };
}

type IScenario = {
  name: string;
  expectedCode?: string;
  expectedMessage?: string;
  fetchKey?: () => Promise<IServiceResponse | { keyBase64: string }>;
  decryptCredential?: () => Promise<string>;
  selfHealReason?: IServiceSelfHealReason;
  vault?: IVaultPlaintext;
  afterMutationError?: Error;
  shouldWriteCache?: boolean;
};

const scenarios: IScenario[] = [
  {
    name: 'service GET 5xx',
    expectedCode: 'SERVICE_UNREACHABLE',
    fetchKey: async () => ({
      kind: 'fail-secure',
      reason: 'SERVICE_UNREACHABLE',
    }),
  },
  {
    name: 'service 401',
    expectedCode: 'SESSION_EXPIRED',
    selfHealReason: 'TOKEN_INVALID',
    fetchKey: async () => ({ kind: 'self-heal', reason: 'TOKEN_INVALID' }),
  },
  {
    name: 'service 403',
    expectedCode: 'SESSION_EXPIRED',
    selfHealReason: 'REVOKED',
    fetchKey: async () => ({ kind: 'self-heal', reason: 'REVOKED' }),
  },
  {
    name: 'service 404',
    expectedCode: 'SERVICE_KEY_NOT_FOUND',
    selfHealReason: 'KEY_NOT_FOUND',
    fetchKey: async () => ({ kind: 'self-heal', reason: 'KEY_NOT_FOUND' }),
  },
  {
    name: 'AES decrypt fail',
    expectedMessage: 'AES decrypt fail',
    decryptCredential: async () => {
      throw new OneKeyLocalError('AES decrypt fail');
    },
  },
  {
    name: 'invariants violate',
    expectedCode: 'VAULT_CORRUPT',
    vault: createVault({
      metadata: {
        activeWalletId: 'wallet-1',
        activeKeyId: 'missing-key',
        schemaVersion: 1,
        vaultCreatedAt: T0,
      },
    }),
  },
  {
    name: 'vault write fail',
    expectedCode: 'VAULT_WRITE_FAILED',
    afterMutationError: new VaultClientError('VAULT_WRITE_FAILED'),
  },
];

describe('BotWallet fail-injection matrix', () => {
  it.each(scenarios)(
    '$name releases lock and avoids unsafe cache writes',
    async (scenario) => {
      const cache = createCache();
      const { secureWipe, wiped } = createWipeRecorder();
      const vaultClient = new MatrixVaultClient(
        scenario.vault ?? createVault(),
        scenario.afterMutationError,
      );
      const selfHeal = jest.fn(async (reason: IServiceSelfHealReason) => {
        const code =
          reason === 'KEY_NOT_FOUND'
            ? 'SERVICE_KEY_NOT_FOUND'
            : 'SESSION_EXPIRED';
        throw new AppError(code, reason, 'Import again.');
      });
      const signer = new SignerSoftwareBase({
        decryptCredential:
          scenario.decryptCredential ?? jest.fn(async () => 'hd-credential'),
        fetchKey:
          scenario.fetchKey ??
          jest.fn(async () => ({ kind: 'ok', keyBase64: 'key-base64' })),
        secureWipe,
        selfHeal,
        sessionCache: cache,
        vaultClient,
      });

      const result = signer.getHdCredential();
      if (scenario.expectedCode) {
        await expect(result).rejects.toMatchObject({
          code: scenario.expectedCode,
        });
      } else {
        await expect(result).rejects.toThrow(scenario.expectedMessage);
      }

      expect(vaultClient.release).toHaveBeenCalledTimes(1);
      if (scenario.selfHealReason) {
        expect(selfHeal).toHaveBeenCalledWith(scenario.selfHealReason);
      }
      expect(cache.set).not.toHaveBeenCalled();
      if (scenario.name !== 'invariants violate') {
        expect(wiped.length).toBeGreaterThanOrEqual(1);
      }
    },
  );
});

describe('BotWallet vault client fail-injection coverage', () => {
  it('releases lock and avoids cache writes when keychain.get fails', async () => {
    const { tempDir, paths } = await createTempVaultPaths();
    const cache = createCache();
    const { secureWipe } = createWipeRecorder();
    const release = jest.fn(async () => undefined);
    const keychainStorage = {
      async get(): Promise<Buffer | null> {
        throw new OneKeyLocalError('keychain get fail');
      },
      async set(_key: string, _value: Buffer): Promise<void> {
        return undefined;
      },
      async delete(_key: string): Promise<void> {
        return undefined;
      },
    };
    const vaultClient = new VaultClient({
      keychainStorage,
      paths,
      acquireLock: async () => release,
      secureWipe,
    });
    const signer = new SignerSoftwareBase({
      vaultClient,
      sessionCache: cache,
      fetchKey: jest.fn(async () => ({ kind: 'ok', keyBase64: 'key-base64' })),
      decryptCredential: jest.fn(async () => 'hd-credential'),
      secureWipe,
    });

    try {
      await expect(signer.getHdCredential()).rejects.toThrow(
        'keychain get fail',
      );
      expect(release).toHaveBeenCalledTimes(1);
      expect(cache.set).not.toHaveBeenCalled();
      expect(secureWipe).not.toHaveBeenCalled();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('wipes master key and releases lock when vault-key HKDF derive fails', async () => {
    const { tempDir, paths } = await createTempVaultPaths();
    const cache = createCache();
    const { secureWipe, wiped } = createWipeRecorder();
    const release = jest.fn(async () => undefined);
    const masterKey = Buffer.from('M'.repeat(32), 'utf8');
    const keychainStorage = createKeychainStorageMock([
      [paths.masterKeyAccount, createMasterKeyPayload(masterKey)],
    ]);
    const deriveVaultKey = jest.fn(
      (
        masterKeyValue: Buffer,
        wipe: (buffer: Buffer) => void = defaultSecureWipe,
      ) => {
        wipe(masterKeyValue);
        throw new OneKeyLocalError('HKDF derive fail');
      },
    );
    const vaultClient = new VaultClient({
      keychainStorage,
      paths,
      acquireLock: async () => release,
      secureWipe,
      deriveVaultKeyFromMasterKey: deriveVaultKey,
    });
    const signer = new SignerSoftwareBase({
      vaultClient,
      sessionCache: cache,
      fetchKey: jest.fn(async () => ({ kind: 'ok', keyBase64: 'key-base64' })),
      decryptCredential: jest.fn(async () => 'hd-credential'),
      secureWipe,
    });

    try {
      await expect(signer.getHdCredential()).rejects.toThrow(
        'HKDF derive fail',
      );
      expect(deriveVaultKey).toHaveBeenCalledTimes(1);
      expect(release).toHaveBeenCalledTimes(1);
      expect(cache.set).not.toHaveBeenCalled();
      expect(wiped).toContain('M'.repeat(32));
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
      defaultSecureWipe(masterKey);
    }
  });

  it('maps real vault invariant corruption and wipes vault key', async () => {
    const cache = createCache();
    const { secureWipe, wiped } = createWipeRecorder();
    const fixture = await createPersistedVaultFixture(
      createVault({
        metadata: {
          activeWalletId: 'wallet-1',
          activeKeyId: 'missing-key',
          schemaVersion: 1,
          vaultCreatedAt: T0,
        },
      }),
      secureWipe,
    );
    const signer = new SignerSoftwareBase({
      vaultClient: fixture.vaultClient,
      sessionCache: cache,
      fetchKey: jest.fn(async () => ({ kind: 'ok', keyBase64: 'key-base64' })),
      decryptCredential: jest.fn(async () => 'hd-credential'),
      secureWipe,
    });

    try {
      await expect(signer.getHdCredential()).rejects.toMatchObject({
        code: 'VAULT_CORRUPT',
      });
      expect(fixture.release).toHaveBeenCalledTimes(1);
      expect(cache.set).not.toHaveBeenCalled();
      expect(wiped.length).toBeGreaterThanOrEqual(1);
    } finally {
      await fs.rm(fixture.tempDir, { recursive: true, force: true });
    }
  });
});
