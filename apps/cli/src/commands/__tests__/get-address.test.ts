import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createVaultAddressCacheKey } from '../../infra/vault';
import { executeGetAddressCommand } from '../get-address';

import type { IVaultPlaintext, VaultClient } from '../../infra/vault';

const T0 = 1_714_000_000_000;
const ADDRESS = '0x1111111111111111111111111111111111111111';

function createVault(includeAddress = true): IVaultPlaintext {
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
    cache: includeAddress
      ? {
          [createVaultAddressCacheKey('wallet-1', 'key-1')]: {
            hdCredentialBlob: ADDRESS,
            issuedAt: T0,
            expiresAt: T0 + 24 * 60 * 60 * 1000,
          },
        }
      : {},
    metadata: {
      activeWalletId: 'wallet-1',
      activeKeyId: 'key-1',
      schemaVersion: 1,
      vaultCreatedAt: T0,
    },
    sessionLabels: {},
  };
}

function createOutput() {
  return {
    error: jest.fn(),
    raw: jest.fn(),
    success: jest.fn(),
  };
}

class MemoryVaultClient implements Pick<VaultClient, 'readOnly'> {
  calls = 0;

  // eslint-disable-next-line no-useless-constructor, no-empty-function
  constructor(private readonly vault: IVaultPlaintext) {}

  async readOnly<TResult>(
    reader: (currentVault: IVaultPlaintext) => Promise<TResult> | TResult,
  ): Promise<TResult> {
    this.calls += 1;
    return reader(this.vault);
  }
}

describe('onekey get-address command', () => {
  afterEach(() => {
    process.exitCode = 0;
  });

  it('returns the masked active address by default', async () => {
    const output = createOutput();
    const vaultClient = new MemoryVaultClient(createVault());

    await executeGetAddressCommand({}, { output, vaultClient });

    expect(vaultClient.calls).toBe(1);
    expect(output.success).toHaveBeenCalledWith({
      address: '0x111111...111111',
    });
    expect(output.raw).not.toHaveBeenCalled();
    expect(output.error).not.toHaveBeenCalled();
  });

  it('returns the full address with --format=text', async () => {
    const output = createOutput();
    const vaultClient = new MemoryVaultClient(createVault());

    await executeGetAddressCommand({ format: 'text' }, { output, vaultClient });

    expect(output.raw).toHaveBeenCalledWith(ADDRESS);
    expect(output.success).not.toHaveBeenCalled();
  });

  it('returns ADDRESS_NOT_DERIVED when the address subnode is missing', async () => {
    const output = createOutput();
    const vaultClient = new MemoryVaultClient(createVault(false));

    await executeGetAddressCommand({}, { output, vaultClient });

    expect(output.success).not.toHaveBeenCalled();
    expect(output.error).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'ADDRESS_NOT_DERIVED',
      }),
    );
    expect(process.exitCode).toBe(1);
  });

  it('does not import axios, secureCache, or getHdCredential', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../get-address.ts'),
      'utf-8',
    );

    expect(source).not.toMatch(/axios|secureCache\.set|getHdCredential/);
  });
});
