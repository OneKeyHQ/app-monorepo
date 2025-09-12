/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  createHash as createHashByNode,
  createHmac as createHmacByNode,
} from 'crypto';

import { hmac as hmacByNobleFn } from '@noble/hashes/hmac';
import { ripemd160 as ripemd160ByNobleFn } from '@noble/hashes/ripemd160';
import { sha256 as sha256ByNobleFn } from '@noble/hashes/sha256';
import { sha512 as sha512ByNobleFn } from '@noble/hashes/sha512';
import {
  HmacSha256 as AsmcryptoHmacSha256,
  HmacSha512 as AsmcryptoHmacSha512,
  Pbkdf2HmacSha256 as AsmcryptoPbkdf2HmacSha256,
  Sha256 as AsmcryptoSha256,
  Sha512 as AsmcryptoSha512,
} from 'asmcrypto.js';
import { has } from 'lodash';

import RN_AES from '@onekeyhq/shared/src/modules3rdParty/react-native-aes-crypto';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OneKeyLocalError } from '../../errors';
import bufferUtils from '../../utils/bufferUtils';
import { ALLOW_USE_WEB_CRYPTO_SUBTLE } from '../consts';
import { runAppCryptoTestTask } from '../utils';

import type { ISha512Params } from '../types';
import type { IRunAppCryptoTestTaskResult } from '../utils';

// #region hmacSHA256

async function hmacSHA256ByRNAes(key: Buffer, data: Buffer): Promise<Buffer> {
  /*
  + (NSString *) hmac256: (NSString *)input key: (NSString *)key {
  NSData *keyData = [self fromHex:key];
  NSData* inputData = [input dataUsingEncoding:NSUTF8StringEncoding];
  */
  const signature = await RN_AES.hmac256(
    bufferUtils.bytesToHex(data),
    bufferUtils.bytesToHex(key),
  );
  return Buffer.from(signature, 'hex');
}

async function hmacSHA256ByWebCrypto(
  key: Buffer,
  data: Buffer,
): Promise<Buffer> {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await globalThis.crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    data,
  );
  return Buffer.from(signature);
}

function hmacSHA256ByAsmcrypto(key: Buffer, data: Buffer): Buffer {
  return Buffer.from(
    new AsmcryptoHmacSha256(key).process(data).finish().result as Uint8Array,
  );
}

function hmacSHA256ByNoble(key: Buffer, data: Buffer): Buffer {
  return Buffer.from(hmacByNobleFn(sha256ByNobleFn, key, data));
}

function hmacSHA256ByNodeCrypto(key: Buffer, data: Buffer): Buffer {
  return createHmacByNode('sha256', key).update(data).digest();
}

function _hmacSHA256Check(key: Buffer, data: Buffer) {
  if (!key || key.length <= 0) {
    throw new OneKeyLocalError('Zero-length key is not supported');
  }
  if (!data || data.length <= 0) {
    throw new OneKeyLocalError('Zero-length data is not supported');
  }
}

function hmacSHA256Sync(key: Buffer, data: Buffer): Buffer {
  _hmacSHA256Check(key, data);
  const r: Buffer = hmacSHA256ByAsmcrypto(key, data);
  return r;
}

async function hmacSHA256(key: Buffer, data: Buffer): Promise<Buffer> {
  _hmacSHA256Check(key, data);
  if (platformEnv.isNative) {
    const r: Buffer = await hmacSHA256ByRNAes(key, data);
    return r;
  }
  if (ALLOW_USE_WEB_CRYPTO_SUBTLE) {
    const r: Buffer = await hmacSHA256ByWebCrypto(key, data);
    return r;
  }
  const r: Buffer = hmacSHA256ByAsmcrypto(key, data);
  return r;
}

// #endregion hmacSHA256

// #region hmacSHA512
async function hmacSHA512ByRNAes(key: Buffer, data: Buffer): Promise<Buffer> {
  /*
  + (NSString *) hmac512: (NSString *)input key: (NSString *)key {
  NSData *keyData = [self fromHex:key];
  NSData* inputData = [input dataUsingEncoding:NSUTF8StringEncoding];
  */
  const signature = await RN_AES.hmac512(
    bufferUtils.bytesToHex(data),
    bufferUtils.bytesToHex(key),
  );
  return Buffer.from(signature, 'hex');
}

async function hmacSHA512ByWebCrypto(
  key: Buffer,
  data: Buffer,
): Promise<Buffer> {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const signature = await globalThis.crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    data,
  );
  return Buffer.from(signature);
}

// TODO sometimes very slow
function hmacSHA512ByAsmcrypto(key: Buffer, data: Buffer): Buffer {
  return Buffer.from(
    new AsmcryptoHmacSha512(key).process(data).finish().result as Uint8Array,
  );
}

function hmacSHA512ByNoble(key: Buffer, data: Buffer): Buffer {
  return Buffer.from(hmacByNobleFn(sha512ByNobleFn, key, data));
}

function hmacSHA512ByNodeCrypto(key: Buffer, data: Buffer): Buffer {
  return createHmacByNode('sha512', key).update(data).digest();
}

function _hmacSHA512Check(key: Buffer, data: Buffer) {
  if (!key || key.length <= 0) {
    throw new OneKeyLocalError('Zero-length key is not supported');
  }
  if (!data || data.length <= 0) {
    throw new OneKeyLocalError('Zero-length data is not supported');
  }
}

function hmacSHA512Sync(key: Buffer, data: Buffer): Buffer {
  _hmacSHA512Check(key, data);
  const r: Buffer = hmacSHA512ByAsmcrypto(key, data);
  return r;
}

async function hmacSHA512(key: Buffer, data: Buffer): Promise<Buffer> {
  _hmacSHA512Check(key, data);
  if (platformEnv.isNative) {
    const r: Buffer = await hmacSHA512ByRNAes(key, data);
    return r;
  }
  if (ALLOW_USE_WEB_CRYPTO_SUBTLE) {
    const r: Buffer = await hmacSHA512ByWebCrypto(key, data);
    return r;
  }
  const r: Buffer = hmacSHA512ByAsmcrypto(key, data);
  return r;
}

// #endregion hmacSHA512

// #region sha256

async function sha256ByRNAes(data: Buffer): Promise<Buffer> {
  /*
  + (NSString *) sha256: (NSString *)input {
  NSData* inputData = [input dataUsingEncoding:NSUTF8StringEncoding];
  */
  const hash = await RN_AES.sha256(bufferUtils.bytesToHex(data));
  return Buffer.from(hash, 'hex');
}

async function sha256ByWebCrypto(data: Buffer): Promise<Buffer> {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Buffer.from(hash);
}

function sha256ByAsmcrypto(data: Buffer): Buffer {
  const result: Uint8Array | null = new AsmcryptoSha256()
    .process(data)
    .finish().result;
  if (!result) {
    throw new OneKeyLocalError('Failed to hash data by Sha256ByAsmcrypto');
  }
  return Buffer.from(result);
}

function sha256ByNoble(data: Buffer): Buffer {
  return Buffer.from(sha256ByNobleFn(data));
}

function sha256ByNodeCrypto(data: Buffer): Buffer {
  return createHashByNode('sha256').update(data).digest();
}

function _sha256Check(data: Buffer) {
  if (!data || data.length <= 0) {
    throw new OneKeyLocalError('Zero-length data is not supported');
  }
}

function sha256Sync(data: Buffer): Buffer {
  _sha256Check(data);
  const r: Buffer = sha256ByAsmcrypto(data);
  return r;
}

async function sha256(data: Buffer): Promise<Buffer> {
  // in web environment, if async function (globalThis.crypto.subtle) is executed in indexedDB.transaction, it will cause the transaction to be committed prematurely, so here use synchronous function
  // ------------------------------------------------------------
  _sha256Check(data);
  if (platformEnv.isNative) {
    const r: Buffer = await sha256ByRNAes(data);
    return r;
  }
  if (ALLOW_USE_WEB_CRYPTO_SUBTLE) {
    const r: Buffer = await sha256ByWebCrypto(data);
    return r;
  }
  const r: Buffer = sha256ByAsmcrypto(data);
  return r;
}

// #endregion sha256

// #region sha512
async function sha512ByRNAes(data: Buffer): Promise<Buffer> {
  /*
  + (NSString *) sha512: (NSString *)input {
  NSData* inputData = [input dataUsingEncoding:NSUTF8StringEncoding];
  */
  const hash = await RN_AES.sha512(bufferUtils.bytesToHex(data));
  return Buffer.from(hash, 'hex');
}

async function sha512ByWebCrypto(data: Buffer): Promise<Buffer> {
  const hash = await globalThis.crypto.subtle.digest('SHA-512', data);
  return Buffer.from(hash);
}

function sha512ByAsmcrypto(data: Buffer): Buffer {
  const result: Uint8Array | null = new AsmcryptoSha512()
    .process(data)
    .finish().result;
  if (!result) {
    throw new OneKeyLocalError('Failed to hash data by Sha256ByAsmcrypto');
  }
  return Buffer.from(result);
}

function sha512ByNoble(data: Buffer): Buffer {
  return Buffer.from(sha512ByNobleFn(data));
}

function sha512ByNodeCrypto(data: Buffer): Buffer {
  return createHashByNode('sha512').update(data).digest();
}

function _sha512Check(data: Buffer) {
  if (!data || data.length <= 0) {
    throw new OneKeyLocalError('Zero-length data is not supported');
  }
}

function sha512Sync(data: Buffer): Buffer {
  _sha512Check(data);
  const r: Buffer = sha512ByAsmcrypto(data);
  return r;
}

async function sha512(data: Buffer): Promise<Buffer> {
  _sha512Check(data);
  if (platformEnv.isNative) {
    const r: Buffer = await sha512ByRNAes(data);
    return r;
  }
  if (ALLOW_USE_WEB_CRYPTO_SUBTLE) {
    const r: Buffer = await sha512ByWebCrypto(data);
    return r;
  }
  const r: Buffer = sha512ByAsmcrypto(data);
  return r;
}

// #endregion sha512

// #region sha512Pro
function _sha512ProCheck(params: ISha512Params) {
  if (!params.data) {
    throw new OneKeyLocalError('data is required');
  }
  if (!params.iterations || params.iterations < 1) {
    throw new OneKeyLocalError('iterations must be greater than 0');
  }
}

function sha512ProByNoble({
  data,
  iterations = 1,
  iterationSalt,
}: ISha512Params): string {
  _sha512ProCheck({ data, iterations, iterationSalt });

  let hash: string = bufferUtils.bytesToHex(sha512ByNobleFn(data));
  for (let i = 1; i < iterations; i += 1) {
    const nextHash = iterationSalt
      ? [hash, iterationSalt, data, i, iterations].join('')
      : hash;
    hash = bufferUtils.bytesToHex(sha512ByNobleFn(nextHash));
  }
  return hash;
}

async function sha512ProAsync({
  data,
  iterations = 1,
  iterationSalt,
}: ISha512Params): Promise<string> {
  _sha512ProCheck({ data, iterations, iterationSalt });

  let hash: string = bufferUtils.bytesToHex(
    await sha512(bufferUtils.utf8ToBytes(data)),
  );
  for (let i = 1; i < iterations; i += 1) {
    const nextHash = iterationSalt
      ? [hash, iterationSalt, data, i, iterations].join('')
      : hash;
    hash = bufferUtils.bytesToHex(
      await sha512(bufferUtils.utf8ToBytes(nextHash)),
    );
  }
  return hash;
}

function sha512ProSync({
  data,
  iterations = 1,
  iterationSalt,
}: ISha512Params): string {
  _sha512ProCheck({ data, iterations, iterationSalt });

  // TODO use asmcrypto
  let hash: string = bufferUtils.bytesToHex(
    sha512Sync(bufferUtils.utf8ToBytes(data)),
  );
  for (let i = 1; i < iterations; i += 1) {
    const nextHash = iterationSalt
      ? [hash, iterationSalt, data, i, iterations].join('')
      : hash;
    hash = bufferUtils.bytesToHex(
      sha512Sync(bufferUtils.utf8ToBytes(nextHash)),
    );
  }
  return hash;
}

async function sha512Pro({
  data,
  iterations = 1,
  iterationSalt,
}: ISha512Params): Promise<string> {
  _sha512ProCheck({ data, iterations, iterationSalt });

  const params: ISha512Params = { data, iterations, iterationSalt };

  // if (
  //   platformEnv.isNative &&
  //   !platformEnv.isJest &&
  //   !globalThis.$onekeyAppWebembedApiWebviewInitFailed
  // ) {
  //   // TODO use RN_AES
  //   const webembedApiProxy = (
  //     await import('@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy')
  //   ).default;
  //   const str = await webembedApiProxy.secret.sha512Async(params);
  //   return str;
  // }
  if (platformEnv.isNative) {
    const r: string = await sha512ProAsync(params);
    return r;
  }
  if (ALLOW_USE_WEB_CRYPTO_SUBTLE) {
    const r: string = await sha512ProAsync(params);
    return r;
  }
  const r: string = sha512ProSync(params);
  return r;
}

// #endregion sha512Pro

// #region hash160

async function hash160ByRNAes(data: Buffer): Promise<Buffer> {
  const sha256Hash = await sha256ByRNAes(data);
  // Note: react-native-aes-crypto does not support ripemd160
  // Fallback to Node crypto
  return createHashByNode('ripemd160').update(sha256Hash).digest();
}

async function hash160ByWebCrypto(data: Buffer): Promise<Buffer> {
  const sha256Hash = await sha256ByWebCrypto(data);
  // Note: crypto.subtle.digest('RIPEMD-160', sha256Hash) does not support RIPEMD-160
  // Fallback to Node crypto
  const hash = createHashByNode('ripemd160').update(sha256Hash).digest();
  // const hash = await globalThis.crypto.subtle.digest('RIPEMD-160', sha256Hash);
  return Buffer.from(hash);
}

function hash160ByAsmcrypto(data: Buffer): Buffer {
  const sha256Hash = sha256ByAsmcrypto(data);
  // Note: asmcrypto.js doesn't have RIPEMD-160 implementation
  // Fallback to Node crypto
  return createHashByNode('ripemd160').update(sha256Hash).digest();
}

function hash160ByNoble(data: Buffer): Buffer {
  return Buffer.from(ripemd160ByNobleFn(sha256ByNoble(data)));
}

function hash160ByNodeCrypto(data: Buffer): Buffer {
  const sha256Hash = sha256ByNodeCrypto(data);
  return createHashByNode('ripemd160').update(sha256Hash).digest();
}

function _hash160Check(data: Buffer) {
  if (!data || data.length <= 0) {
    throw new OneKeyLocalError('Zero-length data is not supported');
  }
}

function hash160Sync(data: Buffer): Buffer {
  _hash160Check(data);
  const r: Buffer = hash160ByAsmcrypto(data);
  return r;
}

async function hash160(data: Buffer): Promise<Buffer> {
  _hash160Check(data);
  if (platformEnv.isNative) {
    const r: Buffer = await hash160ByRNAes(data);
    return r;
  }
  if (ALLOW_USE_WEB_CRYPTO_SUBTLE) {
    const r: Buffer = await hash160ByWebCrypto(data);
    return r;
  }
  const r: Buffer = hash160ByAsmcrypto(data);
  return r;
}

// #endregion hash160

async function $testSampleForHash() {
  const data = Buffer.from('hello-world', 'utf8');
  const key = Buffer.from('test-key', 'utf8');

  const tasks: IRunAppCryptoTestTaskResult[] = [];

  let expect = '';

  // Test HMAC-SHA256 implementations
  expect = '9aef1d4e0edd4db31086e7a99e9c603698aca1a57450753254fc7a3481361f74';
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hmacSHA256ByRNAes',
      fn: () => hmacSHA256ByRNAes(key, data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hmacSHA256ByWebCrypto',
      fn: () => hmacSHA256ByWebCrypto(key, data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hmacSHA256ByAsmcrypto',
      fn: () => hmacSHA256ByAsmcrypto(key, data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hmacSHA256ByNoble',
      fn: () => hmacSHA256ByNoble(key, data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hmacSHA256ByNodeCrypto',
      fn: () => hmacSHA256ByNodeCrypto(key, data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hmacSHA256Sync',
      fn: () => hmacSHA256Sync(key, data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hmacSHA256',
      fn: () => hmacSHA256(key, data),
    }),
  );

  // Test HMAC-SHA512 implementations
  expect =
    '2b68f6b565571ea54ef0d28dddd7cb484f29aa748c8e2d808f7c68e53ebdc4e97caf18412432c96b51c7fc4c2b9b0cbc16bde1be1473303f9fd3e3bbd59e5708';
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hmacSHA512ByRNAes',
      fn: () => hmacSHA512ByRNAes(key, data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hmacSHA512ByWebCrypto',
      fn: () => hmacSHA512ByWebCrypto(key, data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hmacSHA512ByAsmcrypto',
      fn: () => hmacSHA512ByAsmcrypto(key, data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hmacSHA512ByNoble',
      fn: () => hmacSHA512ByNoble(key, data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hmacSHA512ByNodeCrypto',
      fn: () => hmacSHA512ByNodeCrypto(key, data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hmacSHA512Sync',
      fn: () => hmacSHA512Sync(key, data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hmacSHA512',
      fn: () => hmacSHA512(key, data),
    }),
  );

  // Test SHA256 implementations
  expect = 'afa27b44d43b02a9fea41d13cedc2e4016cfcf87c5dbf990e593669aa8ce286d';
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha256ByRNAes',
      fn: () => sha256ByRNAes(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha256ByWebCrypto',
      fn: () => sha256ByWebCrypto(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha256ByAsmcrypto',
      fn: () => sha256ByAsmcrypto(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha256ByNoble',
      fn: () => sha256ByNoble(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha256ByNodeCrypto',
      fn: () => sha256ByNodeCrypto(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha256Sync',
      fn: () => sha256Sync(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha256',
      fn: () => sha256(data),
    }),
  );

  // Test SHA512 implementations
  expect =
    '6aeefc29122a3962c90ef834f6caad0033bffcd62941b7a6205a695cc39e2767db7778a7ad76d173a083b9e14b210dc0212923f481b285c784ab1fe340d7ff4d';
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha512ByRNAes',
      fn: () => sha512ByRNAes(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha512ByWebCrypto',
      fn: () => sha512ByWebCrypto(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha512ByAsmcrypto',
      fn: () => sha512ByAsmcrypto(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha512ByNoble',
      fn: () => sha512ByNoble(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha512ByNodeCrypto',
      fn: () => sha512ByNodeCrypto(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha512Sync',
      fn: () => sha512Sync(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha512',
      fn: () => sha512(data),
    }),
  );

  // Test SHA512Pro implementations
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha512ProSync',
      fn: () => {
        const str: string = sha512ProSync({
          data: bufferUtils.bytesToUtf8(data),
        });
        return Buffer.from(str, 'hex');
      },
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha512ProAsync',
      fn: async () => {
        const str: string = await sha512ProAsync({
          data: bufferUtils.bytesToUtf8(data),
        });
        return Buffer.from(str, 'hex');
      },
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha512ProByNoble',
      fn: () => {
        const str: string = sha512ProByNoble({
          data: bufferUtils.bytesToUtf8(data),
        });
        return Buffer.from(str, 'hex');
      },
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha512Pro',
      fn: async () => {
        const str: string = await sha512Pro({
          data: bufferUtils.bytesToUtf8(data),
        });
        return Buffer.from(str, 'hex');
      },
    }),
  );

  // Test SHA512Pro with iterationSalt implementations
  expect =
    'ac951ce30c3720d76b95cf369cb34f439460e5699921bc9e90d2ebb20a99dfa4537f5a93faf6fa45327db81eb450ed7a729c80a99827f499a9b834c1567da55e';
  const iterationSalt = '1234567890';
  const iterations = 5;
  // const iterations = 600_000;
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha512ProSync(iterationSalt)',
      fn: () => {
        const str: string = sha512ProSync({
          data: bufferUtils.bytesToUtf8(data),
          iterations,
          iterationSalt,
        });
        return Buffer.from(str, 'hex');
      },
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha512ProAsync(iterationSalt)',
      fn: async () => {
        const str: string = await sha512ProAsync({
          data: bufferUtils.bytesToUtf8(data),
          iterations,
          iterationSalt,
        });
        return Buffer.from(str, 'hex');
      },
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha512ProByNoble(iterationSalt)',
      fn: () => {
        const str: string = sha512ProByNoble({
          data: bufferUtils.bytesToUtf8(data),
          iterations,
          iterationSalt,
        });
        return Buffer.from(str, 'hex');
      },
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'sha512Pro(iterationSalt)',
      fn: async () => {
        const str: string = await sha512Pro({
          data: bufferUtils.bytesToUtf8(data),
          iterations,
          iterationSalt,
        });
        return Buffer.from(str, 'hex');
      },
    }),
  );

  // Test Hash160 implementations
  expect = 'e5401df4b482af6ff2c03fcd1f7f72b9b40bd53e';
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hash160ByRNAes',
      fn: () => hash160ByRNAes(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hash160ByWebCrypto',
      fn: () => hash160ByWebCrypto(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hash160ByAsmcrypto',
      fn: () => hash160ByAsmcrypto(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hash160ByNoble',
      fn: () => hash160ByNoble(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hash160ByNodeCrypto',
      fn: () => hash160ByNodeCrypto(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hash160Sync',
      fn: () => hash160Sync(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'hash160',
      fn: () => hash160(data),
    }),
  );

  console.log('testSampleForHash results', tasks);
  return {
    tasks,
    // tasksAsync: tasks
    //   .filter((t) => t.isPromise)
    //   .sort((a, b) => a.time - b.time),
    // tasksSync: tasks
    //   .filter((t) => !t.isPromise)
    //   .sort((a, b) => a.time - b.time),
    // globalCrypto: Object.keys(globalThis.crypto),
  };
}

export {
  $testSampleForHash,
  hmacSHA256,
  hmacSHA256Sync,
  hmacSHA512,
  hmacSHA512Sync,
  sha256,
  sha256Sync,
  sha512,
  sha512Sync,
  sha512Pro,
  sha512ProSync,
  hash160,
  hash160Sync,
};
