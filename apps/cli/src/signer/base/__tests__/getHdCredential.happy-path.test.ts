import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  ABSOLUTE_MAX_TTL_MS,
  REFRESH_THRESHOLD_MS,
  SLIDING_TTL_MS,
} from '../../../infra/vault/constants';
import { SignerSoftwareBase } from '../SignerSoftwareBase';

import type { ISecureCacheKey } from '../../../core/secure-cache';
import type {
  IVaultMutationResult,
  VaultClient,
} from '../../../infra/vault/client';
import type { IFetchBotWalletKeyInput } from '../../../infra/vault/service-client';
import type { IVaultPlaintext } from '../../../infra/vault/types';

const T0 = 1_714_000_000_000;
const CACHE_KEY = 'wallet-1:key-1' as ISecureCacheKey;

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

class MemoryVaultClient implements Pick<VaultClient, 'atomicMutate'> {
  calls = 0;

  writeCount = 0;

  // eslint-disable-next-line no-useless-constructor, no-empty-function
  constructor(public vault: IVaultPlaintext) {}

  async atomicMutate<TResult>(
    mutator: (
      currentVault: IVaultPlaintext,
    ) => Promise<IVaultMutationResult<TResult>> | IVaultMutationResult<TResult>,
  ): Promise<TResult> {
    this.calls += 1;
    const mutation = await mutator(this.vault);
    if (mutation.shouldWrite !== false) {
      this.writeCount += 1;
      this.vault = mutation.nextVault;
    }
    return mutation.result;
  }
}

type IMemorySessionCache = {
  get: jest.Mock<Buffer | null, [ISecureCacheKey]>;
  set: jest.Mock<void, [ISecureCacheKey, Buffer]>;
  values: Map<ISecureCacheKey, Buffer>;
};

function createMemorySessionCache(): IMemorySessionCache {
  const values = new Map<ISecureCacheKey, Buffer>();
  return {
    values,
    get: jest.fn((key: ISecureCacheKey) => values.get(key) ?? null),
    set: jest.fn((key: ISecureCacheKey, value: Buffer) => {
      values.set(key, value);
    }),
  };
}

type IDecryptCredentialMock = jest.Mock<Promise<string>, [string, string]>;
type IFetchKeyMock = jest.Mock<
  Promise<{ keyBase64: string }>,
  [IFetchBotWalletKeyInput]
>;

function createDecryptCredentialMock(): IDecryptCredentialMock {
  return jest.fn<Promise<string>, [string, string]>(() =>
    Promise.resolve('hd-from-service'),
  );
}

function createFetchKeyMock(): IFetchKeyMock {
  return jest.fn<Promise<{ keyBase64: string }>, [IFetchBotWalletKeyInput]>(
    () => Promise.resolve({ keyBase64: 'key-base64' }),
  );
}

function createSigner({
  cache = createMemorySessionCache(),
  decryptCredential = createDecryptCredentialMock(),
  fetchKey = createFetchKeyMock(),
  now = () => T0,
  vault = createVault(),
}: {
  cache?: IMemorySessionCache;
  decryptCredential?: IDecryptCredentialMock;
  fetchKey?: IFetchKeyMock;
  now?: () => number;
  vault?: IVaultPlaintext;
} = {}) {
  const vaultClient = new MemoryVaultClient(vault);
  const signer = new SignerSoftwareBase({
    decryptCredential,
    fetchKey,
    now,
    sessionCache: cache,
    vaultClient,
  });

  return {
    cache,
    decryptCredential,
    fetchKey,
    signer,
    vaultClient,
  };
}

describe('SignerSoftwareBase.getHdCredential happy path', () => {
  it('uses Layer 1 session memo on the second call without reading vault', async () => {
    const { decryptCredential, fetchKey, signer, vaultClient } = createSigner();

    await expect(signer.getHdCredential()).resolves.toBe('hd-from-service');
    vaultClient.calls = 0;
    fetchKey.mockClear();
    decryptCredential.mockClear();

    const startedAt = performance.now();
    await expect(signer.getHdCredential()).resolves.toBe('hd-from-service');

    expect(performance.now() - startedAt).toBeLessThan(10);
    expect(vaultClient.calls).toBe(0);
    expect(fetchKey).not.toHaveBeenCalled();
    expect(decryptCredential).not.toHaveBeenCalled();
  });

  it('uses Layer 2 hit-no-write without calling service', async () => {
    const vault = createVault({
      cache: {
        [CACHE_KEY]: {
          hdCredentialBlob: 'hd-from-vault',
          issuedAt: T0,
          expiresAt: T0 + SLIDING_TTL_MS,
        },
      },
    });
    const { cache, fetchKey, signer, vaultClient } = createSigner({
      now: () => T0 + 1000,
      vault,
    });

    await expect(signer.getHdCredential()).resolves.toBe('hd-from-vault');

    expect(vaultClient.writeCount).toBe(0);
    expect(fetchKey).not.toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalledWith(CACHE_KEY, expect.any(Buffer));
  });

  it('refreshes Layer 2 when the entry is inside the 5 minute threshold', async () => {
    const vault = createVault({
      cache: {
        [CACHE_KEY]: {
          hdCredentialBlob: 'hd-near-expiry',
          issuedAt: T0,
          expiresAt: T0 + SLIDING_TTL_MS,
        },
      },
    });
    const now = T0 + SLIDING_TTL_MS - REFRESH_THRESHOLD_MS;
    const { fetchKey, signer, vaultClient } = createSigner({
      now: () => now,
      vault,
    });

    await expect(signer.getHdCredential()).resolves.toBe('hd-near-expiry');

    expect(fetchKey).not.toHaveBeenCalled();
    expect(vaultClient.writeCount).toBe(1);
    expect(vaultClient.vault.cache[CACHE_KEY].expiresAt).toBe(
      now + SLIDING_TTL_MS,
    );
  });

  it('fetches the service key, decrypts ciphertext, and writes cache on miss', async () => {
    const { cache, decryptCredential, fetchKey, signer, vaultClient } =
      createSigner();

    const startedAt = performance.now();
    await expect(signer.getHdCredential()).resolves.toBe('hd-from-service');

    expect(performance.now() - startedAt).toBeLessThan(50);
    expect(fetchKey).toHaveBeenCalledWith({
      accessToken: 'token-1',
      keyId: 'key-1',
    });
    expect(decryptCredential).toHaveBeenCalledWith(
      'ciphertext-1',
      'key-base64',
    );
    expect(vaultClient.writeCount).toBe(1);
    expect(vaultClient.vault.cache[CACHE_KEY]).toEqual({
      hdCredentialBlob: 'hd-from-service',
      issuedAt: T0,
      expiresAt: T0 + SLIDING_TTL_MS,
    });
    expect(cache.set).toHaveBeenCalledWith(CACHE_KEY, expect.any(Buffer));
  });

  it('keeps 24h Layer 2 refresh writes within budget', async () => {
    let now = T0;
    const cache = createMemorySessionCache();
    cache.get.mockImplementation(() => null);
    const vault = createVault({
      cache: {
        [CACHE_KEY]: {
          hdCredentialBlob: 'hd-from-vault',
          issuedAt: T0,
          expiresAt: T0 + SLIDING_TTL_MS,
        },
      },
    });
    const { signer, vaultClient } = createSigner({
      cache,
      now: () => now,
      vault,
    });

    for (let index = 0; index < 1000; index += 1) {
      now = T0 + Math.floor((ABSOLUTE_MAX_TTL_MS * index) / 1000);
      await signer.getHdCredential();
    }

    expect(vaultClient.writeCount).toBeLessThanOrEqual(25);
  });

  it('rejects missing active metadata without service calls', async () => {
    const { fetchKey, signer } = createSigner({
      vault: createVault({
        metadata: {
          activeWalletId: null,
          activeKeyId: null,
          schemaVersion: 1,
          vaultCreatedAt: T0,
        },
      }),
    });

    await expect(signer.getHdCredential()).rejects.toMatchObject({
      code: 'NOT_AUTHENTICATED',
    });
    expect(fetchKey).not.toHaveBeenCalled();
  });

  it('does not introduce timer-based async paths inside getHdCredential', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../SignerSoftwareBase.ts'),
      'utf-8',
    );
    const methodSource = source.match(
      /async getHdCredential\(\): Promise<string> \{[\s\S]*?\n {2}\}/,
    )?.[0];

    expect(methodSource).toBeDefined();
    expect(methodSource).not.toMatch(
      /setImmediate|setTimeout|process\.nextTick/,
    );
  });
});
