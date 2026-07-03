import { hmac as hmacByNobleFn } from '@noble/hashes/hmac';
import { ripemd160 as ripemd160ByNobleFn } from '@noble/hashes/ripemd160';
import { sha256 as sha256ByNobleFn } from '@noble/hashes/sha256';
import { sha512 as sha512ByNobleFn } from '@noble/hashes/sha512';

import { OneKeyLocalError } from '../../errors';
import bufferUtils from '../../utils/bufferUtils';
import { runAppCryptoTestTask } from '../utils';

import type { ISha512Params } from '../types';
import type { IRunAppCryptoTestTaskResult } from '../utils';

function checkNonEmptyBuffer(data: Buffer, name: string) {
  if (!data || data.length <= 0) {
    throw new OneKeyLocalError(`Zero-length ${name} is not supported`);
  }
}

function checkHmacParams(key: Buffer, data: Buffer) {
  checkNonEmptyBuffer(key, 'key');
  checkNonEmptyBuffer(data, 'data');
}

function hmacSHA256Sync(key: Buffer, data: Buffer): Buffer {
  checkHmacParams(key, data);
  return Buffer.from(hmacByNobleFn(sha256ByNobleFn, key, data));
}

async function hmacSHA256(key: Buffer, data: Buffer): Promise<Buffer> {
  return hmacSHA256Sync(key, data);
}

function hmacSHA512Sync(key: Buffer, data: Buffer): Buffer {
  checkHmacParams(key, data);
  return Buffer.from(hmacByNobleFn(sha512ByNobleFn, key, data));
}

async function hmacSHA512(key: Buffer, data: Buffer): Promise<Buffer> {
  return hmacSHA512Sync(key, data);
}

function hmacSHA512ByRNQuickCrypto(key: Buffer, data: Buffer): Buffer {
  return hmacSHA512Sync(key, data);
}

function sha256Sync(data: Buffer): Buffer {
  checkNonEmptyBuffer(data, 'data');
  return Buffer.from(sha256ByNobleFn(data));
}

async function sha256(data: Buffer): Promise<Buffer> {
  return sha256Sync(data);
}

function sha512Sync(data: Buffer): Buffer {
  checkNonEmptyBuffer(data, 'data');
  return Buffer.from(sha512ByNobleFn(data));
}

async function sha512(data: Buffer): Promise<Buffer> {
  return sha512Sync(data);
}

function checkSha512ProParams({ data, iterations }: ISha512Params) {
  if (!data) {
    throw new OneKeyLocalError('data is required');
  }
  if (!iterations || iterations < 1) {
    throw new OneKeyLocalError('iterations must be greater than 0');
  }
}

function sha512ProSync({
  data,
  iterations = 1,
  iterationSalt,
}: ISha512Params): string {
  checkSha512ProParams({ data, iterations, iterationSalt });

  let hash: string = bufferUtils.bytesToHex(sha512ByNobleFn(data));
  for (let i = 1; i < iterations; i += 1) {
    const nextHash = iterationSalt
      ? [hash, iterationSalt, data, i, iterations].join('')
      : hash;
    hash = bufferUtils.bytesToHex(sha512ByNobleFn(nextHash));
  }
  return hash;
}

async function sha512Pro(params: ISha512Params): Promise<string> {
  return sha512ProSync(params);
}

function hash160Sync(data: Buffer): Buffer {
  checkNonEmptyBuffer(data, 'data');
  return Buffer.from(ripemd160ByNobleFn(sha256ByNobleFn(data)));
}

async function hash160(data: Buffer): Promise<Buffer> {
  return hash160Sync(data);
}

async function $testSampleForHash() {
  const data = Buffer.from('hello-world', 'utf8');
  const key = Buffer.from('test-key', 'utf8');
  const tasks: IRunAppCryptoTestTaskResult[] = [];

  tasks.push(
    await runAppCryptoTestTask({
      expect:
        '9aef1d4e0edd4db31086e7a99e9c603698aca1a57450753254fc7a3481361f74',
      name: 'hmacSHA256',
      fn: () => hmacSHA256(key, data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect:
        '14df1c9b76b91901d7336ab188e6c80a6fe3ed89d20b5c4ff13e33747913e8a47edc30d74adbb6f6918882a88ca80b9eb5af1ddbb4565906c330e314ec307ea4',
      name: 'hmacSHA512',
      fn: () => hmacSHA512(key, data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect:
        'afa27b44d43b02a9fea21b141c40cbc3b409e8e6349c4e6b7be189aa55e29788',
      name: 'sha256',
      fn: () => sha256(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect:
        '4ab1186cb52a4c08b615a52421f7ee98e0cf4381ea6cbd2dd2f99d5c06090bfd17f4223cc8dcfbfc22818bd0b5fc3f7c09b5471b15ed26525070a95e7482e2f3',
      name: 'sha512',
      fn: () => sha512(data),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect: 'e5401df4b482af6ff2c03fcd1f7f72b9b40bd53e',
      name: 'hash160',
      fn: () => hash160(data),
    }),
  );

  return { tasks };
}

export {
  $testSampleForHash,
  hmacSHA256,
  hmacSHA256Sync,
  hmacSHA512,
  hmacSHA512Sync,
  hmacSHA512ByRNQuickCrypto,
  sha256,
  sha256Sync,
  sha512,
  sha512Sync,
  sha512Pro,
  sha512ProSync,
  hash160,
  hash160Sync,
};
