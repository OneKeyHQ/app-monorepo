import {
  aesGcmDecrypt,
  aesGcmEncrypt,
} from '@onekeyhq/shared/src/appCrypto/modules/aesGcm';
import {
  LocalSecretEnvelopeUnavailable,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import type {
  ILocalSecretEnvelopeLayerAdapter,
  ILocalSecretEnvelopeLayerCapabilities,
  ILocalSecretEnvelopeLayerKind,
} from './types';

const AES_GCM_KEY_BYTES = 32;
const AES_GCM_NONCE_BYTES = 12;

export type ILocalSecretEnvelopeAesGcmKeyStorage = {
  getOrCreateItem?: (
    keyRef: string,
    createKeyHex: () => string,
  ) => Promise<string>;
  getItem: (keyRef: string) => Promise<string | null>;
  setItem: (keyRef: string, keyHex: string) => Promise<void>;
  supportStorage?: () => Promise<boolean>;
};

export type IBuildLocalSecretEnvelopeAesGcmLayerAdapterParams = {
  capabilities: ILocalSecretEnvelopeLayerCapabilities;
  keyRef: string;
  keyStorage: ILocalSecretEnvelopeAesGcmKeyStorage;
  kind: ILocalSecretEnvelopeLayerKind;
  randomBytes?: (length: number) => Uint8Array;
};

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new OneKeyLocalError(message);
  }
}

function buildLayerErrorMessage({
  kind,
  message,
}: {
  kind: ILocalSecretEnvelopeLayerKind;
  message: string;
}) {
  return `${message}: kind=${kind}`;
}

function defaultRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoGlobal = globalThis.crypto;
  const getRandomValues = cryptoGlobal?.getRandomValues?.bind(cryptoGlobal);
  invariant(
    typeof getRandomValues === 'function',
    'Local secret envelope secure random is unavailable',
  );
  getRandomValues(bytes);
  return bytes;
}

function readAesGcmKey(keyHex: string): Buffer {
  const key = bufferUtils.toBuffer(keyHex, 'hex');
  invariant(
    key.length === AES_GCM_KEY_BYTES,
    'Invalid local secret envelope wrapping key',
  );
  return key;
}

function readAesGcmLayerIv({ alg, iv }: { alg: string; iv?: string }): string {
  if (alg !== 'AES-256-GCM' || !iv) {
    throw new OneKeyLocalError('Invalid local secret envelope AES-GCM layer');
  }
  return iv;
}

async function getOrCreateAesGcmKey({
  keyRef,
  keyStorage,
  randomBytes,
}: {
  keyRef: string;
  keyStorage: ILocalSecretEnvelopeAesGcmKeyStorage;
  randomBytes: (length: number) => Uint8Array;
}): Promise<Buffer> {
  if (keyStorage.getOrCreateItem) {
    return readAesGcmKey(
      await keyStorage.getOrCreateItem(keyRef, () =>
        bufferUtils.bytesToHex(randomBytes(AES_GCM_KEY_BYTES)),
      ),
    );
  }

  const existingKeyHex = await keyStorage.getItem(keyRef);
  if (existingKeyHex) {
    return readAesGcmKey(existingKeyHex);
  }

  const keyHex = bufferUtils.bytesToHex(randomBytes(AES_GCM_KEY_BYTES));
  await keyStorage.setItem(keyRef, keyHex);
  return readAesGcmKey(keyHex);
}

async function getExistingAesGcmKey({
  keyRef,
  keyStorage,
  kind,
}: {
  keyRef: string;
  keyStorage: ILocalSecretEnvelopeAesGcmKeyStorage;
  kind: ILocalSecretEnvelopeLayerKind;
}): Promise<Buffer> {
  let existingKeyHex: string | null;
  try {
    existingKeyHex = await keyStorage.getItem(keyRef);
  } catch {
    // Key storage (keychain / secure storage) transiently unavailable: surface
    // a retryable signal instead of a generic/permanent failure.
    throw new LocalSecretEnvelopeUnavailable({
      message: buildLayerErrorMessage({
        kind,
        message: 'Local secret envelope wrapping key unavailable',
      }),
    });
  }
  if (!existingKeyHex) {
    throw new LocalSecretEnvelopeUnavailable({
      message: buildLayerErrorMessage({
        kind,
        message: 'Local secret envelope wrapping key unavailable',
      }),
    });
  }
  return readAesGcmKey(existingKeyHex);
}

async function ensureStorageSupported({
  keyStorage,
  kind,
}: {
  keyStorage: ILocalSecretEnvelopeAesGcmKeyStorage;
  kind: ILocalSecretEnvelopeLayerKind;
}): Promise<void> {
  if (!keyStorage.supportStorage) {
    return;
  }
  invariant(
    await keyStorage.supportStorage(),
    buildLayerErrorMessage({
      kind,
      message: 'Local secret envelope key storage unavailable',
    }),
  );
}

export function buildLocalSecretEnvelopeAesGcmLayerAdapter({
  capabilities,
  keyRef,
  keyStorage,
  kind,
  randomBytes = defaultRandomBytes,
}: IBuildLocalSecretEnvelopeAesGcmLayerAdapterParams): ILocalSecretEnvelopeLayerAdapter {
  const adapter: ILocalSecretEnvelopeLayerAdapter = {
    kind,
    prepareLayer: async () => {
      await ensureStorageSupported({ keyStorage, kind });
      invariant(
        Boolean(keyRef),
        'Local secret envelope wrapping keyRef is unavailable',
      );
      const iv = bufferUtils.bytesToHex(randomBytes(AES_GCM_NONCE_BYTES));
      return {
        kind,
        keyRef,
        alg: 'AES-256-GCM',
        iv,
        capabilities,
      };
    },
    encrypt: async ({ aad, layer, plaintext }) => {
      const iv = readAesGcmLayerIv(layer);
      const key = await getOrCreateAesGcmKey({
        keyRef: layer.keyRef,
        keyStorage,
        randomBytes,
      });
      const encrypted = await aesGcmEncrypt({
        aad: bufferUtils.utf8ToBytes(aad),
        data: bufferUtils.utf8ToBytes(plaintext),
        key,
        nonce: bufferUtils.toBuffer(iv, 'hex'),
      });
      return bufferUtils.bytesToBase64(encrypted);
    },
    encryptWithExistingKey: async ({ aad, layer, plaintext }) => {
      const iv = readAesGcmLayerIv(layer);
      const key = await getExistingAesGcmKey({
        kind,
        keyRef: layer.keyRef,
        keyStorage,
      });
      const encrypted = await aesGcmEncrypt({
        aad: bufferUtils.utf8ToBytes(aad),
        data: bufferUtils.utf8ToBytes(plaintext),
        key,
        nonce: bufferUtils.toBuffer(iv, 'hex'),
      });
      return bufferUtils.bytesToBase64(encrypted);
    },
    decrypt: async ({ aad, ciphertext, layer }) => {
      const iv = readAesGcmLayerIv(layer);
      const key = await getExistingAesGcmKey({
        kind,
        keyRef: layer.keyRef,
        keyStorage,
      });
      const decrypted = await aesGcmDecrypt({
        aad: bufferUtils.utf8ToBytes(aad),
        data: bufferUtils.base64ToBytes(ciphertext),
        key,
        nonce: bufferUtils.toBuffer(iv, 'hex'),
      });
      return bufferUtils.bytesToUtf8(decrypted, { checkIsValidUtf8: true });
    },
  };

  return adapter;
}
