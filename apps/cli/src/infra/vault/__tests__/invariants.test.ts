import { VaultError, assertVaultInvariants } from '../invariants';

import type { IVaultInvariantClass } from '../invariants';
import type { IVaultPlaintext } from '../types';

function createEmptyVault(): IVaultPlaintext {
  return {
    schemaVersion: 1,
    records: {},
    cache: {},
    metadata: {
      activeWalletId: null,
      activeKeyId: null,
      schemaVersion: 1,
      vaultCreatedAt: 1,
    },
    sessionLabels: {},
  };
}

function createSingleRecordVault(): IVaultPlaintext {
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
    cache: {
      'wallet1:key1': {
        hdCredentialBlob: 'blob',
        issuedAt: 1,
        expiresAt: 2,
      },
    },
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

function expectInvariantClass(
  vault: IVaultPlaintext,
  invariantClass: IVaultInvariantClass,
): void {
  expect(() => assertVaultInvariants(vault)).toThrow(
    expect.objectContaining({
      code: 'VAULT_CORRUPT',
      details: { class: invariantClass },
    }),
  );
}

describe('vault invariants', () => {
  it('accepts an empty vault', () => {
    expect(() => assertVaultInvariants(createEmptyVault())).not.toThrow();
  });

  it('accepts a single active record vault', () => {
    expect(() =>
      assertVaultInvariants(createSingleRecordVault()),
    ).not.toThrow();
  });

  it('rejects class A corruption when more than one record exists', () => {
    const vault = createSingleRecordVault();
    vault.records.key2 = {
      walletId: 'wallet2',
      accessToken: 'token2',
      ciphertextBase64: 'ciphertext2',
      createdAt: 2,
    };

    expectInvariantClass(vault, 'A');
  });

  it('rejects class B corruption when activeKeyId points nowhere', () => {
    const vault = createEmptyVault();
    vault.metadata.activeKeyId = 'missing';

    expectInvariantClass(vault, 'B');
  });

  it('rejects class B corruption when the single record is not active', () => {
    const vault = createSingleRecordVault();
    vault.metadata.activeKeyId = null;

    expectInvariantClass(vault, 'B');
  });

  it('rejects class C corruption for orphan session labels', () => {
    const vault = createSingleRecordVault();
    vault.sessionLabels.key2 = {
      displayAddress: '0xabcdef',
      sourceLabel: 'Other',
    };

    expectInvariantClass(vault, 'C');
  });

  it('rejects class D corruption for orphan cache entries', () => {
    const vault = createSingleRecordVault();
    vault.cache['wallet1:key2'] = {
      hdCredentialBlob: 'blob2',
      issuedAt: 1,
      expiresAt: 2,
    };

    expectInvariantClass(vault, 'D');
  });

  it('preserves class labels on VaultError instances', () => {
    const error = new VaultError('VAULT_CORRUPT', { class: 'D' });

    expect(error.code).toBe('VAULT_CORRUPT');
    expect(error.details.class).toBe('D');
  });
});
