import { createHash } from 'crypto';

// Below codes are comments to note algorithm and digest method used.
// const ALGORITHM = 'aes-256-cbc';
// const PBKDF2_DIGEST_METHOD = 'sha256';
export const PBKDF2_NUM_OF_ITERATIONS = 5000;
export const PBKDF2_KEY_LENGTH = 32;
export const PBKDF2_SALT_LENGTH = 32;
export const AES256_IV_LENGTH = 16;
export const ENCRYPTED_DATA_OFFSET = PBKDF2_SALT_LENGTH + AES256_IV_LENGTH;

export async function hmacSHA256(key: Buffer, data: Buffer): Promise<Buffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return Buffer.from(signature);
}

export async function hmacSHA512(key: Buffer, data: Buffer): Promise<Buffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return Buffer.from(signature);
}

export async function sha256(data: Buffer): Promise<Buffer> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(hash);
}

export async function hash160(data: Buffer): Promise<Buffer> {
  const sha256Hash = await sha256(data);
  return createHash('ripemd160').update(sha256Hash).digest();
}

export async function keyFromPasswordAndSalt(
  password: string,
  salt: Buffer,
): Promise<Buffer> {
  const hashedPassword = await sha256(Buffer.from(password, 'utf8'));
  const key = await crypto.subtle.importKey(
    'raw',
    hashedPassword,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_NUM_OF_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    PBKDF2_KEY_LENGTH * 8,
  );
  return Buffer.from(derivedBits);
}

export async function aesCbcEncrypt({
  iv,
  key,
  data,
}: {
  iv: Buffer;
  key: Buffer;
  data: Buffer;
}): Promise<Buffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC', length: 256 },
    false,
    ['encrypt'],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    data,
  );
  return Buffer.from(encrypted);
}

export async function aesCbcDecrypt({
  iv,
  key,
  data,
}: {
  iv: Buffer;
  key: Buffer;
  data: Buffer;
}): Promise<Buffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC', length: 256 },
    false,
    ['decrypt'],
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    data,
  );
  return Buffer.from(decrypted);
}
