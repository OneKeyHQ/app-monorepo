import { VaultClientError } from '../../../infra/vault/errors';
import { SignerSoftwareBase } from '../SignerSoftwareBase';

import type { ISecureCacheKey } from '../../../core/secure-cache';
import type { IVaultMutationResult } from '../../../infra/vault/client';
import type { IVaultPlaintext } from '../../../infra/vault/types';

const T0 = 1_714_000_000_000;

function createVault(): IVaultPlaintext {
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
  };
}

function createSessionCache() {
  return {
    get: jest.fn(() => null),
    set: jest.fn<void, [ISecureCacheKey, Buffer]>(),
  };
}

function createThrowingVaultClient(error: Error) {
  return {
    async atomicMutate<TResult>(): Promise<TResult> {
      throw error;
    },
  };
}

function createWriteFailAfterMutationVaultClient() {
  const release = jest.fn();
  return {
    release,
    async atomicMutate<TResult>(
      mutator: (
        currentVault: IVaultPlaintext,
      ) =>
        | Promise<IVaultMutationResult<TResult>>
        | IVaultMutationResult<TResult>,
    ): Promise<TResult> {
      await mutator(createVault());
      release();
      throw new VaultClientError('VAULT_WRITE_FAILED');
    },
  };
}

describe('SignerSoftwareBase fail-secure cache behavior', () => {
  it('maps VAULT_MISSING without writing Layer 1 cache', async () => {
    const cache = createSessionCache();
    const signer = new SignerSoftwareBase({
      sessionCache: cache,
      vaultClient: createThrowingVaultClient(
        new VaultClientError('VAULT_MISSING'),
      ),
    });

    await expect(signer.getHdCredential()).rejects.toMatchObject({
      code: 'VAULT_MISSING',
    });
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('maps vault write failure and does not write Layer 1 cache', async () => {
    const cache = createSessionCache();
    const vaultClient = createWriteFailAfterMutationVaultClient();
    const signer = new SignerSoftwareBase({
      decryptCredential: jest.fn(async () => 'hd-credential'),
      fetchKey: jest.fn(async () => ({ keyBase64: 'key-base64' })),
      sessionCache: cache,
      vaultClient,
    });

    await expect(signer.getHdCredential()).rejects.toMatchObject({
      code: 'VAULT_WRITE_FAILED',
    });
    expect(cache.set).not.toHaveBeenCalled();
    expect(vaultClient.release).toHaveBeenCalledTimes(1);
  });

  it('maps missing master key to NOT_AUTHENTICATED', async () => {
    const signer = new SignerSoftwareBase({
      vaultClient: createThrowingVaultClient(
        new VaultClientError('NOT_AUTHENTICATED'),
      ),
    });

    await expect(signer.getHdCredential()).rejects.toMatchObject({
      code: 'NOT_AUTHENTICATED',
    });
  });

  it('maps corrupt vault to VAULT_CORRUPT', async () => {
    const signer = new SignerSoftwareBase({
      vaultClient: createThrowingVaultClient(
        new VaultClientError('VAULT_CORRUPT'),
      ),
    });

    await expect(signer.getHdCredential()).rejects.toMatchObject({
      code: 'VAULT_CORRUPT',
    });
  });
});
