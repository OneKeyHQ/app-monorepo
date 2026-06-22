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
  if (!invocation.debugCryptoProbeId) {
    return;
  }
  lastAesGcmInvocation = invocation;
  aesGcmInvocationsByProbeId.set(invocation.debugCryptoProbeId, invocation);
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

function _aesGcmInvokeCheck({ nonce, key, data, aad }: IAesGcmInvokeParams) {
  if (!nonce || nonce.length <= 0) {
    throw new OneKeyLocalError('Zero-length nonce is not supported');
  }
  if (!key || key.length <= 0) {
    throw new OneKeyLocalError('Zero-length key is not supported');
  }
  if (!data || data.length <= 0) {
    throw new OneKeyLocalError('Zero-length data is not supported');
  }
  // Reject only an *explicit* zero-length Buffer AAD (passing
  // Buffer.alloc(0) is almost always a bug — the native guard introduced
  // upstream in OneKeyHQ/app-modules#55 rejects it too). Undefined AAD
  // means "no AAD binding" and remains supported so legacy `1K_AES_GCM`
  // payloads originally encrypted without AAD can still be decrypted.
  if (aad !== undefined && aad.length <= 0) {
    throw new OneKeyLocalError('Zero-length aad is not supported');
  }
}

function aesGcmEncryptByNoble({
  nonce,
  key,
  data,
  aad,
  debugCryptoProbeId,
}: IAesGcmInvokeParams): Buffer {
  _aesGcmInvokeCheck({ nonce, key, data, aad });

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
  _aesGcmInvokeCheck({ nonce, key, data, aad });

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
  _aesGcmInvokeCheck({ nonce, key, data, aad });

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
  _aesGcmInvokeCheck({ nonce, key, data, aad });

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

// Dev-only override: callers (e.g. CryptoGallery) can force a specific
// AES-GCM backend for benchmarking / correctness comparison. Production
// callers should NEVER set this — leave undefined to use the platform
// default chosen by the dispatcher below.
type IAesGcmDispatchBackend = 'noble' | 'native';
type IAesGcmDispatchParams = IAesGcmInvokeParams & {
  backend?: IAesGcmDispatchBackend;
};

async function aesGcmEncrypt({
  nonce,
  key,
  data,
  aad,
  debugCryptoProbeId,
  backend,
}: IAesGcmDispatchParams): Promise<Buffer> {
  if (backend === 'noble') {
    return aesGcmEncryptByNoble({ nonce, key, data, aad, debugCryptoProbeId });
  }
  if (backend === 'native') {
    return aesGcmEncryptByRNAes({ nonce, key, data, aad, debugCryptoProbeId });
  }
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
  backend,
}: IAesGcmDispatchParams): Promise<Buffer> {
  if (backend === 'noble') {
    return aesGcmDecryptByNoble({ nonce, key, data, aad, debugCryptoProbeId });
  }
  if (backend === 'native') {
    return aesGcmDecryptByRNAes({ nonce, key, data, aad, debugCryptoProbeId });
  }
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

export type { IAesGcmDispatchBackend, IAesGcmDispatchParams };

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
