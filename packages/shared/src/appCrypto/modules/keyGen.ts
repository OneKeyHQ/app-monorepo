import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';
import bufferUtils from '../../utils/bufferUtils';
import { ALLOW_USE_WEB_CRYPTO_SUBTLE } from '../consts';
import { runAppCryptoTestTask } from '../utils';

import { sha256, sha256Sync } from './hash';
import { pbkdf2, pbkdf2Sync } from './pbkdf2';

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
}: {
  password: string;
  salt: Buffer;
  iterations?: number;
}): Promise<Buffer> {
  _keyFromPasswordAndSaltCheck({ password, salt });

  const hashedPassword: Buffer = await sha256(Buffer.from(password, 'utf8'));

  const saltBuffer = bufferUtils.toBuffer(salt);

  const r: Buffer = await pbkdf2({
    password: hashedPassword,
    salt: saltBuffer,
    iterations,
  });
  return r;
}

function keyFromPasswordAndSaltSync({
  password,
  salt,
  iterations,
}: {
  password: string;
  salt: Buffer;
  iterations?: number;
}): Buffer {
  _keyFromPasswordAndSaltCheck({ password, salt });

  const hashedPassword: Buffer = sha256Sync(Buffer.from(password, 'utf8'));

  const saltBuffer = bufferUtils.toBuffer(salt);

  const r: Buffer = pbkdf2Sync({
    password: hashedPassword,
    salt: saltBuffer,
    iterations,
  });
  return r;
}

async function keyFromPasswordAndSalt({
  password,
  salt,
  iterations,
}: {
  password: string;
  salt: Buffer;
  iterations?: number;
}): Promise<Buffer> {
  _keyFromPasswordAndSaltCheck({ password, salt });

  const saltBuffer = bufferUtils.toBuffer(salt);

  if (platformEnv.isNative || ALLOW_USE_WEB_CRYPTO_SUBTLE) {
    const r: Buffer = await keyFromPasswordAndSaltAsync({
      password,
      salt: saltBuffer,
      iterations,
    });
    return r;
  }
  const r: Buffer = keyFromPasswordAndSaltSync({
    password,
    salt: saltBuffer,
    iterations,
  });
  return r;
}

async function $testSampleForKeyGen() {
  const password = 'hello-world';
  const salt = Buffer.from('salt', 'utf8');

  const tasks: IRunAppCryptoTestTaskResult[] = [];

  let expect = '';

  // Test keyGen implementations
  expect = '0ac80d08e992e970e64ae6c6eadff75ba65fa03fde08b46ed1f8f5437623dd18';
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
        '9fe6f6501b6be1be5af9ac56c729d84e67ffd8d0f4f5591c3323d3a73b926649',
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
