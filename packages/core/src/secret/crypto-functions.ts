import { createHash, pbkdf2 as pbkdf2Node } from 'crypto';

import RN_AES from 'react-native-aes-crypto';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Below codes are comments to note algorithm and digest method used.
// const ALGORITHM = 'aes-256-cbc';
// const PBKDF2_DIGEST_METHOD = 'sha256';
export const PBKDF2_NUM_OF_ITERATIONS = 5000;
export const PBKDF2_KEY_LENGTH = 32;
export const PBKDF2_SALT_LENGTH = 32;
export const AES256_IV_LENGTH = 16;
export const ENCRYPTED_DATA_OFFSET = PBKDF2_SALT_LENGTH + AES256_IV_LENGTH;

export async function hmacSHA256(key: Buffer, data: Buffer): Promise<Buffer> {
  if (platformEnv.isNative) {
    /*
    + (NSString *) hmac256: (NSString *)input key: (NSString *)key {
    NSData *keyData = [self fromHex:key];
    NSData* inputData = [input dataUsingEncoding:NSUTF8StringEncoding];
    */
    const signature = await RN_AES.hmac256(
      data.toString('utf8'),
      key.toString('hex'),
    );
    return Buffer.from(signature, 'hex');
  }

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
  if (platformEnv.isNative) {
    /*
    + (NSString *) hmac512: (NSString *)input key: (NSString *)key {
    NSData *keyData = [self fromHex:key];
    NSData* inputData = [input dataUsingEncoding:NSUTF8StringEncoding];
    */
    const signature = await RN_AES.hmac512(
      data.toString('utf8'),
      key.toString('hex'),
    );
    return Buffer.from(signature, 'hex');
  }

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
  if (platformEnv.isNative) {
    /*
    + (NSString *) sha256: (NSString *)input {
    NSData* inputData = [input dataUsingEncoding:NSUTF8StringEncoding];
    */
    const hash = await RN_AES.sha256(data.toString('utf8'));
    return Buffer.from(hash, 'hex');
  }

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
  if (platformEnv.isNative) {
    /*
    NSData *passwordData = [password dataUsingEncoding:NSUTF8StringEncoding];
    NSData *saltData = [salt dataUsingEncoding:NSUTF8StringEncoding];
    */
    // TODO not matched with RN_AES.pbkdf2
    // const hashedPassword = await sha256(Buffer.from(password, 'utf8'));
    // const key = await RN_AES.pbkdf2(
    //   hashedPassword.toString('utf8'),
    //   salt.toString('utf8'),
    //   PBKDF2_NUM_OF_ITERATIONS, // 5000
    //   PBKDF2_KEY_LENGTH * 8, // 32
    //   'sha256', // sha512 sha256
    // );
    // console.log('key', key);
    // return Buffer.from(key, 'hex');

    // node version ----------------------------------------------
    // import { pbkdf2 as pbkdf2Node } from 'crypto';
    const hashedPassword = await sha256(Buffer.from(password, 'utf8'));
    return new Promise((resolve, reject) => {
      pbkdf2Node(
        hashedPassword,
        salt,
        PBKDF2_NUM_OF_ITERATIONS,
        PBKDF2_KEY_LENGTH,
        'sha256',
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        },
      );
    });

    // ethersproject version ----------------------------------------------
    // import { pbkdf2 as pbkdf2Ethers } from '@ethersproject/pbkdf2';
    // const hashedPassword = await sha256(Buffer.from(password, 'utf8'));
    // const key = pbkdf2Ethers(
    //   hashedPassword,
    //   salt,
    //   PBKDF2_NUM_OF_ITERATIONS,
    //   PBKDF2_KEY_LENGTH,
    //   'sha256',
    // );
    // console.log('key', key);
    // return bufferUtils.toBuffer(key, 'hex');

    // asmcrypto.js version ----------------------------------------------
    // import { Pbkdf2HmacSha256 } from 'asmcrypto.js';
    // return Buffer.from(
    //   Pbkdf2HmacSha256(
    //     sha256(Buffer.from(password, 'utf8')),
    //     salt,
    //     PBKDF2_NUM_OF_ITERATIONS,
    //     PBKDF2_KEY_LENGTH,
    //   ),
    // );
  }

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
  if (platformEnv.isNative) {
    /* 
    data:[clearText dataUsingEncoding:NSUTF8StringEncoding]
    NSData *keyData = [self fromHex:key];
    NSData *ivData = [self fromHex:iv];
    */
    const encrypted = await RN_AES.encrypt(
      data.toString('utf8'),
      key.toString('hex'),
      iv.toString('hex'),
      'aes-256-cbc',
    );
    console.log('encrypted', encrypted);
    return Buffer.from(encrypted, 'base64');
  }

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
  if (platformEnv.isNative) {
    /*
    [self AESCBC:@"decrypt" data:[[NSData alloc] initWithBase64EncodedString:cipherText options:0] key:key iv:iv 
    */
    const decrypted = await RN_AES.decrypt(
      data.toString('base64'),
      key.toString('hex'),
      iv.toString('hex'),
      'aes-256-cbc',
    );
    console.log('decrypted', decrypted);
    return Buffer.from(decrypted, 'utf8');
  }

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
