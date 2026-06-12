import type { ISecureStorage } from '@onekeyhq/shared/src/storage/secureStorage/types';

import { isSecureStorageLocalSecretEnvelopeLayerAvailable } from './secureStorageLayerAdapter';

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

describe('isSecureStorageLocalSecretEnvelopeLayerAvailable', () => {
  it('returns available only after a real secureStorage layer round trip', async () => {
    const { calls, records, secureStorage } = buildMemorySecureStorage();

    await expect(
      isSecureStorageLocalSecretEnvelopeLayerAvailable({
        keyRefPrefix: 'test:lse:secure-storage:probe',
        randomBytes: buildDeterministicRandomBytes(),
        secureStorage,
      }),
    ).resolves.toBe(true);

    expect(calls.set).toBe(1);
    expect(calls.get).toBe(2);
    expect(calls.remove).toBe(1);
    expect(records.size).toBe(0);
  });

  it('caches a successful probe for the current session', async () => {
    const { calls, secureStorage } = buildMemorySecureStorage();
    const params = {
      keyRefPrefix: 'test:lse:secure-storage:probe:success-cache',
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
    expect(calls.get).toBe(2);
    expect(calls.remove).toBe(1);
  });

  it('deduplicates concurrent probes against the same secureStorage backend', async () => {
    const setGate = buildDeferred();
    const { calls, secureStorage } = buildMemorySecureStorage({
      setDelay: setGate.promise,
    });
    const params = {
      keyRefPrefix: 'test:lse:secure-storage:probe:in-flight',
      probeTimeoutMs: 1000,
      randomBytes: buildDeterministicRandomBytes(),
      secureStorage,
    };

    const firstProbe = isSecureStorageLocalSecretEnvelopeLayerAvailable(params);
    const secondProbe =
      isSecureStorageLocalSecretEnvelopeLayerAvailable(params);

    await flushPromises();
    expect(calls.set).toBe(1);

    setGate.resolve(undefined);

    await expect(Promise.all([firstProbe, secondProbe])).resolves.toEqual([
      true,
      true,
    ]);
    expect(calls.set).toBe(1);
    expect(calls.get).toBe(2);
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
      keyRefPrefix: 'test:lse:secure-storage:probe:timeout',
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
        keyRefPrefix: 'test:lse:secure-storage:probe',
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
        keyRefPrefix: 'test:lse:secure-storage:probe',
        randomBytes: buildDeterministicRandomBytes(),
        secureStorage,
      }),
    ).resolves.toBe(false);

    expect(calls.set).toBe(1);
    expect(calls.get).toBe(2);
    expect(calls.remove).toBe(1);
    expect(records.size).toBe(0);
  });
});
