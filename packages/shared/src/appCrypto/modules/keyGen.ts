import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';
import bufferUtils from '../../utils/bufferUtils';
import { ALLOW_USE_WEB_CRYPTO_SUBTLE } from '../consts';
import { runAppCryptoTestTask } from '../utils';

import { sha256, sha256Sync } from './hash';
import { pbkdf2, pbkdf2Sync } from './pbkdf2';

import type { IPbkdf2DispatchBackend } from './pbkdf2';
import type { IRunAppCryptoTestTaskResult } from '../utils';

function _keyFromPasswordAndSaltCheck({
  password,
  salt,
}: {
  password: string;
  salt: Buffer;
}) {
  if (!password || password.length <= 0) {
    throw new OneKeyLocalError('Zero-length password is not supported');
  }
  if (!salt || salt.length <= 0) {
    throw new OneKeyLocalError('Zero-length salt is not supported');
  }
}

async function keyFromPasswordAndSaltAsync({
  password,
  salt,
  iterations,
  debugCryptoProbeId,
  kdfBackend,
  enablePbkdf2Cache,
}: {
  password: string;
  salt: Buffer;
  iterations?: number;
  debugCryptoProbeId?: string;
  // Explicit backend override for callers that are known to run outside
  // IndexedDB transactions.
  kdfBackend?: IPbkdf2DispatchBackend;
  enablePbkdf2Cache?: boolean;
}): Promise<Buffer> {
  _keyFromPasswordAndSaltCheck({ password, salt });

  const hashedPassword: Buffer = await sha256(Buffer.from(password, 'utf8'));

  const saltBuffer = bufferUtils.toBuffer(salt);

  const r: Buffer = await pbkdf2({
    password: hashedPassword,
    salt: saltBuffer,
    iterations,
    debugCryptoProbeId,
    backend: kdfBackend,
    enableCache: enablePbkdf2Cache,
  });
  return r;
}

function keyFromPasswordAndSaltSync({
  password,
  salt,
  iterations,
  debugCryptoProbeId,
  enablePbkdf2Cache,
}: {
  password: string;
  salt: Buffer;
  iterations?: number;
  debugCryptoProbeId?: string;
  enablePbkdf2Cache?: boolean;
}): Buffer {
  _keyFromPasswordAndSaltCheck({ password, salt });

  const hashedPassword: Buffer = sha256Sync(Buffer.from(password, 'utf8'));

  const saltBuffer = bufferUtils.toBuffer(salt);

  const r: Buffer = pbkdf2Sync({
    password: hashedPassword,
    salt: saltBuffer,
    iterations,
    debugCryptoProbeId,
    enableCache: enablePbkdf2Cache,
  });
  return r;
}

async function keyFromPasswordAndSalt({
  password,
  salt,
  iterations,
  debugCryptoProbeId,
  kdfBackend,
  enablePbkdf2Cache,
}: {
  password: string;
  salt: Buffer;
  iterations?: number;
  debugCryptoProbeId?: string;
  // Explicit backend override for callers that are known to run outside
  // IndexedDB transactions.
  kdfBackend?: IPbkdf2DispatchBackend;
  enablePbkdf2Cache?: boolean;
}): Promise<Buffer> {
  _keyFromPasswordAndSaltCheck({ password, salt });

  const saltBuffer = bufferUtils.toBuffer(salt);

  if (platformEnv.isNative || ALLOW_USE_WEB_CRYPTO_SUBTLE || kdfBackend) {
    const r: Buffer = await keyFromPasswordAndSaltAsync({
      password,
      salt: saltBuffer,
      iterations,
      debugCryptoProbeId,
      kdfBackend,
      enablePbkdf2Cache,
    });
    return r;
  }
  const r: Buffer = keyFromPasswordAndSaltSync({
    password,
    salt: saltBuffer,
    iterations,
    debugCryptoProbeId,
    enablePbkdf2Cache,
  });
  return r;
}

async function $testSampleForKeyGen() {
  const password = 'hello-world';
  const salt = Buffer.from('salt', 'utf8');

  const tasks: IRunAppCryptoTestTaskResult[] = [];

  let expect = '';

  // Test keyGen implementations
  expect = '64b7de6c306b36eb35ae253bb1b806a0b23a7cd4ab73cfd3bc48f61d5b89332e';
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'keyFromPasswordAndSaltAsync',
      fn: () => keyFromPasswordAndSaltAsync({ password, salt }),
    }),
  );

  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'keyFromPasswordAndSaltSync',
      fn: () => keyFromPasswordAndSaltSync({ password, salt }),
    }),
  );

  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'keyFromPasswordAndSalt',
      fn: () => keyFromPasswordAndSalt({ password, salt }),
    }),
  );

  tasks.push(
    await runAppCryptoTestTask({
      expect:
        '7268777377cccd2966edda9e505b90b8ddc7e8615783b6aa581da67b87d2c3bf',
      name: 'keyFromPasswordAndSalt(custom params)',
      fn: () =>
        keyFromPasswordAndSalt({
          password:
            'ENCODE_KEY::755174C1-6480-401A-8C3D-84ADB2E0C376::eef82603-0027-40ae-96c1-6a4cd31bcfc1',
          salt: bufferUtils.toBuffer(
            '1e4bf57a9204ac213c9f4c554d93c2f9e014d6af56e3b27699e9a1aaa113a9ec',
          ),
        }),
    }),
  );

  console.log('testSampleForKeyGen results', tasks);
  return {
    tasks,
  };
}

const $legacyFunctions = {
  keyFromPasswordAndSaltAsync,
  keyFromPasswordAndSaltSync,
};

export {
  $testSampleForKeyGen,
  $legacyFunctions,
  //
  keyFromPasswordAndSalt,
};
