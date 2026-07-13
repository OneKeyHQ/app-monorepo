import nodeCrypto from 'node:crypto';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { VAULT_HKDF_INFO } from './constants';

export type IHkdfHash = 'sha1' | 'sha256';

const AES_GCM_AUTH_TAG_LENGTH = 16;
const AES_GCM_NONCE_LENGTH = 12;
const VAULT_KEY_LENGTH = 32;
const VAULT_HKDF_SALT = Buffer.alloc(32, 0);

export function deriveHkdfKey({
  hash,
  inputKeyMaterial,
  salt,
  info,
  length,
}: {
  hash: IHkdfHash;
  inputKeyMaterial: Buffer;
  salt: Buffer;
  info: Buffer | string;
  length: number;
}): Buffer {
  return Buffer.from(
    nodeCrypto.hkdfSync(hash, inputKeyMaterial, salt, info, length),
  );
}

export function deriveVaultKey(masterKey: Buffer): Buffer {
  return deriveHkdfKey({
    hash: 'sha256',
    inputKeyMaterial: masterKey,
    salt: VAULT_HKDF_SALT,
    info: VAULT_HKDF_INFO,
    length: VAULT_KEY_LENGTH,
  });
}

export function encryptVault(
  plaintext: Buffer,
  vaultKey: Buffer,
  aad: Buffer,
): { nonce: Buffer; ciphertextWithTag: Buffer } {
  const nonce = nodeCrypto.randomBytes(AES_GCM_NONCE_LENGTH);
  const cipher = nodeCrypto.createCipheriv('aes-256-gcm', vaultKey, nonce);
  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    nonce,
    ciphertextWithTag: Buffer.concat([ciphertext, authTag]),
  };
}

export function decryptVault(
  nonce: Buffer,
  ciphertextWithTag: Buffer,
  vaultKey: Buffer,
  aad: Buffer,
): Buffer {
  if (ciphertextWithTag.length < AES_GCM_AUTH_TAG_LENGTH) {
    throw new OneKeyLocalError('VAULT_DECRYPT_FAILED');
  }

  const authTagStart = ciphertextWithTag.length - AES_GCM_AUTH_TAG_LENGTH;
  const ciphertext = ciphertextWithTag.subarray(0, authTagStart);
  const authTag = ciphertextWithTag.subarray(authTagStart);
  const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', vaultKey, nonce);
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
