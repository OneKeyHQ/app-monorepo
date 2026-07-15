import {
  LocalSecretEnvelopeUnavailable,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import {
  INDEXED_DB_CRYPTO_KEY_AES_GCM_NONCE_BYTES,
  INDEXED_DB_CRYPTO_KEY_DB_NAME,
  INDEXED_DB_CRYPTO_KEY_STORE_NAME,
  defaultRandomBytes,
  deleteCryptoKeyRecord,
  generateNonExtractableAesGcmKey,
  getCryptoGlobal,
  getIndexedDBInstance,
  getOrCreateCryptoKey,
  readCryptoKeyRecord,
  toWebCryptoBytes,
  writeCryptoKeyRecord,
} from '@onekeyhq/shared/src/storage/indexedDbCryptoKeyStore';
import type { IIndexedDbCryptoKeyRecord } from '@onekeyhq/shared/src/storage/indexedDbCryptoKeyStore';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import type {
  ILocalSecretEnvelopeLayerAdapter,
  ILocalSecretEnvelopeLayerCapabilities,
} from './types';

// The IndexedDB CryptoKey persistence primitives live in
// `@onekeyhq/shared/src/storage/indexedDbCryptoKeyStore` (extracted from this
// file) so that shared-level consumers (e.g. SupabaseStorage device-key
// sealing) can reuse the same origin-shared key database without importing
// kit-bg. This adapter keeps the local-secret-envelope-specific parts:
// per-envelope random keyRefs, AAD binding, and the retryable
// LocalSecretEnvelopeUnavailable error mapping.
export const DEFAULT_INDEXED_DB_CRYPTO_KEY_LSE_DB_NAME =
  INDEXED_DB_CRYPTO_KEY_DB_NAME;

export const INDEXED_DB_CRYPTO_KEY_LSE_STORE_NAME =
  INDEXED_DB_CRYPTO_KEY_STORE_NAME;

const DEFAULT_INDEXED_DB_CRYPTO_KEY_LSE_KEY_REF_PREFIX =
  'onekey:lse:indexeddb-cryptokey:v1';

const AES_GCM_NONCE_BYTES = INDEXED_DB_CRYPTO_KEY_AES_GCM_NONCE_BYTES;
const KEY_REF_RANDOM_BYTES = 16;

type IIndexedDbCryptoKeyLayerParams = {
  cryptoGlobal?: Crypto | null;
  dbName?: string;
  indexedDBInstance?: IDBFactory | null;
  keyRefPrefix?: string;
  randomBytes?: (length: number) => Uint8Array;
};

const capabilities: ILocalSecretEnvelopeLayerCapabilities = {
  sync: 'unknown',
  extractable: false,
  keyAccess: 'opaque-decrypt',
};

const INDEXED_DB_CRYPTO_KEY_LSE_LAYER_KIND = 'indexeddb-cryptokey';

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new OneKeyLocalError(message);
  }
}

function readAesGcmLayerIv({ alg, iv }: { alg: string; iv?: string }) {
  if (alg !== 'AES-256-GCM' || !iv) {
    throw new OneKeyLocalError('Invalid local secret envelope AES-GCM layer');
  }
  return toWebCryptoBytes(bufferUtils.toBuffer(iv, 'hex'));
}

async function getExistingCryptoKey({
  dbName,
  indexedDBInstance,
  keyRef,
}: {
  dbName: string;
  indexedDBInstance?: IDBFactory | null;
  keyRef: string;
}) {
  let existingRecord: IIndexedDbCryptoKeyRecord | undefined;
  try {
    existingRecord = await readCryptoKeyRecord({
      dbName,
      indexedDBInstance,
      keyRef,
    });
  } catch {
    // IndexedDB transiently unavailable (storage pressure / private mode /
    // db open or transaction rejected): surface a retryable signal instead of a
    // generic failure, so a correct password is not misread as wrong and fed
    // into the wrong-password protection / reset-app counter.
    throw new LocalSecretEnvelopeUnavailable({
      message: `Local secret envelope wrapping key unavailable: kind=${INDEXED_DB_CRYPTO_KEY_LSE_LAYER_KIND}`,
    });
  }
  if (!existingRecord?.key) {
    // Missing CryptoKey (record evicted / cleared) is also surfaced as a
    // retryable unavailable error rather than a generic failure. web/ext rely
    // solely on this layer, and a generic error here is treated by the unlock
    // UI as a wrong password and could drive a silent app reset.
    throw new LocalSecretEnvelopeUnavailable({
      message: `Local secret envelope wrapping key unavailable: kind=${INDEXED_DB_CRYPTO_KEY_LSE_LAYER_KIND}`,
    });
  }
  return existingRecord.key;
}

export async function readIndexedDbCryptoKeyForLocalSecretEnvelope({
  dbName = DEFAULT_INDEXED_DB_CRYPTO_KEY_LSE_DB_NAME,
  indexedDBInstance,
  keyRef,
}: {
  dbName?: string;
  indexedDBInstance?: IDBFactory | null;
  keyRef: string;
}): Promise<CryptoKey | undefined> {
  return (
    await readCryptoKeyRecord({
      dbName,
      indexedDBInstance,
      keyRef,
    })
  )?.key;
}

export async function deleteIndexedDbCryptoKeyForLocalSecretEnvelope({
  dbName = DEFAULT_INDEXED_DB_CRYPTO_KEY_LSE_DB_NAME,
  indexedDBInstance,
  keyRef,
}: {
  dbName?: string;
  indexedDBInstance?: IDBFactory | null;
  keyRef: string;
}): Promise<void> {
  await deleteCryptoKeyRecord({
    dbName,
    indexedDBInstance,
    keyRef,
  });
}

export function buildIndexedDbCryptoKeyLocalSecretEnvelopeLayerAdapter({
  cryptoGlobal,
  dbName = DEFAULT_INDEXED_DB_CRYPTO_KEY_LSE_DB_NAME,
  indexedDBInstance,
  keyRefPrefix = DEFAULT_INDEXED_DB_CRYPTO_KEY_LSE_KEY_REF_PREFIX,
  randomBytes = defaultRandomBytes,
}: IIndexedDbCryptoKeyLayerParams = {}): ILocalSecretEnvelopeLayerAdapter {
  return {
    kind: INDEXED_DB_CRYPTO_KEY_LSE_LAYER_KIND,
    prepareLayer: async () => {
      getIndexedDBInstance(indexedDBInstance);
      getCryptoGlobal(cryptoGlobal);
      const keyRefRandom = bufferUtils.bytesToHex(
        randomBytes(KEY_REF_RANDOM_BYTES),
      );
      const iv = bufferUtils.bytesToHex(randomBytes(AES_GCM_NONCE_BYTES));
      return {
        alg: 'AES-256-GCM',
        capabilities,
        iv,
        keyRef: `${keyRefPrefix}:${keyRefRandom}`,
        kind: INDEXED_DB_CRYPTO_KEY_LSE_LAYER_KIND,
      };
    },
    encrypt: async ({ aad, layer, plaintext }) => {
      const cryptoInstance = getCryptoGlobal(cryptoGlobal);
      const key = await getOrCreateCryptoKey({
        cryptoGlobal,
        dbName,
        indexedDBInstance,
        keyRef: layer.keyRef,
      });
      const encrypted = await cryptoInstance.subtle.encrypt(
        {
          additionalData: toWebCryptoBytes(bufferUtils.utf8ToBytes(aad)),
          iv: readAesGcmLayerIv(layer),
          name: 'AES-GCM',
        },
        key,
        toWebCryptoBytes(bufferUtils.utf8ToBytes(plaintext)),
      );
      return bufferUtils.bytesToBase64(new Uint8Array(encrypted));
    },
    encryptWithExistingKey: async ({ aad, layer, plaintext }) => {
      const cryptoInstance = getCryptoGlobal(cryptoGlobal);
      const key = await getExistingCryptoKey({
        dbName,
        indexedDBInstance,
        keyRef: layer.keyRef,
      });
      const encrypted = await cryptoInstance.subtle.encrypt(
        {
          additionalData: toWebCryptoBytes(bufferUtils.utf8ToBytes(aad)),
          iv: readAesGcmLayerIv(layer),
          name: 'AES-GCM',
        },
        key,
        toWebCryptoBytes(bufferUtils.utf8ToBytes(plaintext)),
      );
      return bufferUtils.bytesToBase64(new Uint8Array(encrypted));
    },
    decrypt: async ({ aad, ciphertext, layer }) => {
      const cryptoInstance = getCryptoGlobal(cryptoGlobal);
      const key = await getExistingCryptoKey({
        dbName,
        indexedDBInstance,
        keyRef: layer.keyRef,
      });
      const decrypted = await cryptoInstance.subtle.decrypt(
        {
          additionalData: toWebCryptoBytes(bufferUtils.utf8ToBytes(aad)),
          iv: readAesGcmLayerIv(layer),
          name: 'AES-GCM',
        },
        key,
        toWebCryptoBytes(bufferUtils.base64ToBytes(ciphertext)),
      );
      return bufferUtils.bytesToUtf8(new Uint8Array(decrypted), {
        checkIsValidUtf8: true,
      });
    },
    deleteLayerKey: async ({ layer }) => {
      await deleteCryptoKeyRecord({
        dbName,
        indexedDBInstance,
        keyRef: layer.keyRef,
      });
    },
  };
}

export async function isIndexedDbCryptoKeyLocalSecretEnvelopeLayerAvailable({
  cryptoGlobal,
  dbName = DEFAULT_INDEXED_DB_CRYPTO_KEY_LSE_DB_NAME,
  indexedDBInstance,
  randomBytes = defaultRandomBytes,
}: IIndexedDbCryptoKeyLayerParams = {}): Promise<boolean> {
  let keyRef: string | undefined;
  try {
    const cryptoInstance = getCryptoGlobal(cryptoGlobal);
    getIndexedDBInstance(indexedDBInstance);
    keyRef = `${DEFAULT_INDEXED_DB_CRYPTO_KEY_LSE_KEY_REF_PREFIX}:probe:${bufferUtils.bytesToHex(
      randomBytes(KEY_REF_RANDOM_BYTES),
    )}`;
    const key = await generateNonExtractableAesGcmKey({ cryptoGlobal });
    await writeCryptoKeyRecord({
      dbName,
      indexedDBInstance,
      key,
      keyRef,
    });
    const storedKey = await getExistingCryptoKey({
      dbName,
      indexedDBInstance,
      keyRef,
    });
    const aad = toWebCryptoBytes(
      bufferUtils.utf8ToBytes('local-secret-envelope-probe-aad'),
    );
    const iv = toWebCryptoBytes(randomBytes(AES_GCM_NONCE_BYTES));
    const plaintext = toWebCryptoBytes(
      bufferUtils.utf8ToBytes('local-secret-envelope-probe-plaintext'),
    );
    const encrypted = await cryptoInstance.subtle.encrypt(
      {
        additionalData: aad,
        iv,
        name: 'AES-GCM',
      },
      storedKey,
      plaintext,
    );
    const decrypted = await cryptoInstance.subtle.decrypt(
      {
        additionalData: aad,
        iv,
        name: 'AES-GCM',
      },
      storedKey,
      encrypted,
    );
    invariant(
      bufferUtils.bytesToUtf8(new Uint8Array(decrypted)) ===
        'local-secret-envelope-probe-plaintext',
      'Local secret envelope CryptoKey roundtrip failed',
    );

    try {
      await cryptoInstance.subtle.exportKey('raw', storedKey);
      return false;
    } catch {
      // Expected: LSE IndexedDB CryptoKey must be extractable:false.
    }

    return true;
  } catch {
    return false;
  } finally {
    if (keyRef) {
      try {
        await deleteCryptoKeyRecord({
          dbName,
          indexedDBInstance,
          keyRef,
        });
      } catch {
        // Best-effort cleanup for the availability probe.
      }
    }
  }
}
