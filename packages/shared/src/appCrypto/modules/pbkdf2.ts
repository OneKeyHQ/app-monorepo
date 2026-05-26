import { pbkdf2 as pbkdf2ByNode, pbkdf2Sync as pbkdf2ByNodeSync } from 'crypto';

import {
  pbkdf2 as pbkdf2ByNobleFn,
  pbkdf2Async as pbkdf2ByNobleFnAsync,
} from '@noble/hashes/pbkdf2';
import { sha256 as sha256ByNoble } from '@noble/hashes/sha256';
import { Pbkdf2HmacSha256 as AsmcryptoPbkdf2HmacSha256 } from 'asmcrypto.js';

import RN_AES from '@onekeyhq/shared/src/modules3rdParty/react-native-aes-crypto';
import RN_FAST_PBKDF2 from '@onekeyhq/shared/src/modules3rdParty/react-native-fast-pbkdf2';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { OneKeyLocalError } from '../../errors';
import {
  ALLOW_USE_WEB_CRYPTO_SUBTLE,
  PBKDF2_CURRENT_NUM_OF_ITERATIONS,
  PBKDF2_KEY_LENGTH,
} from '../consts';
import { runAppCryptoTestTask } from '../utils';

import type { IRunAppCryptoTestTaskResult } from '../utils';

type IPbkdf2Params = {
  password: Buffer;
  salt: Buffer;
  iterations?: number;
  keyLength?: number;
  debugCryptoProbeId?: string;
  enableCache?: boolean;
};

type IPbkdf2Backend =
  | 'asmcrypto'
  | 'node-crypto'
  | 'noble'
  | 'react-native-aes-crypto'
  | 'react-native-fast-pbkdf2'
  | 'react-native-crypto'
  | 'webcrypto';

type IPbkdf2NativeBackend =
  | 'react-native-aes-crypto'
  | 'react-native-fast-pbkdf2';

// Explicit override for callers that already know they are outside IndexedDB
// transactions. Leave undefined to use the transaction-safe platform default.
type IPbkdf2DispatchBackend =
  | 'noble'
  | 'native'
  | 'webcrypto'
  | IPbkdf2NativeBackend;
type IPbkdf2DispatchParams = IPbkdf2Params & {
  backend?: IPbkdf2DispatchBackend;
};

type IPbkdf2Invocation = {
  backend: IPbkdf2Backend;
  debugCryptoProbeId?: string;
  iterations: number;
  keyLength: number;
};

let lastPbkdf2Invocation: IPbkdf2Invocation | undefined;
const pbkdf2InvocationsByProbeId = new Map<string, IPbkdf2Invocation>();
let pbkdf2NativeBackend: IPbkdf2NativeBackend = 'react-native-aes-crypto';

const PBKDF2_CACHE_TTL_MS = 60 * 1000;
const PBKDF2_CACHE_MAX_ENTRIES = 128;

type IPbkdf2CacheEntry = {
  expiresAt: number;
  value?: Buffer;
  promise?: Promise<Buffer>;
  timeout?: ReturnType<typeof setTimeout>;
};

const pbkdf2Cache = new Map<string, IPbkdf2CacheEntry>();

function recordPbkdf2Invocation(invocation: IPbkdf2Invocation) {
  if (!invocation.debugCryptoProbeId) {
    return;
  }
  lastPbkdf2Invocation = invocation;
  pbkdf2InvocationsByProbeId.set(invocation.debugCryptoProbeId, invocation);
}

function clearLastPbkdf2Invocation() {
  lastPbkdf2Invocation = undefined;
}

function getLastPbkdf2Invocation() {
  return lastPbkdf2Invocation;
}

function clearPbkdf2InvocationByProbeId(debugCryptoProbeId: string) {
  pbkdf2InvocationsByProbeId.delete(debugCryptoProbeId);
}

function getPbkdf2InvocationByProbeId(debugCryptoProbeId: string) {
  return pbkdf2InvocationsByProbeId.get(debugCryptoProbeId);
}

function clearPbkdf2Cache() {
  for (const entry of pbkdf2Cache.values()) {
    if (entry.timeout) {
      clearTimeout(entry.timeout);
    }
  }
  pbkdf2Cache.clear();
}

function deletePbkdf2CacheEntry(cacheKey: string) {
  const entry = pbkdf2Cache.get(cacheKey);
  if (entry?.timeout) {
    clearTimeout(entry.timeout);
  }
  pbkdf2Cache.delete(cacheKey);
}

function schedulePbkdf2CacheEntryRemoval(
  cacheKey: string,
  entry: IPbkdf2CacheEntry,
) {
  if (entry.timeout) {
    clearTimeout(entry.timeout);
  }
  entry.timeout = setTimeout(() => {
    if (pbkdf2Cache.get(cacheKey) === entry) {
      pbkdf2Cache.delete(cacheKey);
    }
  }, PBKDF2_CACHE_TTL_MS);
  (
    entry.timeout as ReturnType<typeof setTimeout> & { unref?: () => void }
  ).unref?.();
}

function getPbkdf2CacheBackend(params: IPbkdf2DispatchParams): IPbkdf2Backend {
  if (params.backend === 'noble') {
    return 'noble';
  }
  if (params.backend === 'webcrypto') {
    return 'webcrypto';
  }
  if (
    params.backend === 'react-native-aes-crypto' ||
    params.backend === 'react-native-fast-pbkdf2'
  ) {
    return params.backend;
  }
  if (params.backend === 'native') {
    if (platformEnv.isNative) {
      return pbkdf2NativeBackend;
    }
    if (ALLOW_USE_WEB_CRYPTO_SUBTLE) {
      return 'webcrypto';
    }
    return 'asmcrypto';
  }
  if (platformEnv.isNative) {
    return pbkdf2NativeBackend;
  }
  if (ALLOW_USE_WEB_CRYPTO_SUBTLE) {
    return 'webcrypto';
  }
  return 'asmcrypto';
}

function buildPbkdf2CacheKey(
  params: IPbkdf2DispatchParams,
  backend: IPbkdf2Backend,
): string {
  const iterations = params.iterations ?? PBKDF2_CURRENT_NUM_OF_ITERATIONS;
  const keyLength = params.keyLength ?? PBKDF2_KEY_LENGTH;
  // Hash the cache identity inputs so raw password and salt bytes are not
  // retained as Map keys.
  const passwordHash = bufferUtils.bytesToHex(sha256ByNoble(params.password));
  const saltHash = bufferUtils.bytesToHex(sha256ByNoble(params.salt));
  return [
    'pbkdf2-sha256',
    backend,
    iterations,
    keyLength,
    passwordHash,
    saltHash,
  ].join(':');
}

function prunePbkdf2Cache(now = Date.now()) {
  for (const [key, entry] of pbkdf2Cache) {
    if (!entry.promise && entry.expiresAt <= now) {
      deletePbkdf2CacheEntry(key);
    }
  }
  while (pbkdf2Cache.size > PBKDF2_CACHE_MAX_ENTRIES) {
    const firstKey = pbkdf2Cache.keys().next().value;
    if (!firstKey) {
      break;
    }
    deletePbkdf2CacheEntry(firstKey);
  }
}

function getPbkdf2CachedValue(cacheKey: string): Buffer | undefined {
  const entry = pbkdf2Cache.get(cacheKey);
  if (!entry || entry.promise) {
    return undefined;
  }
  if (entry.expiresAt <= Date.now()) {
    deletePbkdf2CacheEntry(cacheKey);
    return undefined;
  }
  if (!entry.value) {
    return undefined;
  }
  return Buffer.from(entry.value);
}

async function runPbkdf2WithCache(
  params: IPbkdf2DispatchParams,
  fn: () => Promise<Buffer>,
): Promise<Buffer> {
  if (!params.enableCache) {
    return fn();
  }
  const cacheKey = buildPbkdf2CacheKey(params, getPbkdf2CacheBackend(params));
  const cachedValue = getPbkdf2CachedValue(cacheKey);
  if (cachedValue) {
    return cachedValue;
  }

  const existingEntry = pbkdf2Cache.get(cacheKey);
  if (existingEntry?.promise) {
    const value = await existingEntry.promise;
    return Buffer.from(value);
  }

  const entry: IPbkdf2CacheEntry = {
    expiresAt: Number.POSITIVE_INFINITY,
  };
  pbkdf2Cache.set(cacheKey, entry);
  prunePbkdf2Cache();
  const promise = Promise.resolve()
    .then(fn)
    .then((value) => {
      const cached = Buffer.from(value);
      entry.value = cached;
      entry.promise = undefined;
      entry.expiresAt = Date.now() + PBKDF2_CACHE_TTL_MS;
      schedulePbkdf2CacheEntryRemoval(cacheKey, entry);
      prunePbkdf2Cache();
      return cached;
    })
    .catch((error) => {
      if (pbkdf2Cache.get(cacheKey) === entry) {
        deletePbkdf2CacheEntry(cacheKey);
      }
      throw error;
    });
  entry.promise = promise;
  const value = await promise;
  return Buffer.from(value);
}

function runPbkdf2SyncWithCache(
  params: IPbkdf2DispatchParams,
  fn: () => Buffer,
): Buffer {
  if (!params.enableCache) {
    return fn();
  }
  const cacheKey = buildPbkdf2CacheKey(params, 'asmcrypto');
  const cachedValue = getPbkdf2CachedValue(cacheKey);
  if (cachedValue) {
    return cachedValue;
  }
  const value = fn();
  const entry: IPbkdf2CacheEntry = {
    expiresAt: Date.now() + PBKDF2_CACHE_TTL_MS,
    value: Buffer.from(value),
  };
  schedulePbkdf2CacheEntryRemoval(cacheKey, entry);
  pbkdf2Cache.set(cacheKey, entry);
  prunePbkdf2Cache();
  return Buffer.from(value);
}

async function pbkdf2ByRNAes({
  password,
  salt,
  iterations = PBKDF2_CURRENT_NUM_OF_ITERATIONS,
  keyLength = PBKDF2_KEY_LENGTH,
  debugCryptoProbeId,
}: IPbkdf2Params): Promise<Buffer> {
  const hexPassword = bufferUtils.bytesToHex(password);
  const hexSalt = bufferUtils.bytesToHex(salt);

  const key: string = await RN_AES.pbkdf2(
    hexPassword,
    hexSalt,
    iterations,
    keyLength * 8, // 32
    'sha256', // sha512 sha256
  );
  //   return bufferUtils.bytesToHex(key);
  recordPbkdf2Invocation({
    backend: 'react-native-aes-crypto',
    debugCryptoProbeId,
    iterations,
    keyLength,
  });
  return bufferUtils.toBuffer(key, 'hex');
}

async function pbkdf2ByRNFastPbkdf2({
  password,
  salt,
  iterations = PBKDF2_CURRENT_NUM_OF_ITERATIONS,
  keyLength = PBKDF2_KEY_LENGTH,
  debugCryptoProbeId,
}: IPbkdf2Params): Promise<Buffer> {
  const key = await RN_FAST_PBKDF2.derive(
    bufferUtils.bytesToBase64(password),
    bufferUtils.bytesToBase64(salt),
    iterations,
    keyLength,
    'sha-256',
  );
  recordPbkdf2Invocation({
    backend: 'react-native-fast-pbkdf2',
    debugCryptoProbeId,
    iterations,
    keyLength,
  });
  return bufferUtils.base64ToBytes(key);
}

async function pbkdf2ByNoble({
  password,
  salt,
  iterations = PBKDF2_CURRENT_NUM_OF_ITERATIONS,
  keyLength = PBKDF2_KEY_LENGTH,
  debugCryptoProbeId,
}: IPbkdf2Params): Promise<Buffer> {
  const key = await pbkdf2ByNobleFnAsync(sha256ByNoble, password, salt, {
    c: iterations,
    dkLen: keyLength,
  });

  recordPbkdf2Invocation({
    backend: 'noble',
    debugCryptoProbeId,
    iterations,
    keyLength,
  });
  return bufferUtils.toBuffer(key, 'hex');
}

function pbkdf2ByNobleSync({
  password,
  salt,
  iterations = PBKDF2_CURRENT_NUM_OF_ITERATIONS,
  keyLength = PBKDF2_KEY_LENGTH,
  debugCryptoProbeId,
}: IPbkdf2Params): Buffer {
  const key = pbkdf2ByNobleFn(sha256ByNoble, password, salt, {
    c: iterations,
    dkLen: keyLength,
  });
  recordPbkdf2Invocation({
    backend: 'noble',
    debugCryptoProbeId,
    iterations,
    keyLength,
  });
  return bufferUtils.toBuffer(key, 'hex');
}

async function pbkdf2ByNodeCrypto({
  password,
  salt,
  iterations = PBKDF2_CURRENT_NUM_OF_ITERATIONS,
  keyLength = PBKDF2_KEY_LENGTH,
  debugCryptoProbeId,
}: IPbkdf2Params): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    pbkdf2ByNode(
      password,
      salt,
      iterations,
      keyLength,
      'sha256',
      (err, derivedKey) => {
        if (err) {
          reject(err);
        } else {
          recordPbkdf2Invocation({
            backend: 'node-crypto',
            debugCryptoProbeId,
            iterations,
            keyLength,
          });
          resolve(bufferUtils.toBuffer(derivedKey, 'hex'));
        }
      },
    );
  });
}

function pbkdf2ByNodeCryptoSync({
  password,
  salt,
  iterations = PBKDF2_CURRENT_NUM_OF_ITERATIONS,
  keyLength = PBKDF2_KEY_LENGTH,
  debugCryptoProbeId,
}: IPbkdf2Params): Buffer {
  const key = pbkdf2ByNodeSync(password, salt, iterations, keyLength, 'sha256');
  recordPbkdf2Invocation({
    backend: 'node-crypto',
    debugCryptoProbeId,
    iterations,
    keyLength,
  });
  return bufferUtils.toBuffer(key);
}

function isWebCryptoPbkdf2Supported(): boolean {
  const subtle = globalThis.crypto?.subtle as Partial<SubtleCrypto> | undefined;
  return Boolean(
    subtle &&
    typeof subtle.importKey === 'function' &&
    typeof subtle.deriveBits === 'function',
  );
}

async function pbkdf2ByWebCrypto({
  password,
  salt,
  iterations = PBKDF2_CURRENT_NUM_OF_ITERATIONS,
  keyLength = PBKDF2_KEY_LENGTH,
  debugCryptoProbeId,
}: IPbkdf2Params): Promise<Buffer> {
  if (!isWebCryptoPbkdf2Supported()) {
    throw new OneKeyLocalError('WebCrypto PBKDF2 is not supported');
  }
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    password as unknown as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );
  const derivedBits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    key,
    keyLength * 8,
  );
  recordPbkdf2Invocation({
    backend: 'webcrypto',
    debugCryptoProbeId,
    iterations,
    keyLength,
  });
  return bufferUtils.toBuffer(derivedBits, 'hex');
}

function pbkdf2ByAsmcryptoSync({
  password,
  salt,
  iterations = PBKDF2_CURRENT_NUM_OF_ITERATIONS,
  keyLength = PBKDF2_KEY_LENGTH,
  debugCryptoProbeId,
}: IPbkdf2Params): Buffer {
  const key: Uint8Array = AsmcryptoPbkdf2HmacSha256(
    password,
    salt,
    iterations,
    keyLength,
  );
  recordPbkdf2Invocation({
    backend: 'asmcrypto',
    debugCryptoProbeId,
    iterations,
    keyLength,
  });
  return bufferUtils.toBuffer(key, 'hex');
}

async function pbkdf2ByRNCrypto({
  password,
  salt,
  iterations = PBKDF2_CURRENT_NUM_OF_ITERATIONS,
  keyLength = PBKDF2_KEY_LENGTH,
  debugCryptoProbeId,
}: IPbkdf2Params): Promise<Buffer> {
  // polyfilled by react-native-crypto
  const fn = (
    globalThis.crypto as unknown as {
      pbkdf2?: typeof pbkdf2ByNode;
    }
  ).pbkdf2;
  if (!fn) {
    throw new OneKeyLocalError('globalThis.crypto.pbkdf2 is not supported');
  }
  return new Promise<Buffer>((resolve, reject) => {
    fn(
      password.toString('utf8'),
      salt.toString('utf8'),
      iterations,
      keyLength,
      'sha256',
      (err, derivedKey) => {
        if (err) {
          reject(err);
        } else {
          recordPbkdf2Invocation({
            backend: 'react-native-crypto',
            debugCryptoProbeId,
            iterations,
            keyLength,
          });
          resolve(bufferUtils.toBuffer(derivedKey, 'hex'));
        }
      },
    );
  });
}

function pbkdf2ByRNCryptoSync({
  password,
  salt,
  iterations = PBKDF2_CURRENT_NUM_OF_ITERATIONS,
  keyLength = PBKDF2_KEY_LENGTH,
  debugCryptoProbeId,
}: IPbkdf2Params): Buffer {
  // polyfilled by react-native-crypto
  const fn = (
    globalThis.crypto as unknown as {
      pbkdf2Sync?: typeof pbkdf2ByNodeSync;
    }
  ).pbkdf2Sync;
  if (!fn) {
    throw new OneKeyLocalError('globalThis.crypto.pbkdf2Sync is not supported');
  }
  const key = fn(
    password.toString('utf8'),
    salt.toString('utf8'),
    iterations,
    keyLength,
    'sha256',
  );
  recordPbkdf2Invocation({
    backend: 'react-native-crypto',
    debugCryptoProbeId,
    iterations,
    keyLength,
  });
  return bufferUtils.toBuffer(key);
}

function _pbkdf2AsyncCheck(params: IPbkdf2Params) {
  const { password, salt } = params;
  if (!password || password.length <= 0) {
    throw new OneKeyLocalError('Zero-length password is not supported');
  }
  if (!salt || salt.length <= 0) {
    throw new OneKeyLocalError('Zero-length salt is not supported');
  }
}

function pbkdf2Sync(params: IPbkdf2Params): Buffer {
  _pbkdf2AsyncCheck(params);
  return runPbkdf2SyncWithCache(params, () => pbkdf2ByAsmcryptoSync(params));
}

function setPbkdf2NativeBackend(backend: IPbkdf2NativeBackend | undefined) {
  pbkdf2NativeBackend = backend || 'react-native-aes-crypto';
}

function getPbkdf2NativeBackend(): IPbkdf2NativeBackend {
  return pbkdf2NativeBackend;
}

async function pbkdf2BySelectedNativeBackend(
  params: IPbkdf2Params,
): Promise<Buffer> {
  if (pbkdf2NativeBackend === 'react-native-fast-pbkdf2') {
    return pbkdf2ByRNFastPbkdf2(params);
  }
  return pbkdf2ByRNAes(params);
}

async function pbkdf2ByConcreteNativeBackend(
  backend: IPbkdf2NativeBackend,
  params: IPbkdf2Params,
): Promise<Buffer> {
  if (!platformEnv.isNative) {
    throw new OneKeyLocalError(`${backend} is only supported on native`);
  }
  if (backend === 'react-native-fast-pbkdf2') {
    return pbkdf2ByRNFastPbkdf2(params);
  }
  return pbkdf2ByRNAes(params);
}

async function pbkdf2(params: IPbkdf2DispatchParams): Promise<Buffer> {
  _pbkdf2AsyncCheck(params);
  return runPbkdf2WithCache(params, async () => {
    if (params.backend === 'noble') {
      return pbkdf2ByNoble(params);
    }
    if (params.backend === 'webcrypto') {
      return pbkdf2ByWebCrypto(params);
    }
    if (
      params.backend === 'react-native-aes-crypto' ||
      params.backend === 'react-native-fast-pbkdf2'
    ) {
      return pbkdf2ByConcreteNativeBackend(params.backend, params);
    }
    if (params.backend === 'native') {
      if (platformEnv.isNative) {
        return pbkdf2BySelectedNativeBackend(params);
      }
      if (ALLOW_USE_WEB_CRYPTO_SUBTLE) {
        return pbkdf2ByWebCrypto(params);
      }
      return pbkdf2ByAsmcryptoSync(params);
    }
    if (platformEnv.isNative) {
      const r: Buffer = await pbkdf2BySelectedNativeBackend(params);
      return r;
    }
    if (ALLOW_USE_WEB_CRYPTO_SUBTLE) {
      const r: Buffer = await pbkdf2ByWebCrypto(params);
      return r;
    }
    const r: Buffer = pbkdf2ByAsmcryptoSync(params);
    return r;
  });
}

function getPbkdf2BackendForCurrentPlatform(): string {
  if (platformEnv.isNative) {
    return pbkdf2NativeBackend;
  }
  if (ALLOW_USE_WEB_CRYPTO_SUBTLE) {
    return 'webcrypto';
  }
  return 'asmcrypto';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function pbkdf2SyncV2(params: IPbkdf2Params): Buffer {
  _pbkdf2AsyncCheck(params);
  let result: Buffer | undefined;
  let error: Error | undefined;
  pbkdf2(params)
    .then((r) => {
      result = r;
    })
    .catch((e) => {
      error = e || new Error('call pbkdf2() failed');
    });
  // TODO while timeout
  // TODO while loop will block pbkdf2 execution, causing it to never resolve, while loop will also continue indefinitely, suggest using worker to execute pbkdf2, main thread while waiting
  // oxlint-disable-next-line no-unmodified-loop-condition -- result and error are set asynchronously by the promise callbacks above
  while (!result && !error) {
    // do nothing, just wait for the promise to resolve
    console.log('pbkdf2SyncV2: waiting for the promise to resolve');
  }
  if (error) {
    // oxlint-disable-next-line no-throw-literal
    throw error;
  }
  if (!result) {
    throw new OneKeyLocalError('pbkdf2Sync ERROR: result is empty');
  }
  return result;
}

async function $testSampleForPbkdf2() {
  const password = Buffer.from('hello-world', 'utf8');
  const salt = Buffer.from('salt', 'utf8');

  const tasks: IRunAppCryptoTestTaskResult[] = [];

  let expect = '';

  // Test PBKDF2 implementations
  expect = 'd2e6cd380040d8514473883d4da978206bfb774889f1dd8246b77f7f341e0a12';
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'pbkdf2ByRNAes',
      fn: () => pbkdf2ByRNAes({ password, salt }),
    }),
  );

  if (platformEnv.isNative) {
    tasks.push(
      await runAppCryptoTestTask({
        expect,
        name: 'pbkdf2ByRNFastPbkdf2',
        fn: () => pbkdf2ByRNFastPbkdf2({ password, salt }),
      }),
    );
  }

  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'pbkdf2ByWebCrypto',
      fn: () => pbkdf2ByWebCrypto({ password, salt }),
    }),
  );

  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'pbkdf2ByAsmcryptoSync',
      fn: () => pbkdf2ByAsmcryptoSync({ password, salt }),
    }),
  );

  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'pbkdf2ByNoble',
      fn: () => pbkdf2ByNoble({ password, salt }),
    }),
  );

  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'pbkdf2ByNobleSync',
      fn: () => pbkdf2ByNobleSync({ password, salt }),
    }),
  );

  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'pbkdf2ByNodeCrypto',
      fn: () => pbkdf2ByNodeCrypto({ password, salt }),
    }),
  );

  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'pbkdf2ByNodeCryptoSync',
      fn: () => pbkdf2ByNodeCryptoSync({ password, salt }),
    }),
  );

  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'pbkdf2ByRNCrypto',
      fn: () => pbkdf2ByRNCrypto({ password, salt }),
    }),
  );

  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'pbkdf2ByRNCryptoSync',
      fn: () => pbkdf2ByRNCryptoSync({ password, salt }),
    }),
  );

  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'pbkdf2Sync',
      fn: () => pbkdf2Sync({ password, salt }),
    }),
  );

  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'pbkdf2',
      fn: () => pbkdf2({ password, salt }),
    }),
  );

  console.log('testSampleForPbkdf2 results', tasks);
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

// ethersproject version ----------------------------------------------
// import { pbkdf2 as pbkdf2Ethers } from '@ethersproject/pbkdf2';
// const hashedPassword = await sha256(Buffer.from(password, 'utf8'));
// const key = pbkdf2Ethers(
//   hashedPassword,
//   salt,
//   PBKDF2_CURRENT_NUM_OF_ITERATIONS,
//   PBKDF2_KEY_LENGTH,
//   'sha256',
// );
// console.log('key', key);
// return bufferUtils.toBuffer(key, 'hex');

// expo-crypto version ----------------------------------------------
// import * as ExpoCrypto from 'expo-crypto';
// expo-crypto does not support pbkdf2 algorithm, only supports hash digest algorithms

export type {
  IPbkdf2DispatchBackend,
  IPbkdf2DispatchParams,
  IPbkdf2NativeBackend,
};

export {
  $testSampleForPbkdf2,
  clearLastPbkdf2Invocation,
  clearPbkdf2Cache,
  clearPbkdf2InvocationByProbeId,
  getLastPbkdf2Invocation,
  getPbkdf2InvocationByProbeId,
  getPbkdf2BackendForCurrentPlatform,
  getPbkdf2NativeBackend,
  isWebCryptoPbkdf2Supported,
  setPbkdf2NativeBackend,
  pbkdf2ByNoble,
  pbkdf2ByRNFastPbkdf2,
  pbkdf2ByRNAes,
  pbkdf2Sync,
  pbkdf2,
};
