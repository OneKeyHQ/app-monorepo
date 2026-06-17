import {
  parseLocalSecretEnvelopeV1,
  unwrapLocalSecretEnvelopeV1,
  wrapLocalSecretEnvelopeV1,
} from '.';

import type { ISecureStorage } from '@onekeyhq/shared/src/storage/secureStorage/types';

import {
  DEFAULT_SECURE_STORAGE_LSE_GLOBAL_KEY_REF,
  buildSecureStorageLocalSecretEnvelopeLayerAdapter,
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
        randomBytes: buildDeterministicRandomBytes(),
        secureStorage,
      }),
    ).resolves.toBe(false);

    expect(calls.set).toBe(1);
    expect(calls.get).toBe(3);
    expect(calls.remove).toBe(1);
    expect(records.size).toBe(0);
  });
});
