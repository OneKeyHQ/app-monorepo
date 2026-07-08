import { IDBFactory } from 'fake-indexeddb';

import { OneKeyLocalError } from '../../errors';
import { EAppEventBusNames, appEventBus } from '../../eventBus/appEventBus';
import appStorage from '../appStorage';
import secureStorageInstance from '../instance/secureStorageInstance';

import {
  SUPABASE_SEALED_VALUE_PREFIX,
  buildSupabaseSealedValueCodec,
} from './sealedValueCodec';
import { SupabaseStorage } from './SupabaseStorage';

jest.mock('../appStorage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('../instance/secureStorageInstance', () => ({
  __esModule: true,
  default: {
    getSecureItem: jest.fn(),
    setSecureItem: jest.fn(),
    removeSecureItem: jest.fn(),
    supportSecureStorageWithoutInteraction: jest.fn(),
  },
}));

jest.mock('../../platformEnv', () => ({
  __esModule: true,
  ERuntimeRole: {
    Main: 'main',
    Background: 'background',
    Standalone: 'standalone',
  },
  default: {
    isNative: false,
    isDesktop: false,
    isDev: false,
    // Standalone = single web/desktop runtime; owns session writes, so the
    // legacy plaintext -> sealed opportunistic rewrite is active.
    runtimeRole: 'standalone',
  },
}));

const mockAppStorage = jest.mocked(appStorage);
const mockSecureStorageInstance = jest.mocked(secureStorageInstance);

const PREFIXED_SESSION_KEY = 'OneKeySupabaseAuth__session';

let testDbNameSeq = 0;

function buildTestCodec({
  cryptoGlobal,
  indexedDBInstance = new IDBFactory(),
}: {
  cryptoGlobal?: Crypto | null;
  indexedDBInstance?: IDBFactory | null;
} = {}) {
  return buildSupabaseSealedValueCodec({
    cryptoGlobal,
    dbName: `test-supabase-sealed-${(testDbNameSeq += 1)}`,
    indexedDBInstance,
  });
}

function useInMemoryAppStorage() {
  const backing = new Map<string, string>();
  mockAppStorage.getItem.mockImplementation(
    async (key: string) => backing.get(key) ?? null,
  );
  mockAppStorage.setItem.mockImplementation(
    async (key: string, value: string) => {
      backing.set(key, value);
    },
  );
  mockAppStorage.removeItem.mockImplementation(async (key: string) => {
    backing.delete(key);
  });
  return backing;
}

async function waitFor(check: () => boolean, timeoutMs = 2000) {
  const startedAt = Date.now();
  while (!check()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new OneKeyLocalError('waitFor timeout');
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
  }
}

describe('SupabaseStorage', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSecureStorageInstance.supportSecureStorageWithoutInteraction.mockResolvedValue(
      false,
    );
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('clears local inflight cache before setItem retries a write', async () => {
    const storage = new SupabaseStorage({
      // WebCrypto disabled: keep this cache-behavior test on the plaintext
      // path, matching its original assertions.
      sealedValueCodec: buildTestCodec({ cryptoGlobal: null }),
    });
    const emitSpy = jest.spyOn(appEventBus, 'emit');
    mockAppStorage.getItem
      .mockResolvedValueOnce('stale')
      .mockResolvedValueOnce('fresh');
    mockAppStorage.setItem.mockRejectedValueOnce(new Error('write failed'));

    await expect(storage.getItem('session')).resolves.toBe('stale');
    await expect(storage.setItem('session', 'next')).rejects.toThrow(
      'write failed',
    );
    await expect(storage.getItem('session')).resolves.toBe('fresh');

    expect(mockAppStorage.getItem).toHaveBeenCalledTimes(2);
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.SupabaseStorageCacheCleared,
      expect.anything(),
    );
  });

  it('clears local inflight cache before removeItem retries a write', async () => {
    const storage = new SupabaseStorage({
      sealedValueCodec: buildTestCodec({ cryptoGlobal: null }),
    });
    const emitSpy = jest.spyOn(appEventBus, 'emit');
    mockAppStorage.getItem
      .mockResolvedValueOnce('stale')
      .mockResolvedValueOnce('fresh');
    mockAppStorage.removeItem.mockRejectedValueOnce(new Error('remove failed'));

    await expect(storage.getItem('session')).resolves.toBe('stale');
    await expect(storage.removeItem('session')).rejects.toThrow(
      'remove failed',
    );
    await expect(storage.getItem('session')).resolves.toBe('fresh');

    expect(mockAppStorage.getItem).toHaveBeenCalledTimes(2);
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.SupabaseStorageCacheCleared,
      expect.anything(),
    );
  });

  describe('device-key sealing (non-secure-storage fallback path)', () => {
    const sessionValue = JSON.stringify({
      access_token: 'secret-access-token',
      refresh_token: 'secret-refresh-token',
    });

    it('seals on write and round-trips through the sealed envelope', async () => {
      const backing = useInMemoryAppStorage();
      const codec = buildTestCodec();
      const storage = new SupabaseStorage({ sealedValueCodec: codec });

      await storage.setItem('session', sessionValue);

      const storedValue = backing.get(PREFIXED_SESSION_KEY);
      expect(storedValue).toBeDefined();
      expect(storedValue?.startsWith(SUPABASE_SEALED_VALUE_PREFIX)).toBe(true);
      expect(storedValue).not.toContain('secret-access-token');
      expect(storedValue).not.toContain('secret-refresh-token');

      await expect(storage.getItem('session')).resolves.toBe(sessionValue);

      // A fresh instance (fresh read cache) decrypts the persisted envelope.
      const storage2 = new SupabaseStorage({ sealedValueCodec: codec });
      await expect(storage2.getItem('session')).resolves.toBe(sessionValue);
    });

    it('uses a fresh random IV per write', async () => {
      const backing = useInMemoryAppStorage();
      const codec = buildTestCodec();
      const storage = new SupabaseStorage({ sealedValueCodec: codec });

      await storage.setItem('session', sessionValue);
      const firstValue = backing.get(PREFIXED_SESSION_KEY);
      await storage.setItem('session', sessionValue);
      const secondValue = backing.get(PREFIXED_SESSION_KEY);

      expect(firstValue).toBeDefined();
      expect(secondValue).toBeDefined();
      expect(firstValue).not.toBe(secondValue);
    });

    it('returns legacy plaintext values and opportunistically rewrites them sealed', async () => {
      const backing = useInMemoryAppStorage();
      backing.set(PREFIXED_SESSION_KEY, sessionValue);
      const codec = buildTestCodec();
      const storage = new SupabaseStorage({ sealedValueCodec: codec });

      await expect(storage.getItem('session')).resolves.toBe(sessionValue);

      // The rewrite is fire-and-forget; wait until it lands.
      await waitFor(() =>
        Boolean(
          backing
            .get(PREFIXED_SESSION_KEY)
            ?.startsWith(SUPABASE_SEALED_VALUE_PREFIX),
        ),
      );
      expect(backing.get(PREFIXED_SESSION_KEY)).not.toContain(
        'secret-access-token',
      );

      // The rewritten sealed value still decrypts to the same session.
      storage.clearCache({ syncRemote: false });
      await expect(storage.getItem('session')).resolves.toBe(sessionValue);
    });

    it('falls back to plaintext storage when WebCrypto is unavailable', async () => {
      const backing = useInMemoryAppStorage();
      const storage = new SupabaseStorage({
        sealedValueCodec: buildTestCodec({ cryptoGlobal: null }),
      });

      await storage.setItem('session', sessionValue);

      expect(backing.get(PREFIXED_SESSION_KEY)).toBe(sessionValue);
      await expect(storage.getItem('session')).resolves.toBe(sessionValue);
    });

    it('falls back to plaintext storage when IndexedDB is unavailable', async () => {
      const backing = useInMemoryAppStorage();
      const storage = new SupabaseStorage({
        sealedValueCodec: buildTestCodec({ indexedDBInstance: null }),
      });

      await storage.setItem('session', sessionValue);

      expect(backing.get(PREFIXED_SESSION_KEY)).toBe(sessionValue);
      await expect(storage.getItem('session')).resolves.toBe(sessionValue);
    });

    it('returns null (session lost) when the sealed envelope cannot be decrypted', async () => {
      const backing = useInMemoryAppStorage();
      const codecA = buildTestCodec();
      const storageA = new SupabaseStorage({ sealedValueCodec: codecA });
      await storageA.setItem('session', sessionValue);
      expect(
        backing
          .get(PREFIXED_SESSION_KEY)
          ?.startsWith(SUPABASE_SEALED_VALUE_PREFIX),
      ).toBe(true);

      // Fresh IndexedDB = device key lost (e.g. browser cleared site data):
      // a different key is generated and decryption genuinely fails.
      const codecB = buildTestCodec();
      const storageB = new SupabaseStorage({ sealedValueCodec: codecB });
      await expect(storageB.getItem('session')).resolves.toBeNull();
    });

    it('returns null for a recognized but corrupt envelope instead of leaking it as plaintext', async () => {
      const backing = useInMemoryAppStorage();
      backing.set(
        PREFIXED_SESSION_KEY,
        `${SUPABASE_SEALED_VALUE_PREFIX}not-json`,
      );
      const storage = new SupabaseStorage({
        sealedValueCodec: buildTestCodec(),
      });

      await expect(storage.getItem('session')).resolves.toBeNull();
    });
  });
});
