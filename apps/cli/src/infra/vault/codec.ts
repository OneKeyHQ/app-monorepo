import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';

import { VAULT_MAGIC, VAULT_SCHEMA_VERSION, VAULT_VERSION } from './constants';
import { decryptVault, encryptVault } from './crypto';

import type { IVaultPlaintext } from './types';

const VERSION_OFFSET = VAULT_MAGIC.length;
const SCHEMA_VERSION_OFFSET = VERSION_OFFSET + 1;
const NONCE_OFFSET = SCHEMA_VERSION_OFFSET + 1;
const NONCE_LENGTH = 12;
const HEADER_LENGTH = NONCE_OFFSET + NONCE_LENGTH;

export class VaultCodecError extends Error {
  readonly code = 'VAULT_CORRUPT';

  constructor() {
    super('VAULT_CORRUPT');
    this.name = 'VaultCodecError';
  }
}

function createVaultCorruptError(): VaultCodecError {
  return new VaultCodecError();
}

function getVaultAad(): Buffer {
  return Buffer.from([VAULT_VERSION, VAULT_SCHEMA_VERSION]);
}

function getHeaderAad(): Buffer {
  return Buffer.concat([VAULT_MAGIC, getVaultAad()]);
}

function assertHeader(buf: Buffer): void {
  if (buf.length < HEADER_LENGTH) {
    throw createVaultCorruptError();
  }

  if (!buf.subarray(0, VAULT_MAGIC.length).equals(VAULT_MAGIC)) {
    throw createVaultCorruptError();
  }

  if (buf[VERSION_OFFSET] !== VAULT_VERSION) {
    throw createVaultCorruptError();
  }

  if (buf[SCHEMA_VERSION_OFFSET] !== VAULT_SCHEMA_VERSION) {
    throw createVaultCorruptError();
  }
}

export function serialize(
  plaintext: IVaultPlaintext,
  vaultKey: Buffer,
): Buffer {
  const aad = getHeaderAad();
  const encodedPlaintext = Buffer.from(stableStringify(plaintext), 'utf8');
  const encrypted = encryptVault(encodedPlaintext, vaultKey, aad);

  return Buffer.concat([aad, encrypted.nonce, encrypted.ciphertextWithTag]);
}

export function deserialize(buf: Buffer, vaultKey: Buffer): IVaultPlaintext {
  try {
    assertHeader(buf);

    const aad = buf.subarray(0, NONCE_OFFSET);
    const nonce = buf.subarray(NONCE_OFFSET, HEADER_LENGTH);
    const ciphertextWithTag = buf.subarray(HEADER_LENGTH);
    const plaintext = decryptVault(nonce, ciphertextWithTag, vaultKey, aad);
    const decoded: unknown = JSON.parse(plaintext.toString('utf8'));

    return decoded as IVaultPlaintext;
  } catch {
    throw createVaultCorruptError();
  }
}
