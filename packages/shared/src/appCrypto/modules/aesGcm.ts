import { gcm as aesGcmByNobleFn } from '@noble/ciphers/aes';

import { OneKeyLocalError } from '../../errors';

type IAesGcmInvokeParams = {
  nonce: Buffer;
  key: Buffer;
  data: Buffer;
  aad?: Buffer;
};

function _aesGcmInvokeCheck({ nonce, key, data }: IAesGcmInvokeParams) {
  if (!nonce || nonce.length <= 0) {
    throw new OneKeyLocalError('Zero-length nonce is not supported');
  }
  if (!key || key.length <= 0) {
    throw new OneKeyLocalError('Zero-length key is not supported');
  }
  if (!data || data.length <= 0) {
    throw new OneKeyLocalError('Zero-length data is not supported');
  }
}

function aesGcmEncryptByNoble({
  nonce,
  key,
  data,
  aad,
}: IAesGcmInvokeParams): Buffer {
  _aesGcmInvokeCheck({ nonce, key, data });

  const cipher = aesGcmByNobleFn(key, nonce, aad);
  const out = cipher.encrypt(data); // ciphertext || tag(128-bit)
  return Buffer.from(out);
}

function aesGcmDecryptByNoble({
  nonce,
  key,
  data,
  aad,
}: IAesGcmInvokeParams): Buffer {
  _aesGcmInvokeCheck({ nonce, key, data });

  const cipher = aesGcmByNobleFn(key, nonce, aad);
  const out = cipher.decrypt(data); // expects ciphertext || tag(128-bit)
  return Buffer.from(out);
}

async function aesGcmEncrypt({
  nonce,
  key,
  data,
  aad,
}: IAesGcmInvokeParams): Promise<Buffer> {
  return aesGcmEncryptByNoble({ nonce, key, data, aad });
}

async function aesGcmDecrypt({
  nonce,
  key,
  data,
  aad,
}: IAesGcmInvokeParams): Promise<Buffer> {
  return aesGcmDecryptByNoble({ nonce, key, data, aad });
}

export {
  aesGcmDecrypt,
  aesGcmEncrypt,
  //
  aesGcmDecryptByNoble,
  aesGcmEncryptByNoble,
};
