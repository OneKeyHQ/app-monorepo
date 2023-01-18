import * as crypto from 'crypto';

import { AES_CBC, Pbkdf2HmacSha256 } from 'asmcrypto.js';

import { IncorrectPassword } from '@onekeyhq/shared/src/errors/common-errors';

import { sha256 } from '../hash';

// Below codes are comments to note algorithm and digest method used.
// const ALGORITHM = 'aes-256-cbc';
// const PBKDF2_DIGEST_METHOD = 'sha256';
const PBKDF2_NUM_OF_ITERATIONS = 5000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_SALT_LENGTH = 32;
const AES256_IV_LENGTH = 16;
const ENCRYPTED_DATA_OFFSET = PBKDF2_SALT_LENGTH + AES256_IV_LENGTH;

function keyFromPasswordAndSalt(password: string, salt: Buffer): Buffer {
  return Buffer.from(
    Pbkdf2HmacSha256(
      sha256(Buffer.from(password, 'utf8')),
      salt,
      PBKDF2_NUM_OF_ITERATIONS,
      PBKDF2_KEY_LENGTH,
    ),
  );
}

function encrypt(password: string, data: Buffer): Buffer {
  const salt: Buffer = crypto.randomBytes(PBKDF2_SALT_LENGTH);
  const key: Buffer = keyFromPasswordAndSalt(password, salt);
  const iv: Buffer = crypto.randomBytes(AES256_IV_LENGTH);
  return Buffer.concat([
    salt,
    iv,
    Buffer.from(AES_CBC.encrypt(data, key, true, iv)),
  ]);
}

function decrypt(password: string, data: Buffer): Buffer {
  const salt: Buffer = data.slice(0, PBKDF2_SALT_LENGTH);
  const key: Buffer = keyFromPasswordAndSalt(password, salt);
  const iv: Buffer = data.slice(PBKDF2_SALT_LENGTH, ENCRYPTED_DATA_OFFSET);

  try {
    return Buffer.from(
      AES_CBC.decrypt(data.slice(ENCRYPTED_DATA_OFFSET), key, true, iv),
    );
  } catch {
    throw new IncorrectPassword();
  }
}

export { encrypt, decrypt };
