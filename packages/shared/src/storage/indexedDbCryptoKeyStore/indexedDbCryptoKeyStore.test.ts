import storageChecker from '../../storageChecker/storageChecker';

import { writeCryptoKeyRecord } from './indexedDbCryptoKeyStore';

// The DB-open path fires a best-effort persistent-storage request that reaches
// appStorage, which would instantiate the real WebStorage/IndexedDB stack.
jest.mock('../appStorage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: {
    isWebDappMode: false,
    isExtension: true,
    isDesktop: false,
  },
  ERuntimeRole: {
    Main: 'main',
    Background: 'background',
    Standalone: 'standalone',
  },
}));

/**
 * Minimal IDBFactory whose `put` fails asynchronously, the way a real quota
 * exhaustion does. These raw CryptoKey paths do not go through
 * `IndexedDBTransactionPromised`, so the async failure has to be reported to
 * the storage state machine explicitly.
 */
function createQuotaFailingIndexedDB(): IDBFactory {
  const quotaError = new DOMException(
    'The quota has been exceeded.',
    'QuotaExceededError',
  );

  const store = {
    put: () => {
      const request: Record<string, unknown> = { error: quotaError };
      // Fire after the caller has attached onerror, like a real IDBRequest.
      setTimeout(() => {
        (request.onerror as (() => void) | undefined)?.();
      }, 0);
      return request;
    },
  };

  const transaction = {
    objectStore: () => store,
    error: quotaError,
  };

  const db = {
    transaction: () => transaction,
    close: () => undefined,
    objectStoreNames: { contains: () => true },
  };

  return {
    open: () => {
      const request: Record<string, unknown> = { result: db };
      setTimeout(() => {
        (request.onsuccess as (() => void) | undefined)?.();
      }, 0);
      return request;
    },
  } as unknown as IDBFactory;
}

describe('indexedDbCryptoKeyStore quota reporting', () => {
  beforeEach(() => {
    globalThis.$onekeySystemDiskIsFull = undefined;
  });

  afterEach(() => {
    globalThis.$onekeySystemDiskIsFull = undefined;
    jest.restoreAllMocks();
  });

  it('reports a quota failure raised by the database open itself', async () => {
    // "QuotaExceededError: Encountered full disk while opening backing store
    // for indexedDB.open" fails here, before any transaction exists.
    const quotaError = new DOMException(
      'Encountered full disk while opening backing store',
      'QuotaExceededError',
    );
    const failingOpenIndexedDB = {
      open: () => {
        const request: Record<string, unknown> = { error: quotaError };
        setTimeout(() => (request.onerror as (() => void) | undefined)?.(), 0);
        return request;
      },
    } as unknown as IDBFactory;

    await expect(
      writeCryptoKeyRecord({
        indexedDBInstance: failingOpenIndexedDB,
        key: {} as CryptoKey,
        keyRef: 'test-key-ref',
      }),
    ).rejects.toBeDefined();

    expect(globalThis.$onekeySystemDiskIsFull).toBe(true);
  });

  it('reports an async quota failure to the storage guard and rethrows', async () => {
    const reportSpy = jest.spyOn(storageChecker, 'handleDiskFullError');

    await expect(
      writeCryptoKeyRecord({
        indexedDBInstance: createQuotaFailingIndexedDB(),
        key: {} as CryptoKey,
        keyRef: 'test-key-ref',
      }),
    ).rejects.toBeDefined();

    expect(reportSpy).toHaveBeenCalled();
    expect(globalThis.$onekeySystemDiskIsFull).toBe(true);
  });
});
