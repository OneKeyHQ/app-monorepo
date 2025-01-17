import crypto from 'crypto';

import {
  AES_CBC,
  HmacSha256,
  HmacSha512,
  Pbkdf2HmacSha256,
  Sha256,
} from 'asmcrypto.js';

// Below codes are comments to note algorithm and digest method used.
// const ALGORITHM = 'aes-256-cbc';
// const PBKDF2_DIGEST_METHOD = 'sha256';
export const PBKDF2_NUM_OF_ITERATIONS = 5000;
export const PBKDF2_KEY_LENGTH = 32;
export const PBKDF2_SALT_LENGTH = 32;
export const AES256_IV_LENGTH = 16;
export const ENCRYPTED_DATA_OFFSET = PBKDF2_SALT_LENGTH + AES256_IV_LENGTH;

export function hmacSHA256(key: Buffer, data: Buffer): Buffer {
  return Buffer.from(
    new HmacSha256(key).process(data).finish().result as Uint8Array,
  );
}

export function hmacSHA512(key: Buffer, data: Buffer): Buffer {
  return Buffer.from(
    new HmacSha512(key).process(data).finish().result as Uint8Array,
  );
}

export function sha256(data: Buffer): Buffer {
  return Buffer.from(new Sha256().process(data).finish().result as Uint8Array);
}

export function hash160(data: Buffer): Buffer {
  return crypto.createHash('ripemd160').update(sha256(data)).digest();
}

export function keyFromPasswordAndSalt(password: string, salt: Buffer): Buffer {
  return Buffer.from(
    Pbkdf2HmacSha256(
      sha256(Buffer.from(password, 'utf8')),
      salt,
      PBKDF2_NUM_OF_ITERATIONS,
      PBKDF2_KEY_LENGTH,
    ),
  );
}

export function aesCbcEncrypt({
  iv,
  key,
  data,
}: {
  iv: Buffer;
  key: Buffer;
  data: Buffer;
}): Buffer {
  // Buffer.from(AES_CBC.encrypt(data, key, true, iv))
  return Buffer.from(AES_CBC.encrypt(data, key, true, iv));
}

export function aesCbcDecrypt({
  iv,
  key,
  data,
}: {
  iv: Buffer;
  key: Buffer;
  data: Buffer;
}): Buffer {
  // AES_CBC.decrypt(
  //   dataBuffer.slice(ENCRYPTED_DATA_OFFSET),
  //   key,
  //   true,
  //   iv,
  // )
  return Buffer.from(AES_CBC.decrypt(data, key, true, iv));
}
