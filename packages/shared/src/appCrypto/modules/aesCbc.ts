/* eslint-disable @typescript-eslint/no-unused-vars */

// TODO node version
import { createCipheriv, createDecipheriv } from 'crypto';

import { cbc as aesCbcByNobleFn } from '@noble/ciphers/aes';
import { AES_CBC as AsmcryptoAesCbc } from 'asmcrypto.js';

import RN_AES from '@onekeyhq/shared/src/modules3rdParty/react-native-aes-crypto';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OneKeyLocalError } from '../../errors';
import bufferUtils from '../../utils/bufferUtils';
import { ALLOW_USE_WEB_CRYPTO_SUBTLE } from '../consts';
import { runAppCryptoTestTask } from '../utils';

import type { IRunAppCryptoTestTaskResult } from '../utils';

type IAesCbcInvokeParams = {
  iv: Buffer;
  key: Buffer;
  data: Buffer;
};
function _aesCbcInvokeCheck({ iv, key, data }: IAesCbcInvokeParams) {
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

// #region aesCbcEncrypt

async function aesCbcEncryptByRNAes({
  iv,
  key,
  data,
}: IAesCbcInvokeParams): Promise<Buffer> {
  _aesCbcInvokeCheck({ iv, key, data });
  /* 
    data:[clearText dataUsingEncoding:NSUTF8StringEncoding]
    NSData *keyData = [self fromHex:key];
    NSData *ivData = [self fromHex:iv];
    */
  const encrypted = await RN_AES.encrypt(
    bufferUtils.bytesToHex(data),
    bufferUtils.bytesToHex(key),
    bufferUtils.bytesToHex(iv),
    'aes-256-cbc',
  );
  // data.toString('hex'); // TODO  data.toString('hex') is not safe in native, use bufferUtils.bytesToHex() instead

  return Buffer.from(encrypted, 'hex');
}

async function aesCbcEncryptByWebCrypto({
  iv,
  key,
  data,
}: IAesCbcInvokeParams): Promise<Buffer> {
  _aesCbcInvokeCheck({ iv, key, data });

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC', length: 256 },
    false,
    ['encrypt'],
  );
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    data,
  );
  return Buffer.from(encrypted);
}

function aesCbcEncryptByAsmcrypto({
  iv,
  key,
  data,
}: IAesCbcInvokeParams): Buffer {
  _aesCbcInvokeCheck({ iv, key, data });

  const r = Buffer.from(AsmcryptoAesCbc.encrypt(data, key, true, iv));
  return r;
}

function aesCbcEncryptByNodeCrypto({
  iv,
  key,
  data,
}: IAesCbcInvokeParams): Buffer {
  _aesCbcInvokeCheck({ iv, key, data });

  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return encrypted;
}

function aesCbcEncryptByNoble({ iv, key, data }: IAesCbcInvokeParams): Buffer {
  _aesCbcInvokeCheck({ iv, key, data });

  const cipher = aesCbcByNobleFn(key, iv);
  const encrypted = cipher.encrypt(data);
  return Buffer.from(encrypted);
}

function aesCbcEncryptSync({ iv, key, data }: IAesCbcInvokeParams): Buffer {
  _aesCbcInvokeCheck({ iv, key, data });

  const r: Buffer = aesCbcEncryptByAsmcrypto({ iv, key, data });
  return r;
}

async function aesCbcEncrypt({
  iv,
  key,
  data,
}: IAesCbcInvokeParams): Promise<Buffer> {
  _aesCbcInvokeCheck({ iv, key, data });

  if (platformEnv.isNative) {
    const r: Buffer = await aesCbcEncryptByRNAes({ iv, key, data });
    return r;
  }

  if (ALLOW_USE_WEB_CRYPTO_SUBTLE) {
    const r: Buffer = await aesCbcEncryptByWebCrypto({ iv, key, data });
    return r;
  }

  const r: Buffer = aesCbcEncryptByAsmcrypto({ iv, key, data });
  return r;
}

// #endregion aesCbcEncrypt

// #region aesCbcDecrypt

async function aesCbcDecryptByRNAes({
  iv,
  key,
  data,
}: IAesCbcInvokeParams): Promise<Buffer> {
  _aesCbcInvokeCheck({ iv, key, data });

  const decrypted = await RN_AES.decrypt(
    bufferUtils.bytesToHex(data),
    bufferUtils.bytesToHex(key),
    bufferUtils.bytesToHex(iv),
    'aes-256-cbc',
  );
  if (!decrypted || decrypted?.length <= 0) {
    throw new OneKeyLocalError(
      'aesCbcDecryptByRNAes ERROR: decrypted data is empty',
    );
  }

  const buffer = Buffer.from(decrypted, 'hex');

  // verify the key is correct by encrypting the buffer with the key and iv
  const r = await aesCbcEncryptByRNAes({ iv, key, data: buffer });
  if (bufferUtils.bytesToHex(r) !== bufferUtils.bytesToHex(data)) {
    throw new OneKeyLocalError('aesCbcDecryptByRNAes ERROR: wrong AES key');
  }

  return buffer;
}

async function aesCbcDecryptByWebCrypto({
  iv,
  key,
  data,
}: IAesCbcInvokeParams): Promise<Buffer> {
  _aesCbcInvokeCheck({ iv, key, data });

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC', length: 256 },
    false,
    ['decrypt'],
  );
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    data,
  );
  return Buffer.from(decrypted);
}

function aesCbcDecryptByAsmcrypto({
  iv,
  key,
  data,
}: IAesCbcInvokeParams): Buffer {
  _aesCbcInvokeCheck({ iv, key, data });

  const r: Buffer = Buffer.from(AsmcryptoAesCbc.decrypt(data, key, true, iv));
  return r;
}

function aesCbcDecryptByNodeCrypto({
  iv,
  key,
  data,
}: IAesCbcInvokeParams): Buffer {
  _aesCbcInvokeCheck({ iv, key, data });

  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted;
}

function aesCbcDecryptByNoble({ iv, key, data }: IAesCbcInvokeParams): Buffer {
  _aesCbcInvokeCheck({ iv, key, data });

  const cipher = aesCbcByNobleFn(key, iv);
  const decrypted = cipher.decrypt(data);
  return Buffer.from(decrypted);
}

function aesCbcDecryptSync({ iv, key, data }: IAesCbcInvokeParams): Buffer {
  _aesCbcInvokeCheck({ iv, key, data });

  const r: Buffer = aesCbcDecryptByAsmcrypto({ iv, key, data });
  return r;
}

async function aesCbcDecrypt({
  iv,
  key,
  data,
}: IAesCbcInvokeParams): Promise<Buffer> {
  _aesCbcInvokeCheck({ iv, key, data });

  if (platformEnv.isNative) {
    const r: Buffer = await aesCbcDecryptByRNAes({ iv, key, data });
    return r;
  }

  if (ALLOW_USE_WEB_CRYPTO_SUBTLE) {
    const r: Buffer = await aesCbcDecryptByWebCrypto({ iv, key, data });
    return r;
  }

  const r: Buffer = aesCbcDecryptByAsmcrypto({ iv, key, data });
  return r;
}

// #endregion aesCbcDecrypt

async function $testSampleForAesCbc() {
  const data = Buffer.from('hello-world', 'utf8');
  // 32 bytes for AES-256
  const key = Buffer.from('12345678901234567890123456789012', 'utf8');
  // 16 bytes for AES-CBC
  const iv = Buffer.from('1234567890123456', 'utf8');

  const tasks: IRunAppCryptoTestTaskResult[] = [];

  // Test AES-CBC Encrypt implementations
  let expect = '20bfddded56f6d156e6d1124714d753b';
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'aesCbcEncryptByRNAes',
      fn: () => aesCbcEncryptByRNAes({ iv, key, data }),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'aesCbcEncryptByWebCrypto',
      fn: () => aesCbcEncryptByWebCrypto({ iv, key, data }),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'aesCbcEncryptByAsmcrypto',
      fn: () => aesCbcEncryptByAsmcrypto({ iv, key, data }),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'aesCbcEncryptByNoble',
      fn: () => aesCbcEncryptByNoble({ iv, key, data }),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'aesCbcEncryptByNodeCrypto',
      fn: () => aesCbcEncryptByNodeCrypto({ iv, key, data }),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'aesCbcEncryptSync',
      fn: () => aesCbcEncryptSync({ iv, key, data }),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'aesCbcEncrypt',
      fn: () => aesCbcEncrypt({ iv, key, data }),
    }),
  );

  // Test AES-CBC Decrypt implementations
  // First encrypt the data to get encrypted data for decryption tests
  const encryptedData = await aesCbcEncrypt({ iv, key, data });
  expect = data.toString('hex');

  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'aesCbcDecryptByRNAes',
      fn: () => aesCbcDecryptByRNAes({ iv, key, data: encryptedData }),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'aesCbcDecryptByWebCrypto',
      fn: () => aesCbcDecryptByWebCrypto({ iv, key, data: encryptedData }),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'aesCbcDecryptByAsmcrypto',
      fn: () => aesCbcDecryptByAsmcrypto({ iv, key, data: encryptedData }),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'aesCbcDecryptByNoble',
      fn: () => aesCbcDecryptByNoble({ iv, key, data: encryptedData }),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'aesCbcDecryptByNodeCrypto',
      fn: () => aesCbcDecryptByNodeCrypto({ iv, key, data: encryptedData }),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'aesCbcDecryptSync',
      fn: () => aesCbcDecryptSync({ iv, key, data: encryptedData }),
    }),
  );
  tasks.push(
    await runAppCryptoTestTask({
      expect,
      name: 'aesCbcDecrypt',
      fn: () => aesCbcDecrypt({ iv, key, data: encryptedData }),
    }),
  );

  tasks.push(
    await runAppCryptoTestTask({
      expect: bufferUtils.utf8ToBytes('password123').toString('hex'),
      name: 'aesCbcDecrypt(custom params)',
      fn: () =>
        aesCbcDecrypt({
          iv: bufferUtils.toBuffer('0abf2634f84ba671ade4ae412475f433'),
          key: bufferUtils.toBuffer(
            '62f26c4c50a2aaa8f306a9004120a7cf2535feeccb79b2f2495806f638414297',
          ),
          data: bufferUtils.toBuffer('755febcbea38fe0e1237d7f01eb01b9f'),
        }),
    }),
  );

  tasks.push(
    await runAppCryptoTestTask({
      expect: bufferUtils.utf8ToBytes('password123').toString('hex'),
      name: 'aesCbcDecrypt(wrong password1)',
      fn: () =>
        aesCbcDecrypt({
          iv: bufferUtils.toBuffer('0abf2634f84ba671ade4ae412475f433'),
          key: bufferUtils.toBuffer(
            '62f26c4c50a2aaa8f306a9004120a7cf2535feeccb79b2f2495806f638414299',
          ),
          data: bufferUtils.toBuffer('755febcbea38fe0e1237d7f01eb01b9f'),
        }),
    }),
  );

  tasks.push(
    await runAppCryptoTestTask({
      expect: bufferUtils.utf8ToBytes('password123').toString('hex'),
      name: 'aesCbcDecrypt(wrong password2)',
      fn: () =>
        aesCbcDecrypt({
          iv: bufferUtils.toBuffer('0abf2634f84ba671ade4ae412475f433'),
          key: bufferUtils.toBuffer(
            '62f26c4c50a2aaa8f306a9004120a7cf2535feeccb79b2f2495806f638414298',
          ),
          data: bufferUtils.toBuffer('755febcbea38fe0e1237d7f01eb01b9f'),
        }),
    }),
  );

  tasks.push(
    await runAppCryptoTestTask({
      expect: bufferUtils.utf8ToBytes('password123').toString('hex'),
      name: 'aesCbcDecrypt(wrong password3)',
      fn: () =>
        aesCbcDecrypt({
          iv: bufferUtils.toBuffer('0abf2634f84ba671ade4ae412475f433'),
          key: bufferUtils.toBuffer(
            '62f26c4c50a2aaa8f306a9004120a7cf2535feeccb79b2f2495806f638414297',
          ),
          data: bufferUtils.toBuffer('755febcbea38fe0e1237d7f01eb01b9a'),
        }),
    }),
  );

  tasks.push(
    await runAppCryptoTestTask({
      expect: bufferUtils.utf8ToBytes('password123').toString('hex'),
      name: 'aesCbcDecrypt(wrong password4)',
      fn: () =>
        aesCbcDecrypt({
          iv: bufferUtils.toBuffer('0abf2634f84ba671ade4ae412475f433'),
          key: bufferUtils.toBuffer(
            '62f26c4c50a2aaa8f306a9004120a7cf2535feeccb79b2f2495806f638414297',
          ),
          data: bufferUtils.toBuffer('755febcbea38fe0e1237d7f01eb01b9c'),
        }),
    }),
  );

  console.log('testSampleForAesCbc results', tasks);
  return {
    tasks,
  };
}

export {
  $testSampleForAesCbc,
  aesCbcEncryptSync,
  aesCbcEncrypt,
  aesCbcDecryptSync,
  aesCbcDecrypt,
};
