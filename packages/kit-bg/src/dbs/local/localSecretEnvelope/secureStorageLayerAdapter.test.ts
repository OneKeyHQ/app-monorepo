import {
  parseLocalSecretEnvelopeV1,
  unwrapLocalSecretEnvelopeV1,
  wrapLocalSecretEnvelopeV1,
} from '.';

import { LocalSecretEnvelopeUnavailable } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ISecureStorage } from '@onekeyhq/shared/src/storage/secureStorage/types';

import { buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter } from './mmkvProfileKeyLayerAdapter';
import {
  DEFAULT_SECURE_STORAGE_LSE_GLOBAL_KEY_REF,
  buildSecureStorageLocalSecretEnvelopeLayerAdapter,
  getSecureStorageLocalSecretEnvelopeLayerAvailability,
  isSecureStorageLocalSecretEnvelopeLayerAvailable,
} from './secureStorageLayerAdapter';

// expo-secure-store (native OS secure storage) only accepts keys matching this
// charset; a disallowed char (e.g. ":") makes it throw, the probe swallows the
// error, and the whole secure-storage layer silently disappears on iOS/Android.
const EXPO_SECURE_STORE_ALLOWED_KEY = /^[A-Za-z0-9._-]+$/;

describe('secure-storage LSE keyRef charset (native compatibility)', () => {
  it('global keyRef stays within expo-secure-store allowed charset', () => {
    expect(DEFAULT_SECURE_STORAGE_LSE_GLOBAL_KEY_REF).toMatch(
      EXPO_SECURE_STORE_ALLOWED_KEY,
    );
  });

  it('keyRef produced by prepareLayer stays within the allowed charset', async () => {
    const adapter = buildSecureStorageLocalSecretEnvelopeLayerAdapter({
      secureStorage: {
        getSecureItem: async () => null,
        removeSecureItem: async () => undefined,
        setSecureItem: async () => undefined,
        supportSecureStorage: async () => true,
        supportSecureStorageWithoutInteraction: async () => true,
      },
    });
    const layer = await adapter.prepareLayer({
      dataType: 'credential',
      layerIndex: 0,
      recordId: 'hd-1',
    });
    expect(layer.keyRef).toMatch(EXPO_SECURE_STORE_ALLOWED_KEY);
  });
});

type ISecureStorageForTest = Pick<
  ISecureStorage,
  | 'getSecureItem'
  | 'removeSecureItem'
  | 'setSecureItem'
  | 'supportSecureStorage'
  | 'supportSecureStorageWithoutInteraction'
>;

function buildDeterministicRandomBytes(): (length: number) => Uint8Array {
  let offset = 1;
  return (length: number) => {
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index += 1) {
      bytes[index] = (offset + index) % 256;
    }
    offset += length;
    return bytes;
  };
}

function buildDeferred<TValue = void>(): {
  promise: Promise<TValue>;
  resolve: (value: TValue) => void;
} {
  let resolve: (value: TValue) => void = () => undefined;
  const promise = new Promise<TValue>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function flushPromises(times = 5): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
}

function buildMemorySecureStorage({
  persistWrites = true,
  setDelay,
  supported = true,
}: {
  persistWrites?: boolean;
  setDelay?: Promise<void>;
  supported?: boolean;
} = {}): {
  calls: {
    get: number;
    remove: number;
    set: number;
    support: number;
  };
  records: Map<string, string>;
  secureStorage: ISecureStorageForTest;
} {
  const calls = {
    get: 0,
    remove: 0,
    set: 0,
    support: 0,
  };
  const records = new Map<string, string>();
  return {
    calls,
    records,
    secureStorage: {
      getSecureItem: async (key) => {
        calls.get += 1;
        return records.get(key) ?? null;
      },
      removeSecureItem: async (key) => {
        calls.remove += 1;
        records.delete(key);
      },
      setSecureItem: async (key, value) => {
        calls.set += 1;
        if (persistWrites) {
          records.set(key, value);
        }
        if (setDelay) {
          await setDelay;
        }
      },
      supportSecureStorage: async () => {
        calls.support += 1;
        return supported;
      },
      supportSecureStorageWithoutInteraction: async () => {
        calls.support += 1;
        return supported;
      },
    },
  };
}

describe('buildSecureStorageLocalSecretEnvelopeLayerAdapter', () => {
  it.each([false, true])(
    'distinguishes an unreadable Android entry from an absent entry (profile key: %s)',
    async (withProfileKey) => {
      const { calls, records, secureStorage } = buildMemorySecureStorage();
      const profileRecords = new Map<string, string>();
      const profileAdapter = buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter(
        {
          keyStorage: {
            getItem: async (key) => profileRecords.get(key) ?? null,
            setItem: async (key, value) => {
              profileRecords.set(key, value);
            },
            removeItem: async (key) => {
              profileRecords.delete(key);
            },
          },
        },
      );
      let keyReadable = true;
      const adapter = buildSecureStorageLocalSecretEnvelopeLayerAdapter({
        secureStorage: {
          ...secureStorage,
          getSecureItem: (key) =>
            keyReadable
              ? secureStorage.getSecureItem(key)
              : Promise.resolve(null),
          hasStoredSecureItem: async (key) => records.has(key),
        },
      });
      const envelope = await wrapLocalSecretEnvelopeV1({
        dataType: 'credential',
        layerAdapters: withProfileKey ? [profileAdapter, adapter] : [adapter],
        plaintext: '|RP|test-payload',
        recordId: 'hd-1',
        strength: 'secure-storage-bound',
      });
      const writesBeforeRead = calls.set;
      const unwrap = () =>
        unwrapLocalSecretEnvelopeV1({
          envelope,
          resolveLayerAdapter: ({ kind }) =>
            kind === profileAdapter.kind ? profileAdapter : adapter,
        });
      const androidEnv = jest.replaceProperty(
        platformEnv,
        'isNativeAndroid',
        true,
      );
      try {
        keyReadable = false;
        await expect(unwrap()).rejects.toThrow('wrapping key unavailable');
        await expect(unwrap()).rejects.not.toHaveProperty(
          'data.localSecretEnvelopeFailureReason',
        );
        expect(calls.set).toBe(writesBeforeRead);
        expect(calls.remove).toBe(0);
        expect(records.has(DEFAULT_SECURE_STORAGE_LSE_GLOBAL_KEY_REF)).toBe(
          true,
        );

        keyReadable = true;
        await expect(unwrap()).resolves.toBe('|RP|test-payload');
        records.delete(DEFAULT_SECURE_STORAGE_LSE_GLOBAL_KEY_REF);
        await expect(unwrap()).rejects.toHaveProperty(
          'data.localSecretEnvelopeFailureReason',
          'key-missing',
        );
      } finally {
        androidEnv.restore();
      }
    },
  );

  it('classifies migrated Android entries as permanent failure when KeyStore is operational even if MMKV profile key was also migrated', async () => {
    const { calls, records, secureStorage } = buildMemorySecureStorage();
    const profileRecords = new Map<string, string>();
    const profileAdapter = buildMmkvProfileKeyLocalSecretEnvelopeLayerAdapter({
      keyStorage: {
        getItem: async (key) => profileRecords.get(key) ?? null,
        setItem: async (key, value) => {
          profileRecords.set(key, value);
        },
        removeItem: async (key) => {
          profileRecords.delete(key);
        },
      },
    });
    let keyReadable = true;
    const verifySecureStorageOperational = jest.fn(async () => true);
    const adapter = buildSecureStorageLocalSecretEnvelopeLayerAdapter({
      secureStorage: {
        ...secureStorage,
        getSecureItem: (key) =>
          keyReadable
            ? secureStorage.getSecureItem(key)
            : Promise.resolve(null),
        hasStoredSecureItem: async (key) => records.has(key),
        verifySecureStorageOperational,
      },
    });
    const envelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [profileAdapter, adapter],
      plaintext: '|RP|migrated-android-payload',
      recordId: 'hd-1',
      strength: 'secure-storage-bound',
    });
    const writesBeforeRead = calls.set;
    const androidEnv = jest.replaceProperty(
      platformEnv,
      'isNativeAndroid',
      true,
    );
    try {
      // Simulate OEM phone migration: SharedPreferences entry and MMKV profile
      // key are both present on the new phone, AndroidKeyStore is healthy, but
      // the old device's KeyStore alias is missing/mismatched so getSecureItem
      // returns null.
      keyReadable = false;
      await expect(
        unwrapLocalSecretEnvelopeV1({
          envelope,
          resolveLayerAdapter: ({ kind }) =>
            kind === profileAdapter.kind ? profileAdapter : adapter,
        }),
      ).rejects.toHaveProperty(
        'data.localSecretEnvelopeFailureReason',
        'authentication-failed',
      );
      expect(verifySecureStorageOperational).toHaveBeenCalledTimes(1);
      // Must remain non-destructive to the stored SharedPreferences entry.
      expect(calls.set).toBe(writesBeforeRead);
      expect(calls.remove).toBe(0);
      expect(records.has(DEFAULT_SECURE_STORAGE_LSE_GLOBAL_KEY_REF)).toBe(true);
    } finally {
      androidEnv.restore();
    }
  });

  it('recovers when a migrated-looking Android read succeeds on re-read after KeyStore warmup', async () => {
    const { records, secureStorage } = buildMemorySecureStorage();
    let readCount = 0;
    const adapter = buildSecureStorageLocalSecretEnvelopeLayerAdapter({
      secureStorage: {
        ...secureStorage,
        getSecureItem: async (key) => {
          readCount += 1;
          if (readCount === 1) {
            return null;
          }
          return secureStorage.getSecureItem(key);
        },
        hasStoredSecureItem: async (key) => records.has(key),
        verifySecureStorageOperational: async () => true,
      },
    });
    const envelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [adapter],
      plaintext: '|RP|warmup-recovered',
      recordId: 'hd-1',
      strength: 'secure-storage-bound',
    });
    readCount = 0;
    const androidEnv = jest.replaceProperty(
      platformEnv,
      'isNativeAndroid',
      true,
    );
    try {
      await expect(
        unwrapLocalSecretEnvelopeV1({
          envelope,
          resolveLayerAdapter: () => adapter,
        }),
      ).resolves.toBe('|RP|warmup-recovered');
      expect(readCount).toBe(2);
    } finally {
      androidEnv.restore();
    }
  });

  it('keeps Android reads retryable when hasStoredSecureItem returns undefined', async () => {
    const { secureStorage } = buildMemorySecureStorage();
    const verifyOperational = jest.fn(async () => true);
    const adapter = buildSecureStorageLocalSecretEnvelopeLayerAdapter({
      secureStorage: {
        ...secureStorage,
        hasStoredSecureItem: async () => undefined,
        verifySecureStorageOperational: verifyOperational,
      },
    });
    const envelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [adapter],
      plaintext: '|RP|unknown-presence',
      recordId: 'hd-1',
      strength: 'secure-storage-bound',
    });
    const readAdapter = buildSecureStorageLocalSecretEnvelopeLayerAdapter({
      secureStorage: {
        ...secureStorage,
        getSecureItem: async () => null,
        hasStoredSecureItem: async () => undefined,
        verifySecureStorageOperational: verifyOperational,
      },
    });
    const androidEnv = jest.replaceProperty(
      platformEnv,
      'isNativeAndroid',
      true,
    );
    try {
      const error = await unwrapLocalSecretEnvelopeV1({
        envelope,
        resolveLayerAdapter: () => readAdapter,
      }).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(LocalSecretEnvelopeUnavailable);
      expect(
        (
          error as LocalSecretEnvelopeUnavailable & {
            data?: { localSecretEnvelopeFailureReason?: string };
          }
        ).data?.localSecretEnvelopeFailureReason,
      ).toBeUndefined();
      expect(verifyOperational).not.toHaveBeenCalled();
    } finally {
      androidEnv.restore();
    }
  });

  it('uses one stable secureStorage key for multiple envelopes', async () => {
    const { records, secureStorage } = buildMemorySecureStorage();
    const keyRef = 'test:lse:secure-storage:global-key';
    const adapter = buildSecureStorageLocalSecretEnvelopeLayerAdapter({
      keyRef,
      randomBytes: buildDeterministicRandomBytes(),
      secureStorage,
    });

    const firstEnvelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [adapter],
      plaintext: '|RP|current-kdf-payload-1',
      recordId: 'hd-1',
      strength: 'secure-storage-bound',
    });
    const secondEnvelope = await wrapLocalSecretEnvelopeV1({
      dataType: 'credential',
      layerAdapters: [adapter],
      plaintext: '|PK|current-kdf-payload-2',
      recordId: 'imported--evm--address',
      strength: 'secure-storage-bound',
    });

    const firstParsed = parseLocalSecretEnvelopeV1(firstEnvelope);
    const secondParsed = parseLocalSecretEnvelopeV1(secondEnvelope);

    expect(firstParsed.wrappingLayers[0].keyRef).toBe(keyRef);
    expect(secondParsed.wrappingLayers[0].keyRef).toBe(keyRef);
    expect(records.size).toBe(1);
    expect(records.get(keyRef)?.length).toBe(64);

    await expect(
      unwrapLocalSecretEnvelopeV1({
        envelope: firstEnvelope,
        expectedDataType: 'credential',
        expectedRecordId: 'hd-1',
        resolveLayerAdapter: () => adapter,
      }),
    ).resolves.toBe('|RP|current-kdf-payload-1');
    await expect(
      unwrapLocalSecretEnvelopeV1({
        envelope: secondEnvelope,
        expectedDataType: 'credential',
        expectedRecordId: 'imported--evm--address',
        resolveLayerAdapter: () => adapter,
      }),
    ).resolves.toBe('|PK|current-kdf-payload-2');
  });

  it('does not expose per-record key cleanup for the stable global key', async () => {
    const { records, secureStorage } = buildMemorySecureStorage();
    const keyRef = 'test:lse:secure-storage:global-cleanup';
    const adapter = buildSecureStorageLocalSecretEnvelopeLayerAdapter({
      keyRef,
      secureStorage,
    });

    records.set(keyRef, '11'.repeat(32));

    expect(adapter.deleteLayerKey).toBeUndefined();
    expect(records.has(keyRef)).toBe(true);
  });
});

describe('isSecureStorageLocalSecretEnvelopeLayerAvailable', () => {
  it('returns available only after a real secureStorage layer round trip', async () => {
    const { calls, records, secureStorage } = buildMemorySecureStorage();

    await expect(
      isSecureStorageLocalSecretEnvelopeLayerAvailable({
        keyRef: 'test:lse:secure-storage:probe',
        maxAttempts: 1,
        randomBytes: buildDeterministicRandomBytes(),
        secureStorage,
      }),
    ).resolves.toBe(true);

    expect(calls.set).toBe(1);
    expect(calls.get).toBe(4);
    expect(calls.remove).toBe(1);
    expect(records.size).toBe(0);
  });

  it('caches a successful probe for the current session', async () => {
    const { calls, secureStorage } = buildMemorySecureStorage();
    const params = {
      keyRef: 'test:lse:secure-storage:probe:success-cache',
      randomBytes: buildDeterministicRandomBytes(),
      secureStorage,
    };

    await expect(
      isSecureStorageLocalSecretEnvelopeLayerAvailable(params),
    ).resolves.toBe(true);
    await expect(
      isSecureStorageLocalSecretEnvelopeLayerAvailable(params),
    ).resolves.toBe(true);

    expect(calls.set).toBe(1);
    expect(calls.get).toBe(4);
    expect(calls.remove).toBe(1);
  });

  it('deduplicates concurrent probes against the same secureStorage backend', async () => {
    const setGate = buildDeferred();
    const { calls, secureStorage } = buildMemorySecureStorage({
      setDelay: setGate.promise,
    });
    const params = {
      keyRef: 'test:lse:secure-storage:probe:in-flight',
      probeTimeoutMs: 1000,
      randomBytes: buildDeterministicRandomBytes(),
      secureStorage,
    };

    const firstProbe = isSecureStorageLocalSecretEnvelopeLayerAvailable(params);
    const secondProbe =
      isSecureStorageLocalSecretEnvelopeLayerAvailable(params);

    await flushPromises();

    setGate.resolve(undefined);

    await expect(Promise.all([firstProbe, secondProbe])).resolves.toEqual([
      true,
      true,
    ]);
    expect(calls.set).toBe(1);
    expect(calls.get).toBe(4);
    expect(calls.remove).toBe(1);
  });

  it('times out a hanging probe and briefly caches the failure', async () => {
    const nowState = { value: 1000 };
    const hangingSet = new Promise<void>(() => {});
    const { calls, records, secureStorage } = buildMemorySecureStorage({
      setDelay: hangingSet,
    });
    const params = {
      failureCacheTtlMs: 1000,
      keyRef: 'test:lse:secure-storage:probe:timeout',
      maxAttempts: 1,
      now: () => nowState.value,
      probeTimeoutMs: 1,
      randomBytes: buildDeterministicRandomBytes(),
      secureStorage,
    };

    await expect(
      isSecureStorageLocalSecretEnvelopeLayerAvailable(params),
    ).resolves.toBe(false);
    await expect(
      isSecureStorageLocalSecretEnvelopeLayerAvailable(params),
    ).resolves.toBe(false);

    expect(calls.set).toBe(1);
    expect(calls.remove).toBe(1);
    expect(records.size).toBe(0);
  });

  it('returns unavailable without writing when secureStorage support check fails', async () => {
    const { calls, records, secureStorage } = buildMemorySecureStorage({
      supported: false,
    });

    await expect(
      isSecureStorageLocalSecretEnvelopeLayerAvailable({
        keyRef: 'test:lse:secure-storage:probe',
        maxAttempts: 1,
        randomBytes: buildDeterministicRandomBytes(),
        secureStorage,
      }),
    ).resolves.toBe(false);

    expect(calls.set).toBe(0);
    expect(calls.get).toBe(0);
    expect(calls.remove).toBe(0);
    expect(records.size).toBe(0);
  });

  it('returns unavailable when secureStorage silently fails to persist the wrapping key', async () => {
    const { calls, records, secureStorage } = buildMemorySecureStorage({
      persistWrites: false,
    });

    await expect(
      isSecureStorageLocalSecretEnvelopeLayerAvailable({
        keyRef: 'test:lse:secure-storage:probe',
        maxAttempts: 1,
        randomBytes: buildDeterministicRandomBytes(),
        secureStorage,
      }),
    ).resolves.toBe(false);

    expect(calls.set).toBe(1);
    expect(calls.get).toBe(3);
    expect(calls.remove).toBe(1);
    expect(records.size).toBe(0);
  });

  it('classifies a stable support rejection as unsupported without retrying', async () => {
    const { calls, secureStorage } = buildMemorySecureStorage({
      supported: false,
    });

    await expect(
      getSecureStorageLocalSecretEnvelopeLayerAvailability({
        keyRef: 'test:lse:secure-storage:probe:unsupported-state',
        maxAttempts: 3,
        retryDelaysMs: [0, 0],
        secureStorage,
      }),
    ).resolves.toBe('unsupported');

    expect(calls.support).toBe(1);
    expect(calls.set).toBe(0);
  });

  it('stops after three transient failures and caches the temporary outage', async () => {
    const { calls, secureStorage } = buildMemorySecureStorage({
      persistWrites: false,
    });
    const params = {
      failureCacheTtlMs: 1000,
      keyRef: 'test:lse:secure-storage:probe:bounded-retry',
      maxAttempts: 3,
      randomBytes: buildDeterministicRandomBytes(),
      retryDelaysMs: [0, 0],
      secureStorage,
    };

    await expect(
      getSecureStorageLocalSecretEnvelopeLayerAvailability(params),
    ).resolves.toBe('temporarily-unavailable');
    await expect(
      getSecureStorageLocalSecretEnvelopeLayerAvailability(params),
    ).resolves.toBe('temporarily-unavailable');

    expect(calls.set).toBe(3);
    expect(calls.remove).toBe(3);
  });
});
