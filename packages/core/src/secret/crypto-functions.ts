import crypto from 'crypto';

// Below codes are comments to note algorithm and digest method used.
// const ALGORITHM = 'aes-256-cbc';
// const PBKDF2_DIGEST_METHOD = 'sha256';
export const PBKDF2_NUM_OF_ITERATIONS = 5000;
export const PBKDF2_KEY_LENGTH = 32;
export const PBKDF2_SALT_LENGTH = 32;
export const AES256_IV_LENGTH = 16;
export const ENCRYPTED_DATA_OFFSET = PBKDF2_SALT_LENGTH + AES256_IV_LENGTH;

export function hmacSHA256(key: Buffer, data: Buffer): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

export function hmacSHA512(key: Buffer, data: Buffer): Buffer {
  return crypto.createHmac('sha512', key).update(data).digest();
}

export function sha256(data: Buffer): Buffer {
  return crypto.createHash('sha256').update(data).digest();
}

export function hash160(data: Buffer): Buffer {
  return crypto.createHash('ripemd160').update(sha256(data)).digest();
}

export function keyFromPasswordAndSalt(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    sha256(Buffer.from(password, 'utf8')),
    salt,
    PBKDF2_NUM_OF_ITERATIONS,
    PBKDF2_KEY_LENGTH,
    'sha256',
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
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([cipher.update(data), cipher.final()]);
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
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
