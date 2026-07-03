import { cbc as aesCbcByNobleFn } from '@noble/ciphers/aes';

import { OneKeyLocalError } from '../../errors';
import bufferUtils from '../../utils/bufferUtils';
import { runAppCryptoTestTask } from '../utils';

import type { IRunAppCryptoTestTaskResult } from '../utils';

type IAesCbcInvokeParams = {
  iv: Buffer;
  key: Buffer;
  data: Buffer;
};

function checkAesCbcParams({ iv, key, data }: IAesCbcInvokeParams) {
  if (!iv || iv.length <= 0) {
    throw new OneKeyLocalError('Zero-length iv is not supported');
  }
  if (!key || key.length <= 0) {
    throw new OneKeyLocalError('Zero-length key is not supported');
  }
  if (!data || data.length <= 0) {
    throw new OneKeyLocalError('Zero-length data is not supported');
  }
}

function aesCbcEncryptSync({ iv, key, data }: IAesCbcInvokeParams): Buffer {
  checkAesCbcParams({ iv, key, data });
  const cipher = aesCbcByNobleFn(key, iv);
  return Buffer.from(cipher.encrypt(data));
}

async function aesCbcEncrypt(params: IAesCbcInvokeParams): Promise<Buffer> {
  return aesCbcEncryptSync(params);
}

function aesCbcDecryptSync({ iv, key, data }: IAesCbcInvokeParams): Buffer {
  checkAesCbcParams({ iv, key, data });
  const cipher = aesCbcByNobleFn(key, iv);
  return Buffer.from(cipher.decrypt(data));
}

async function aesCbcDecrypt(params: IAesCbcInvokeParams): Promise<Buffer> {
  return aesCbcDecryptSync(params);
}

async function $testSampleForAesCbc() {
  const data = Buffer.from('hello-world', 'utf8');
  const key = Buffer.from('12345678901234567890123456789012', 'utf8');
  const iv = Buffer.from('1234567890123456', 'utf8');
  const tasks: IRunAppCryptoTestTaskResult[] = [];

  tasks.push(
    await runAppCryptoTestTask({
      expect: '20bfddded56f6d156e6d1124714d753b',
      name: 'aesCbcEncrypt',
      fn: () => aesCbcEncrypt({ iv, key, data }),
    }),
  );

  const encryptedData = await aesCbcEncrypt({ iv, key, data });
  tasks.push(
    await runAppCryptoTestTask({
      expect: bufferUtils.bytesToHex(data),
      name: 'aesCbcDecrypt',
      fn: () => aesCbcDecrypt({ iv, key, data: encryptedData }),
    }),
  );

  return { tasks };
}

export {
  $testSampleForAesCbc,
  aesCbcEncryptSync,
  aesCbcEncrypt,
  aesCbcDecryptSync,
  aesCbcDecrypt,
};
