import {
  pbkdf2 as pbkdf2ByNobleFn,
  pbkdf2Async as pbkdf2ByNobleFnAsync,
} from '@noble/hashes/pbkdf2';
import { sha256 as sha256ByNoble } from '@noble/hashes/sha256';

import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';
import bufferUtils from '../../utils/bufferUtils';
import { PBKDF2_CURRENT_NUM_OF_ITERATIONS, PBKDF2_KEY_LENGTH } from '../consts';
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

type IPbkdf2Backend = 'noble' | 'react-native-aes-crypto' | 'webcrypto';

type IPbkdf2NativeBackend =
  | 'react-native-aes-crypto'
  | 'react-native-fast-pbkdf2'
  | 'react-native-quick-crypto';

type IPbkdf2DispatchBackend =
  | 'noble'
  | 'native'
  | 'webcrypto'
  | IPbkdf2NativeBackend;
type IPbkdf2DispatchParams = IPbkdf2Params & {
  backend?: IPbkdf2DispatchBackend;
};
type IPbkdf2KdfParams = {
  kdfBackend?: IPbkdf2DispatchBackend;
  enablePbkdf2Cache?: boolean;
};

type IPbkdf2Invocation = {
  backend: IPbkdf2Backend;
  debugCryptoProbeId?: string;
  iterations: number;
  keyLength: number;
};

let lastPbkdf2Invocation: IPbkdf2Invocation | undefined;
const pbkdf2InvocationsByProbeId = new Map<string, IPbkdf2Invocation>();
let pbkdf2NativeBackend: IPbkdf2NativeBackend = 'react-native-quick-crypto';

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

function deletePbkdf2CacheEntry(cacheKey: string) {
  const entry = pbkdf2Cache.get(cacheKey);
  if (entry?.timeout) {
    clearTimeout(entry.timeout);
  }
  if (entry?.value) {
    entry.value.fill(0);
    entry.value = undefined;
  }
  if (entry) {
    entry.promise = undefined;
  }
  pbkdf2Cache.delete(cacheKey);
}

function clearPbkdf2Cache() {
  for (const cacheKey of Array.from(pbkdf2Cache.keys())) {
    deletePbkdf2CacheEntry(cacheKey);
  }
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
      deletePbkdf2CacheEntry(cacheKey);
    }
  }, PBKDF2_CACHE_TTL_MS);
  (
    entry.timeout as ReturnType<typeof setTimeout> & { unref?: () => void }
  ).unref?.();
}

function touchPbkdf2CacheEntry(cacheKey: string, entry: IPbkdf2CacheEntry) {
  entry.expiresAt = Date.now() + PBKDF2_CACHE_TTL_MS;
  schedulePbkdf2CacheEntryRemoval(cacheKey, entry);
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

function getPbkdf2CacheBackend(params: IPbkdf2DispatchParams): IPbkdf2Backend {
  if (shouldUseWebCryptoPbkdf2(params)) {
    return 'webcrypto';
  }
  return 'noble';
}

function buildPbkdf2CacheKey(
  params: IPbkdf2DispatchParams,
  backend: IPbkdf2Backend,
): string {
  const iterations = params.iterations ?? PBKDF2_CURRENT_NUM_OF_ITERATIONS;
  const keyLength = params.keyLength ?? PBKDF2_KEY_LENGTH;
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
  touchPbkdf2CacheEntry(cacheKey, entry);
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
    const currentEntry = pbkdf2Cache.get(cacheKey);
    if (currentEntry === existingEntry && !currentEntry.promise) {
      touchPbkdf2CacheEntry(cacheKey, currentEntry);
    }
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
      const result = Buffer.from(value);
      if (pbkdf2Cache.get(cacheKey) !== entry) {
        return result;
      }
      entry.value = Buffer.from(result);
      entry.promise = undefined;
      touchPbkdf2CacheEntry(cacheKey, entry);
      prunePbkdf2Cache();
      return result;
    })
    .catch((error) => {
      if (pbkdf2Cache.get(cacheKey) === entry) {
        deletePbkdf2CacheEntry(cacheKey);
      }
      throw error;
    });
  entry.promise = promise;
  return Buffer.from(await promise);
}

function runPbkdf2SyncWithCache(
  params: IPbkdf2DispatchParams,
  fn: () => Buffer,
): Buffer {
  if (!params.enableCache) {
    return fn();
  }
  const cacheKey = buildPbkdf2CacheKey(params, 'noble');
  const cachedValue = getPbkdf2CachedValue(cacheKey);
  if (cachedValue) {
    return cachedValue;
  }
  const value = fn();
  const entry: IPbkdf2CacheEntry = {
    expiresAt: Number.POSITIVE_INFINITY,
    value: Buffer.from(value),
  };
  touchPbkdf2CacheEntry(cacheKey, entry);
  pbkdf2Cache.set(cacheKey, entry);
  prunePbkdf2Cache();
  return Buffer.from(value);
}

function checkPbkdf2Params({ password, salt }: IPbkdf2Params) {
  if (!password || password.length <= 0) {
    throw new OneKeyLocalError('Zero-length password is not supported');
  }
  if (!salt || salt.length <= 0) {
    throw new OneKeyLocalError('Zero-length salt is not supported');
  }
}

async function pbkdf2ByNoble({
  password,
  salt,
  iterations = PBKDF2_CURRENT_NUM_OF_ITERATIONS,
  keyLength = PBKDF2_KEY_LENGTH,
  debugCryptoProbeId,
}: IPbkdf2Params): Promise<Buffer> {
  checkPbkdf2Params({ password, salt });
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
  return Buffer.from(key);
}

function pbkdf2ByNobleSync({
  password,
  salt,
  iterations = PBKDF2_CURRENT_NUM_OF_ITERATIONS,
  keyLength = PBKDF2_KEY_LENGTH,
  debugCryptoProbeId,
}: IPbkdf2Params): Buffer {
  checkPbkdf2Params({ password, salt });
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
  return Buffer.from(key);
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
  checkPbkdf2Params({ password, salt });
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
  return Buffer.from(derivedBits);
}

function shouldUseWebCryptoPbkdf2(params: IPbkdf2DispatchParams): boolean {
  return (
    (params.backend === 'webcrypto' ||
      params.backend === 'native' ||
      (platformEnv.isJest && !params.backend)) &&
    isWebCryptoPbkdf2Supported()
  );
}

function getPbkdf2KdfParamsForNonDbTx(): IPbkdf2KdfParams {
  if (isWebCryptoPbkdf2Supported()) {
    return {
      kdfBackend: 'webcrypto',
      enablePbkdf2Cache: true,
    };
  }
  return {
    enablePbkdf2Cache: true,
  };
}

async function pbkdf2(params: IPbkdf2DispatchParams): Promise<Buffer> {
  return runPbkdf2WithCache(params, () => {
    if (shouldUseWebCryptoPbkdf2(params)) {
      return pbkdf2ByWebCrypto(params);
    }
    return pbkdf2ByNoble(params);
  });
}

function pbkdf2Sync(params: IPbkdf2DispatchParams): Buffer {
  return runPbkdf2SyncWithCache(params, () => pbkdf2ByNobleSync(params));
}

async function pbkdf2ByRNAes(params: IPbkdf2Params): Promise<Buffer> {
  return pbkdf2ByNoble(params);
}

async function pbkdf2ByRNFastPbkdf2(params: IPbkdf2Params): Promise<Buffer> {
  return pbkdf2ByNoble(params);
}

async function pbkdf2ByRNQuickCrypto(params: IPbkdf2Params): Promise<Buffer> {
  return pbkdf2ByNoble(params);
}

function pbkdf2ByRNQuickCryptoSync(params: IPbkdf2Params): Buffer {
  return pbkdf2ByNobleSync(params);
}

function getPbkdf2BackendForCurrentPlatform(): IPbkdf2Backend {
  if (isWebCryptoPbkdf2Supported()) {
    return 'webcrypto';
  }
  return 'noble';
}

function getPbkdf2NativeBackend(): IPbkdf2NativeBackend {
  return pbkdf2NativeBackend;
}

function setPbkdf2NativeBackend(backend: IPbkdf2NativeBackend) {
  pbkdf2NativeBackend = backend;
}

async function $testSampleForPbkdf2() {
  const password = Buffer.from('hello-world', 'utf8');
  const salt = Buffer.from('salt', 'utf8');
  const tasks: IRunAppCryptoTestTaskResult[] = [];
  const expect =
    '64b7de6c306b36eb35ae253bb1b806a0b23a7cd4ab73cfd3bc48f61d5b89332e';

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

  return { tasks };
}

export type {
  IPbkdf2DispatchBackend,
  IPbkdf2DispatchParams,
  IPbkdf2KdfParams,
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
  getPbkdf2KdfParamsForNonDbTx,
  getPbkdf2NativeBackend,
  isWebCryptoPbkdf2Supported,
  setPbkdf2NativeBackend,
  pbkdf2ByNoble,
  pbkdf2ByRNFastPbkdf2,
  pbkdf2ByRNAes,
  pbkdf2ByRNQuickCrypto,
  pbkdf2ByRNQuickCryptoSync,
  pbkdf2Sync,
  pbkdf2,
};
