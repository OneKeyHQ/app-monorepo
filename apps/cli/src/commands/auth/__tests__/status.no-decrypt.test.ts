import axios from 'axios';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  StatusPipelineError,
  executeStatusPipeline,
} from '../_internal/status-pipeline';

import type { IVaultPlaintext, VaultClient } from '../../../infra/vault';

function createVault(): IVaultPlaintext {
  return {
    schemaVersion: 1,
    records: {
      key1234567890: {
        walletId: 'wallet1',
        accessToken: 'token',
        ciphertextBase64: 'ciphertext',
        createdAt: 1,
      },
    },
    cache: {},
    metadata: {
      activeWalletId: 'wallet1',
      activeKeyId: 'key1234567890',
      schemaVersion: 1,
      vaultCreatedAt: 1,
    },
    sessionLabels: {
      key1234567890: {
        displayAddress: '0x1234567890abcdef1234567890abcdef12345678',
        sourceLabel: 'BotWallet',
      },
    },
  };
}

function createVaultClient(
  vault: IVaultPlaintext,
): Pick<VaultClient, 'readOnly'> {
  return {
    readOnly: jest.fn(
      async <TResult>(
        reader: (vaultValue: IVaultPlaintext) => Promise<TResult> | TResult,
      ) => reader(vault),
    ),
  };
}

describe('auth status no-decrypt pipeline', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns active metadata from vault', async () => {
    const vaultClient = createVaultClient(createVault());

    await expect(executeStatusPipeline({ vaultClient })).resolves.toEqual({
      ok: true,
      data: {
        activeWalletId: 'wallet1',
        activeKeyId: 'key12345',
        displayAddress: '0x123456...345678',
        sourceLabel: 'BotWallet',
      },
    });
  });

  it('masks activeKeyId to the first 8 chars', async () => {
    const vaultClient = createVaultClient(createVault());

    const result = await executeStatusPipeline({ vaultClient });

    expect(result.data.activeKeyId).toBe('key12345');
  });

  it('masks displayAddress as first8 plus last6', async () => {
    const vaultClient = createVaultClient(createVault());

    const result = await executeStatusPipeline({ vaultClient });

    expect(result.data.displayAddress).toBe('0x123456...345678');
  });

  it('does not call axios while reading status', async () => {
    const axiosGet = jest.spyOn(axios, 'get');
    const vaultClient = createVaultClient(createVault());

    await executeStatusPipeline({ vaultClient });

    expect(axiosGet).not.toHaveBeenCalled();
  });

  it('does not read vault cache', async () => {
    const vault = createVault();
    Object.defineProperty(vault, 'cache', {
      get() {
        throw new OneKeyLocalError('cache should not be read');
      },
    });
    const vaultClient = createVaultClient(vault);

    await expect(executeStatusPipeline({ vaultClient })).resolves.toMatchObject(
      {
        ok: true,
      },
    );
  });

  it('returns NOT_AUTHENTICATED when active metadata is missing', async () => {
    const vault = createVault();
    vault.metadata.activeKeyId = null;
    const vaultClient = createVaultClient(vault);

    await expect(executeStatusPipeline({ vaultClient })).rejects.toBeInstanceOf(
      StatusPipelineError,
    );
  });
});
