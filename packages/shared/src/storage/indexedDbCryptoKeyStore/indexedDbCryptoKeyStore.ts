import { OneKeyLocalError } from '../../errors';

/**
 * Origin-shared IndexedDB store for NON-EXTRACTABLE WebCrypto AES-GCM keys.
 *
 * The browser persists the CryptoKey object itself (structured clone) with
 * `extractable: false`, so page/extension JS can USE the key but can never
 * export its raw bytes — a pure disk-read attacker cannot recover it either,
 * because the raw key material never crosses into script-visible storage.
 *
 * Runtime model (per repo policy, label runtime assumptions explicitly):
 * IndexedDB is ORIGIN-scoped, not JS-context-scoped. In the browser
 * extension, the background service worker (`bg` runtime) and every UI page
 * (`main` runtime: popup / sidepanel / expanded tab / offscreen) share the
 * same extension origin, so they all resolve the SAME persisted key record
 * (one shared native/browser resource). Each JS runtime holds its own
 * in-memory CryptoKey handle (per-runtime JS-heap copy), which is just an
 * opaque reference — there is no key material duplication concern.
 *
 * This module was extracted from
 * `packages/kit-bg/src/dbs/local/localSecretEnvelope/indexedDbCryptoKeyLayerAdapter.ts`
 * so that `@onekeyhq/shared` consumers (e.g. SupabaseStorage) can reuse the
 * same device-key persistence without violating the import hierarchy
 * (shared must not import kit-bg). The local-secret-envelope layer adapter
 * in kit-bg now builds on these primitives.
 */

// Historical name: this database was introduced by the local secret envelope
// feature. It is now the generic device CryptoKey database for the whole
// origin; records are namespaced by their `id` (keyRef). Do NOT rename —
// existing persisted keys (and the envelopes wrapped with them) would be
// orphaned.
export const INDEXED_DB_CRYPTO_KEY_DB_NAME =
  'OneKeyLocalSecretEnvelopeCryptoKey';

export const INDEXED_DB_CRYPTO_KEY_STORE_NAME = 'CryptoKey';

export const INDEXED_DB_CRYPTO_KEY_AES_GCM_KEY_BITS = 256;
export const INDEXED_DB_CRYPTO_KEY_AES_GCM_NONCE_BYTES = 12;

const DB_VERSION = 1;

export type IIndexedDbCryptoKeyRecord = {
  createdAt: number;
  id: string;
  key: CryptoKey;
  updatedAt: number;
};

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

export function getIndexedDBInstance(
  indexedDBInstance?: IDBFactory | null,
): IDBFactory {
  const instance =
    indexedDBInstance === undefined ? globalThis.indexedDB : indexedDBInstance;
  invariant(
    Boolean(instance && typeof instance.open === 'function'),
    'CryptoKey store IndexedDB is unavailable',
  );
  return instance as IDBFactory;
}

export function getCryptoGlobal(cryptoGlobal?: Crypto | null): Crypto {
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
    'CryptoKey store WebCrypto is unavailable',
  );
  invariant(
    typeof cryptoInstance?.getRandomValues === 'function',
    'CryptoKey store secure random is unavailable',
  );
  return cryptoInstance;
}

export function toWebCryptoBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(bytes.byteLength);
  result.set(bytes);
  return result;
}

export function defaultRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  getCryptoGlobal().getRandomValues(bytes);
  return bytes;
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
    if (!db.objectStoreNames.contains(INDEXED_DB_CRYPTO_KEY_STORE_NAME)) {
      db.createObjectStore(INDEXED_DB_CRYPTO_KEY_STORE_NAME, {
        keyPath: 'id',
      });
    }
  };
  return requestToPromise(request);
}

export async function readCryptoKeyRecord({
  dbName = INDEXED_DB_CRYPTO_KEY_DB_NAME,
  indexedDBInstance,
  keyRef,
}: {
  dbName?: string;
  indexedDBInstance?: IDBFactory | null;
  keyRef: string;
}): Promise<IIndexedDbCryptoKeyRecord | undefined> {
  const db = await openCryptoKeyDb({ dbName, indexedDBInstance });
  try {
    const transaction = db.transaction(
      INDEXED_DB_CRYPTO_KEY_STORE_NAME,
      'readonly',
    );
    const store = transaction.objectStore(INDEXED_DB_CRYPTO_KEY_STORE_NAME);
    const record = await requestToPromise(
      store.get(keyRef) as IDBRequest<IIndexedDbCryptoKeyRecord | undefined>,
    );
    await transactionDone(transaction);
    return record;
  } finally {
    db.close();
  }
}

export async function writeCryptoKeyRecord({
  dbName = INDEXED_DB_CRYPTO_KEY_DB_NAME,
  indexedDBInstance,
  key,
  keyRef,
}: {
  dbName?: string;
  indexedDBInstance?: IDBFactory | null;
  key: CryptoKey;
  keyRef: string;
}): Promise<void> {
  const db = await openCryptoKeyDb({ dbName, indexedDBInstance });
  try {
    const transaction = db.transaction(
      INDEXED_DB_CRYPTO_KEY_STORE_NAME,
      'readwrite',
    );
    const store = transaction.objectStore(INDEXED_DB_CRYPTO_KEY_STORE_NAME);
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

export async function deleteCryptoKeyRecord({
  dbName = INDEXED_DB_CRYPTO_KEY_DB_NAME,
  indexedDBInstance,
  keyRef,
}: {
  dbName?: string;
  indexedDBInstance?: IDBFactory | null;
  keyRef: string;
}): Promise<void> {
  const db = await openCryptoKeyDb({ dbName, indexedDBInstance });
  try {
    const transaction = db.transaction(
      INDEXED_DB_CRYPTO_KEY_STORE_NAME,
      'readwrite',
    );
    const store = transaction.objectStore(INDEXED_DB_CRYPTO_KEY_STORE_NAME);
    await requestToPromise(store.delete(keyRef));
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function generateNonExtractableAesGcmKey({
  cryptoGlobal,
}: {
  cryptoGlobal?: Crypto | null;
} = {}): Promise<CryptoKey> {
  const cryptoInstance = getCryptoGlobal(cryptoGlobal);
  return cryptoInstance.subtle.generateKey(
    {
      length: INDEXED_DB_CRYPTO_KEY_AES_GCM_KEY_BITS,
      name: 'AES-GCM',
    },
    false, // extractable: false — key material can never leave the browser
    ['encrypt', 'decrypt'],
  );
}

/**
 * Returns the persisted key for `keyRef`, creating it if absent.
 *
 * Race safety: `subtle.generateKey` cannot run inside an IndexedDB
 * transaction (awaiting a non-IDB promise lets the transaction auto-commit),
 * so a candidate key is generated first and the winner is decided inside a
 * SINGLE readwrite transaction. IndexedDB serializes readwrite transactions
 * on the same store, so two racing JS runtimes (e.g. ext `bg` service worker
 * and a `main` UI page share the origin database) always converge on the
 * same persisted key instead of overwriting each other.
 */
export async function getOrCreateCryptoKey({
  cryptoGlobal,
  dbName = INDEXED_DB_CRYPTO_KEY_DB_NAME,
  indexedDBInstance,
  keyRef,
}: {
  cryptoGlobal?: Crypto | null;
  dbName?: string;
  indexedDBInstance?: IDBFactory | null;
  keyRef: string;
}): Promise<CryptoKey> {
  const candidateKey = await generateNonExtractableAesGcmKey({ cryptoGlobal });
  const db = await openCryptoKeyDb({ dbName, indexedDBInstance });
  try {
    const transaction = db.transaction(
      INDEXED_DB_CRYPTO_KEY_STORE_NAME,
      'readwrite',
    );
    const store = transaction.objectStore(INDEXED_DB_CRYPTO_KEY_STORE_NAME);
    const existingRecord = await requestToPromise(
      store.get(keyRef) as IDBRequest<IIndexedDbCryptoKeyRecord | undefined>,
    );
    if (existingRecord?.key) {
      await transactionDone(transaction);
      return existingRecord.key;
    }
    const now = Date.now();
    await requestToPromise(
      store.put({
        createdAt: now,
        id: keyRef,
        key: candidateKey,
        updatedAt: now,
      } satisfies IIndexedDbCryptoKeyRecord),
    );
    await transactionDone(transaction);
    return candidateKey;
  } finally {
    db.close();
  }
}
