import { gcm as aesGcmByNobleFn } from '@noble/ciphers/aes';

import RN_AES from '@onekeyhq/shared/src/modules3rdParty/react-native-aes-crypto';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OneKeyLocalError } from '../../errors';
import bufferUtils from '../../utils/bufferUtils';

type IAesGcmInvokeParams = {
  nonce: Buffer;
  key: Buffer;
  data: Buffer;
  aad?: Buffer;
  debugCryptoProbeId?: string;
};

type IAesGcmBackend = 'noble' | 'react-native-aes-crypto';
type IAesGcmOperation = 'decrypt' | 'encrypt';

type IAesGcmInvocation = {
  backend: IAesGcmBackend;
  debugCryptoProbeId?: string;
  operation: IAesGcmOperation;
};

type IReactNativeAesGcmMethods = {
  aesGcmEncrypt?: (
    data: string,
    key: string,
    nonce: string,
    aad: string,
  ) => Promise<string>;
  aesGcmDecrypt?: (
    ciphertextWithTag: string,
    key: string,
    nonce: string,
    aad: string,
  ) => Promise<string>;
};

const rnAesWithOptionalGcm = RN_AES as Omit<
  typeof RN_AES,
  'aesGcmEncrypt' | 'aesGcmDecrypt'
> &
  IReactNativeAesGcmMethods;

let lastAesGcmInvocation: IAesGcmInvocation | undefined;
const aesGcmInvocationsByProbeId = new Map<string, IAesGcmInvocation>();

function recordAesGcmInvocation(invocation: IAesGcmInvocation) {
  lastAesGcmInvocation = invocation;
  if (invocation.debugCryptoProbeId) {
    aesGcmInvocationsByProbeId.set(invocation.debugCryptoProbeId, invocation);
  }
}

function clearLastAesGcmInvocation() {
  lastAesGcmInvocation = undefined;
}

function getLastAesGcmInvocation() {
  return lastAesGcmInvocation;
}

function clearAesGcmInvocationByProbeId(debugCryptoProbeId: string) {
  aesGcmInvocationsByProbeId.delete(debugCryptoProbeId);
}

function getAesGcmInvocationByProbeId(debugCryptoProbeId: string) {
  return aesGcmInvocationsByProbeId.get(debugCryptoProbeId);
}

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
  debugCryptoProbeId,
}: IAesGcmInvokeParams): Buffer {
  _aesGcmInvokeCheck({ nonce, key, data });

  const cipher = aesGcmByNobleFn(key, nonce, aad);
  const out = cipher.encrypt(data); // ciphertext || tag(128-bit)
  recordAesGcmInvocation({
    backend: 'noble',
    debugCryptoProbeId,
    operation: 'encrypt',
  });
  return Buffer.from(out);
}

function aesGcmDecryptByNoble({
  nonce,
  key,
  data,
  aad,
  debugCryptoProbeId,
}: IAesGcmInvokeParams): Buffer {
  _aesGcmInvokeCheck({ nonce, key, data });

  const cipher = aesGcmByNobleFn(key, nonce, aad);
  const out = cipher.decrypt(data); // expects ciphertext || tag(128-bit)
  recordAesGcmInvocation({
    backend: 'noble',
    debugCryptoProbeId,
    operation: 'decrypt',
  });
  return Buffer.from(out);
}

async function aesGcmEncryptByRNAes({
  nonce,
  key,
  data,
  aad,
  debugCryptoProbeId,
}: IAesGcmInvokeParams): Promise<Buffer> {
  _aesGcmInvokeCheck({ nonce, key, data });

  const encrypted = await rnAesWithOptionalGcm.aesGcmEncrypt?.(
    bufferUtils.bytesToHex(data),
    bufferUtils.bytesToHex(key),
    bufferUtils.bytesToHex(nonce),
    aad ? bufferUtils.bytesToHex(aad) : '',
  );
  if (!encrypted) {
    throw new OneKeyLocalError('Native AES-GCM encrypt is not available');
  }
  recordAesGcmInvocation({
    backend: 'react-native-aes-crypto',
    debugCryptoProbeId,
    operation: 'encrypt',
  });
  return Buffer.from(encrypted, 'hex');
}

async function aesGcmDecryptByRNAes({
  nonce,
  key,
  data,
  aad,
  debugCryptoProbeId,
}: IAesGcmInvokeParams): Promise<Buffer> {
  _aesGcmInvokeCheck({ nonce, key, data });

  const decrypted = await rnAesWithOptionalGcm.aesGcmDecrypt?.(
    bufferUtils.bytesToHex(data),
    bufferUtils.bytesToHex(key),
    bufferUtils.bytesToHex(nonce),
    aad ? bufferUtils.bytesToHex(aad) : '',
  );
  if (!decrypted) {
    throw new OneKeyLocalError('Native AES-GCM decrypt is not available');
  }
  recordAesGcmInvocation({
    backend: 'react-native-aes-crypto',
    debugCryptoProbeId,
    operation: 'decrypt',
  });
  return Buffer.from(decrypted, 'hex');
}

async function aesGcmEncrypt({
  nonce,
  key,
  data,
  aad,
  debugCryptoProbeId,
}: IAesGcmInvokeParams): Promise<Buffer> {
  if (platformEnv.isNative && rnAesWithOptionalGcm.aesGcmEncrypt) {
    return aesGcmEncryptByRNAes({ nonce, key, data, aad, debugCryptoProbeId });
  }
  return aesGcmEncryptByNoble({ nonce, key, data, aad, debugCryptoProbeId });
}

async function aesGcmDecrypt({
  nonce,
  key,
  data,
  aad,
  debugCryptoProbeId,
}: IAesGcmInvokeParams): Promise<Buffer> {
  if (platformEnv.isNative && rnAesWithOptionalGcm.aesGcmDecrypt) {
    return aesGcmDecryptByRNAes({ nonce, key, data, aad, debugCryptoProbeId });
  }
  return aesGcmDecryptByNoble({ nonce, key, data, aad, debugCryptoProbeId });
}

function getAesGcmBackendForCurrentPlatform(): string {
  if (platformEnv.isNative && rnAesWithOptionalGcm.aesGcmEncrypt) {
    return 'react-native-aes-crypto';
  }
  return 'noble';
}

export {
  aesGcmDecrypt,
  aesGcmDecryptByRNAes,
  aesGcmEncrypt,
  aesGcmEncryptByRNAes,
  clearAesGcmInvocationByProbeId,
  clearLastAesGcmInvocation,
  getAesGcmInvocationByProbeId,
  getLastAesGcmInvocation,
  getAesGcmBackendForCurrentPlatform,
  //
  aesGcmDecryptByNoble,
  aesGcmEncryptByNoble,
};
