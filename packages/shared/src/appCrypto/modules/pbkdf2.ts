import { pbkdf2 as pbkdf2ByNode, pbkdf2Sync as pbkdf2ByNodeSync } from 'crypto';

import {
  pbkdf2 as pbkdf2ByNobleFn,
  pbkdf2Async as pbkdf2ByNobleFnAsync,
} from '@noble/hashes/pbkdf2';
import { sha256 as sha256ByNoble } from '@noble/hashes/sha256';
import { Pbkdf2HmacSha256 as AsmcryptoPbkdf2HmacSha256 } from 'asmcrypto.js';

import RN_AES from '@onekeyhq/shared/src/modules3rdParty/react-native-aes-crypto';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { OneKeyLocalError } from '../../errors';
import {
  ALLOW_USE_WEB_CRYPTO_SUBTLE,
  PBKDF2_KEY_LENGTH,
  PBKDF2_NUM_OF_ITERATIONS,
} from '../consts';
import { runAppCryptoTestTask } from '../utils';

import type { IRunAppCryptoTestTaskResult } from '../utils';

type IPbkdf2Params = {
  password: Buffer;
  salt: Buffer;
  iterations?: number;
  keyLength?: number;
  debugCryptoProbeId?: string;
};

type IPbkdf2Backend =
  | 'asmcrypto'
  | 'node-crypto'
  | 'noble'
  | 'react-native-aes-crypto'
  | 'react-native-crypto'
  | 'webcrypto';

type IPbkdf2Invocation = {
  backend: IPbkdf2Backend;
  debugCryptoProbeId?: string;
  iterations: number;
  keyLength: number;
};

let lastPbkdf2Invocation: IPbkdf2Invocation | undefined;
const pbkdf2InvocationsByProbeId = new Map<string, IPbkdf2Invocation>();

function recordPbkdf2Invocation(invocation: IPbkdf2Invocation) {
  lastPbkdf2Invocation = invocation;
  if (invocation.debugCryptoProbeId) {
    pbkdf2InvocationsByProbeId.set(invocation.debugCryptoProbeId, invocation);
  }
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

async function pbkdf2ByRNAes({
  password,
  salt,
  iterations = PBKDF2_NUM_OF_ITERATIONS,
  keyLength = PBKDF2_KEY_LENGTH,
  debugCryptoProbeId,
}: IPbkdf2Params): Promise<Buffer> {
  const hexPassword = bufferUtils.bytesToHex(password);
  const hexSalt = bufferUtils.bytesToHex(salt);

  const key: string = await RN_AES.pbkdf2(
    hexPassword,
    hexSalt,
    iterations, // 5000
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

async function pbkdf2ByNoble({
  password,
  salt,
  iterations = PBKDF2_NUM_OF_ITERATIONS,
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
  iterations = PBKDF2_NUM_OF_ITERATIONS,
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
  iterations = PBKDF2_NUM_OF_ITERATIONS,
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
  iterations = PBKDF2_NUM_OF_ITERATIONS,
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

async function pbkdf2ByWebCrypto({
  password,
  salt,
  iterations = PBKDF2_NUM_OF_ITERATIONS,
  keyLength = PBKDF2_KEY_LENGTH,
  debugCryptoProbeId,
}: IPbkdf2Params): Promise<Buffer> {
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
  iterations = PBKDF2_NUM_OF_ITERATIONS,
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
  iterations = PBKDF2_NUM_OF_ITERATIONS,
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
  iterations = PBKDF2_NUM_OF_ITERATIONS,
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
  const r: Buffer = pbkdf2ByAsmcryptoSync(params);
  return r;
}

async function pbkdf2(params: IPbkdf2Params): Promise<Buffer> {
  _pbkdf2AsyncCheck(params);
  if (platformEnv.isNative) {
    const r: Buffer = await pbkdf2ByRNAes(params);
    return r;
  }
  if (ALLOW_USE_WEB_CRYPTO_SUBTLE) {
    const r: Buffer = await pbkdf2ByWebCrypto(params);
    return r;
  }
  const r: Buffer = pbkdf2ByAsmcryptoSync(params);
  return r;
}

function getPbkdf2BackendForCurrentPlatform(): string {
  if (platformEnv.isNative) {
    return 'react-native-aes-crypto';
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
  expect = '19de37b37bf2ba925f91745048921392cd51cdfde43763e7e915124b5c23ce7e';
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'pbkdf2ByRNAes',
      fn: () => pbkdf2ByRNAes({ password, salt }),
    }),
  );

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
//   PBKDF2_NUM_OF_ITERATIONS,
//   PBKDF2_KEY_LENGTH,
//   'sha256',
// );
// console.log('key', key);
// return bufferUtils.toBuffer(key, 'hex');

// expo-crypto version ----------------------------------------------
// import * as ExpoCrypto from 'expo-crypto';
// expo-crypto does not support pbkdf2 algorithm, only supports hash digest algorithms

export {
  $testSampleForPbkdf2,
  clearLastPbkdf2Invocation,
  clearPbkdf2InvocationByProbeId,
  getLastPbkdf2Invocation,
  getPbkdf2InvocationByProbeId,
  getPbkdf2BackendForCurrentPlatform,
  pbkdf2ByNoble,
  pbkdf2ByRNAes,
  pbkdf2Sync,
  pbkdf2,
};
