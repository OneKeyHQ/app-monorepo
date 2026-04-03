import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt as scryptCb,
} from 'node:crypto';

import { AppError, ERROR_CODES } from '../errors';

import type { ScryptOptions } from 'node:crypto';

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

const SALT_LENGTH = 32;
const NONCE_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const HEADER_LENGTH = SALT_LENGTH + NONCE_LENGTH + AUTH_TAG_LENGTH;

const SCRYPT_N = 131_072;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 256 * 1024 * 1024;

const ALGORITHM = 'aes-256-gcm';

async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
}

export async function encrypt(
  plaintext: Buffer,
  password: string,
): Promise<Buffer> {
  const salt = randomBytes(SALT_LENGTH);
  const nonce = randomBytes(NONCE_LENGTH);
  const key = await deriveKey(password, salt);

  try {
    const cipher = createCipheriv(ALGORITHM, key, nonce);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([salt, nonce, authTag, ciphertext]);
  } finally {
    key.fill(0);
  }
}

export async function decrypt(
  encrypted: Buffer,
  password: string,
): Promise<Buffer> {
  if (encrypted.length < HEADER_LENGTH) {
    throw new AppError(
      ERROR_CODES.SEC_DECRYPTION_FAILED.code,
      'Encrypted data is too short to contain valid header',
      'Ensure the encrypted data is not corrupted or truncated',
    );
  }

  const salt = encrypted.subarray(0, SALT_LENGTH);
  const nonce = encrypted.subarray(SALT_LENGTH, SALT_LENGTH + NONCE_LENGTH);
  const authTag = encrypted.subarray(SALT_LENGTH + NONCE_LENGTH, HEADER_LENGTH);
  const ciphertext = encrypted.subarray(HEADER_LENGTH);
  const key = await deriveKey(password, salt);

  try {
    const decipher = createDecipheriv(ALGORITHM, key, nonce);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (error) {
    throw new AppError(
      ERROR_CODES.SEC_DECRYPTION_FAILED.code,
      'Decryption failed: invalid password or corrupted data',
      'Verify the password is correct and the encrypted data is not corrupted',
      { cause: error },
    );
  } finally {
    key.fill(0);
  }
}

export function secureWipe(buffer: Buffer): void {
  buffer.fill(0);
}
