import { deserialize, serialize } from '../codec';
import { VAULT_MAGIC, VAULT_SCHEMA_VERSION, VAULT_VERSION } from '../constants';
import { deriveVaultKey, encryptVault } from '../crypto';

import type { IVaultPlaintext } from '../types';

const HEADER_LENGTH = 22;

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

function createVaultKey(): Buffer {
  return deriveVaultKey(Buffer.alloc(32, 0x88));
}

function expectVaultCorrupt(action: () => unknown): void {
  expect(action).toThrow(expect.objectContaining({ code: 'VAULT_CORRUPT' }));
}

describe('vault codec', () => {
  it('roundtrips vault plaintext', () => {
    const vault = createVault();
    const vaultKey = createVaultKey();

    expect(deserialize(serialize(vault, vaultKey), vaultKey)).toEqual(vault);
  });

  it('rejects invalid magic', () => {
    const vaultKey = createVaultKey();
    const serialized = serialize(createVault(), vaultKey);
    serialized[0] = serialized[0] === 0 ? 1 : 0;

    expectVaultCorrupt(() => deserialize(serialized, vaultKey));
  });

  it('rejects invalid version', () => {
    const vaultKey = createVaultKey();
    const serialized = serialize(createVault(), vaultKey);
    serialized[VAULT_MAGIC.length] = VAULT_VERSION + 1;

    expectVaultCorrupt(() => deserialize(serialized, vaultKey));
  });

  it('rejects invalid schema version', () => {
    const vaultKey = createVaultKey();
    const serialized = serialize(createVault(), vaultKey);
    serialized[VAULT_MAGIC.length + 1] = VAULT_SCHEMA_VERSION + 1;

    expectVaultCorrupt(() => deserialize(serialized, vaultKey));
  });

  it('rejects ciphertext tampering', () => {
    const vaultKey = createVaultKey();
    const serialized = serialize(createVault(), vaultKey);
    serialized[HEADER_LENGTH] = serialized[HEADER_LENGTH] === 0 ? 1 : 0;

    expectVaultCorrupt(() => deserialize(serialized, vaultKey));
  });

  it('rejects invalid JSON plaintext', () => {
    const vaultKey = createVaultKey();
    const aad = Buffer.concat([
      VAULT_MAGIC,
      Buffer.from([VAULT_VERSION, VAULT_SCHEMA_VERSION]),
    ]);
    const encrypted = encryptVault(Buffer.from('not-json'), vaultKey, aad);
    const serialized = Buffer.concat([
      aad,
      encrypted.nonce,
      encrypted.ciphertextWithTag,
    ]);

    expectVaultCorrupt(() => deserialize(serialized, vaultKey));
  });

  it('rejects files shorter than the header', () => {
    expectVaultCorrupt(() =>
      deserialize(Buffer.alloc(HEADER_LENGTH - 1), createVaultKey()),
    );
  });
});
