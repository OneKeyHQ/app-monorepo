import {
  LocalSecretEnvelopeUnavailable,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import type {
  ILocalSecretEnvelopeLayerAdapter,
  ILocalSecretEnvelopeLayerCapabilities,
} from './types';

export const DEFAULT_INDEXED_DB_CRYPTO_KEY_LSE_DB_NAME =
  'OneKeyLocalSecretEnvelopeCryptoKey';

export const INDEXED_DB_CRYPTO_KEY_LSE_STORE_NAME = 'CryptoKey';

const DEFAULT_INDEXED_DB_CRYPTO_KEY_LSE_KEY_REF_PREFIX =
  'onekey:lse:indexeddb-cryptokey:v1';

const AES_GCM_KEY_BITS = 256;
const AES_GCM_NONCE_BYTES = 12;
const KEY_REF_RANDOM_BYTES = 16;
const DB_VERSION = 1;

type IIndexedDbCryptoKeyRecord = {
  createdAt: number;
  id: string;
  key: CryptoKey;
  updatedAt: number;
};

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

function requestToPromise<TResult>(request: IDBRequest<TResult>) {
  return new Promise<TResult>((resolve, reject) => {
    request.onerror = () => {
      reject(request.error || new OneKeyLocalError('IndexedDB request failed'));
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.onabort = () => {
      reject(
        transaction.error ||
          new OneKeyLocalError('IndexedDB transaction aborted'),
      );
    };
    transaction.onerror = () => {
      reject(
        transaction.error ||
          new OneKeyLocalError('IndexedDB transaction failed'),
      );
    };
    transaction.oncomplete = () => {
      resolve();
    };
  });
}

function getIndexedDBInstance(
  indexedDBInstance?: IDBFactory | null,
): IDBFactory {
  const instance =
    indexedDBInstance === undefined ? globalThis.indexedDB : indexedDBInstance;
  invariant(
    Boolean(instance && typeof instance.open === 'function'),
    'Local secret envelope IndexedDB is unavailable',
  );
  return instance as IDBFactory;
}

function getCryptoGlobal(cryptoGlobal?: Crypto | null): Crypto {
  const cryptoInstance =
    cryptoGlobal === undefined ? globalThis.crypto : cryptoGlobal;
  const subtle = cryptoInstance?.subtle;
  invariant(
    Boolean(
      subtle &&
      typeof subtle.generateKey === 'function' &&
      typeof subtle.encrypt === 'function' &&
      typeof subtle.decrypt === 'function' &&
      typeof subtle.exportKey === 'function',
    ),
    'Local secret envelope WebCrypto is unavailable',
  );
  invariant(
    typeof cryptoInstance?.getRandomValues === 'function',
    'Local secret envelope secure random is unavailable',
  );
  return cryptoInstance;
}

function toWebCryptoBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(bytes.byteLength);
  result.set(bytes);
  return result;
}

function defaultRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  getCryptoGlobal().getRandomValues(bytes);
  return bytes;
}

function readAesGcmLayerIv({ alg, iv }: { alg: string; iv?: string }) {
  if (alg !== 'AES-256-GCM' || !iv) {
    throw new OneKeyLocalError('Invalid local secret envelope AES-GCM layer');
  }
  return toWebCryptoBytes(bufferUtils.toBuffer(iv, 'hex'));
}

async function openCryptoKeyDb({
  dbName,
  indexedDBInstance,
}: {
  dbName: string;
  indexedDBInstance?: IDBFactory | null;
}): Promise<IDBDatabase> {
  const indexedDB = getIndexedDBInstance(indexedDBInstance);
  const request = indexedDB.open(dbName, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(INDEXED_DB_CRYPTO_KEY_LSE_STORE_NAME)) {
      db.createObjectStore(INDEXED_DB_CRYPTO_KEY_LSE_STORE_NAME, {
        keyPath: 'id',
      });
    }
  };
  return requestToPromise(request);
}

async function readCryptoKeyRecord({
  dbName,
  indexedDBInstance,
  keyRef,
}: {
  dbName: string;
  indexedDBInstance?: IDBFactory | null;
  keyRef: string;
}): Promise<IIndexedDbCryptoKeyRecord | undefined> {
  const db = await openCryptoKeyDb({ dbName, indexedDBInstance });
  try {
    const transaction = db.transaction(
      INDEXED_DB_CRYPTO_KEY_LSE_STORE_NAME,
      'readonly',
    );
    const store = transaction.objectStore(INDEXED_DB_CRYPTO_KEY_LSE_STORE_NAME);
    const record = await requestToPromise(
      store.get(keyRef) as IDBRequest<IIndexedDbCryptoKeyRecord | undefined>,
    );
    await transactionDone(transaction);
    return record;
  } finally {
    db.close();
  }
}

async function writeCryptoKeyRecord({
  dbName,
  indexedDBInstance,
  key,
  keyRef,
}: {
  dbName: string;
  indexedDBInstance?: IDBFactory | null;
  key: CryptoKey;
  keyRef: string;
}): Promise<void> {
  const db = await openCryptoKeyDb({ dbName, indexedDBInstance });
  try {
    const transaction = db.transaction(
      INDEXED_DB_CRYPTO_KEY_LSE_STORE_NAME,
      'readwrite',
    );
    const store = transaction.objectStore(INDEXED_DB_CRYPTO_KEY_LSE_STORE_NAME);
    const now = Date.now();
    await requestToPromise(
      store.put({
        createdAt: now,
        id: keyRef,
        key,
        updatedAt: now,
      } satisfies IIndexedDbCryptoKeyRecord),
    );
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

async function deleteCryptoKeyRecord({
  dbName,
  indexedDBInstance,
  keyRef,
}: {
  dbName: string;
  indexedDBInstance?: IDBFactory | null;
  keyRef: string;
}): Promise<void> {
  const db = await openCryptoKeyDb({ dbName, indexedDBInstance });
  try {
    const transaction = db.transaction(
      INDEXED_DB_CRYPTO_KEY_LSE_STORE_NAME,
      'readwrite',
    );
    const store = transaction.objectStore(INDEXED_DB_CRYPTO_KEY_LSE_STORE_NAME);
    await requestToPromise(store.delete(keyRef));
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

async function generateCryptoKey({
  cryptoGlobal,
}: {
  cryptoGlobal?: Crypto | null;
}) {
  const cryptoInstance = getCryptoGlobal(cryptoGlobal);
  return cryptoInstance.subtle.generateKey(
    {
      length: AES_GCM_KEY_BITS,
      name: 'AES-GCM',
    },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function getOrCreateCryptoKey({
  cryptoGlobal,
  dbName,
  indexedDBInstance,
  keyRef,
}: {
  cryptoGlobal?: Crypto | null;
  dbName: string;
  indexedDBInstance?: IDBFactory | null;
  keyRef: string;
}) {
  const existingRecord = await readCryptoKeyRecord({
    dbName,
    indexedDBInstance,
    keyRef,
  });
  if (existingRecord?.key) {
    return existingRecord.key;
  }

  const key = await generateCryptoKey({ cryptoGlobal });
  await writeCryptoKeyRecord({
    dbName,
    indexedDBInstance,
    key,
    keyRef,
  });
  return key;
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
    const key = await generateCryptoKey({ cryptoGlobal });
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
