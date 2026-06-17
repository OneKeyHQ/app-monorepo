import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import secureStorageInstance from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';
import type { ISecureStorage } from '@onekeyhq/shared/src/storage/secureStorage/types';

import { buildLocalSecretEnvelopeAesGcmLayerAdapter } from './aesGcmLayerAdapter';
import {
  buildLocalSecretEnvelopeAadV1,
  buildLocalSecretEnvelopeProtectedHeaderV1,
} from './parser';

import type {
  ILocalSecretEnvelopeLayerAdapter,
  ILocalSecretEnvelopeLayerCapabilities,
} from './types';

// IMPORTANT: this key reaches the OS secure storage. The binding constraint is
// expo-secure-store (native iOS + Android share the same JS check), whose key
// must match ^[\w.-]+$ i.e. [A-Za-z0-9_.-]; a ":" makes it throw "Invalid key
// provided to SecureStore", the probe swallows that error and returns false, so
// the whole secure-storage layer silently disappears and LSE migration never
// runs on native. Desktop (Electron safeStorage) stores this only as a plain
// JSON object key (the OS keychain holds just safeStorage's master key), so it
// has no charset limit. "_" / "-" / "." are therefore all safe everywhere; we
// use "_" as the most unambiguous separator.
export const DEFAULT_SECURE_STORAGE_LSE_GLOBAL_KEY_REF =
  'onekey_lse_secure_storage_v1';
const DEFAULT_SECURE_STORAGE_LSE_PROBE_KEY_REF = `${DEFAULT_SECURE_STORAGE_LSE_GLOBAL_KEY_REF}_probe`;
const DEFAULT_SECURE_STORAGE_LSE_PROBE_TIMEOUT_MS = 5000;
const SECURE_STORAGE_LSE_FAILURE_CACHE_TTL_MS = 30_000;
const SECURE_STORAGE_LSE_PROBE_RECORD_ID = 'secure-storage-probe';
const SECURE_STORAGE_LSE_PROBE_PLAINTEXT =
  'local-secret-envelope-secure-storage-probe';

type ISecureStorageLocalSecretEnvelopeStorage = Pick<
  ISecureStorage,
  | 'getSecureItem'
  | 'removeSecureItem'
  | 'setSecureItem'
  | 'supportSecureStorage'
  | 'supportSecureStorageWithoutInteraction'
>;

type IBuildSecureStorageLocalSecretEnvelopeLayerAdapterParams = {
  capabilities?: ILocalSecretEnvelopeLayerCapabilities;
  keyRef?: string;
  randomBytes?: (length: number) => Uint8Array;
  secureStorage?: ISecureStorageLocalSecretEnvelopeStorage;
};

type ISecureStorageProbeCacheEntry = {
  expiresAt: number;
  inFlight?: Promise<boolean>;
  value?: boolean;
};

const secureStorageProbeCache = new WeakMap<
  ISecureStorageLocalSecretEnvelopeStorage,
  Map<string, ISecureStorageProbeCacheEntry>
>();
const secureStorageKeyCreationLocks = new WeakMap<
  ISecureStorageLocalSecretEnvelopeStorage,
  Map<string, Promise<string>>
>();

function getSecureStorageKeyCreationLocks(
  secureStorage: ISecureStorageLocalSecretEnvelopeStorage,
): Map<string, Promise<string>> {
  let locks = secureStorageKeyCreationLocks.get(secureStorage);
  if (!locks) {
    locks = new Map();
    secureStorageKeyCreationLocks.set(secureStorage, locks);
  }
  return locks;
}

async function getOrCreateSecureStorageKeyHex({
  createKeyHex,
  keyRef,
  secureStorage,
}: {
  createKeyHex: () => string;
  keyRef: string;
  secureStorage: ISecureStorageLocalSecretEnvelopeStorage;
}): Promise<string> {
  const existingKeyHex = await secureStorage.getSecureItem(keyRef);
  if (existingKeyHex) {
    return existingKeyHex;
  }

  const locks = getSecureStorageKeyCreationLocks(secureStorage);
  const inFlight = locks.get(keyRef);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async () => {
    const existingKeyHexAfterLock = await secureStorage.getSecureItem(keyRef);
    if (existingKeyHexAfterLock) {
      return existingKeyHexAfterLock;
    }

    const keyHex = createKeyHex();
    await secureStorage.setSecureItem(keyRef, keyHex);
    const persistedKeyHex = await secureStorage.getSecureItem(keyRef);
    if (!persistedKeyHex) {
      throw new OneKeyLocalError(
        'Local secret envelope secureStorage key persist failed',
      );
    }
    return persistedKeyHex;
  })();

  locks.set(keyRef, promise);
  try {
    return await promise;
  } finally {
    if (locks.get(keyRef) === promise) {
      locks.delete(keyRef);
    }
  }
}

async function isSecureStorageSupportedWithoutInteraction(
  secureStorage: ISecureStorageLocalSecretEnvelopeStorage,
): Promise<boolean> {
  if (secureStorage.supportSecureStorageWithoutInteraction) {
    return secureStorage.supportSecureStorageWithoutInteraction();
  }
  return secureStorage.supportSecureStorage();
}

export function buildSecureStorageLocalSecretEnvelopeLayerAdapter({
  capabilities = {
    sync: 'unknown',
    extractable: 'unknown',
    keyAccess: 'raw-key-readable',
  },
  keyRef = DEFAULT_SECURE_STORAGE_LSE_GLOBAL_KEY_REF,
  randomBytes,
  secureStorage = secureStorageInstance,
}: IBuildSecureStorageLocalSecretEnvelopeLayerAdapterParams = {}): ILocalSecretEnvelopeLayerAdapter {
  return buildLocalSecretEnvelopeAesGcmLayerAdapter({
    capabilities,
    keyRef,
    kind: 'secure-storage',
    randomBytes,
    keyStorage: {
      getOrCreateItem: (storageKeyRef, createKeyHex) =>
        getOrCreateSecureStorageKeyHex({
          createKeyHex,
          keyRef: storageKeyRef,
          secureStorage,
        }),
      getItem: (storageKeyRef) => secureStorage.getSecureItem(storageKeyRef),
      setItem: (storageKeyRef, keyHex) =>
        secureStorage.setSecureItem(storageKeyRef, keyHex),
      supportStorage: () =>
        isSecureStorageSupportedWithoutInteraction(secureStorage),
    },
  });
}

function getSecureStorageProbeCacheEntry({
  cacheKey,
  secureStorage,
}: {
  cacheKey: string;
  secureStorage: ISecureStorageLocalSecretEnvelopeStorage;
}): ISecureStorageProbeCacheEntry {
  let cacheByKey = secureStorageProbeCache.get(secureStorage);
  if (!cacheByKey) {
    cacheByKey = new Map();
    secureStorageProbeCache.set(secureStorage, cacheByKey);
  }
  let entry = cacheByKey.get(cacheKey);
  if (!entry) {
    entry = { expiresAt: 0 };
    cacheByKey.set(cacheKey, entry);
  }
  return entry;
}

export function resetSecureStorageLocalSecretEnvelopeProbeCache(
  secureStorage: ISecureStorageLocalSecretEnvelopeStorage = secureStorageInstance,
): void {
  secureStorageProbeCache.delete(secureStorage);
}

function cleanupSecureStorageProbeKey({
  keyRef,
  secureStorage,
}: {
  keyRef: string | undefined;
  secureStorage: ISecureStorageLocalSecretEnvelopeStorage;
}) {
  if (!keyRef) {
    return;
  }
  void secureStorage.removeSecureItem(keyRef).catch(() => undefined);
}

function resolveWithTimeout({
  onTimeout,
  promise,
  timeoutMs,
}: {
  onTimeout: () => void;
  promise: Promise<boolean>;
  timeoutMs: number;
}): Promise<boolean> {
  if (timeoutMs <= 0) {
    onTimeout();
    return Promise.resolve(false);
  }
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      onTimeout();
      resolve(false);
    }, timeoutMs);

    promise
      .then((value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          resolve(value);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          resolve(false);
        }
      });
  });
}

async function probeSecureStorageLocalSecretEnvelopeLayer({
  keyRef: probeKeyRef = DEFAULT_SECURE_STORAGE_LSE_PROBE_KEY_REF,
  randomBytes,
  secureStorage = secureStorageInstance,
  state,
}: {
  keyRef?: string;
  randomBytes?: (length: number) => Uint8Array;
  secureStorage?: ISecureStorageLocalSecretEnvelopeStorage;
  state: {
    keyRef?: string;
  };
}): Promise<boolean> {
  let layerKeyRef: string | undefined;
  try {
    const adapter = buildSecureStorageLocalSecretEnvelopeLayerAdapter({
      keyRef: probeKeyRef,
      randomBytes,
      secureStorage,
    });
    const dataType = 'verify-string';
    const layer = await adapter.prepareLayer({
      dataType,
      layerIndex: 0,
      recordId: SECURE_STORAGE_LSE_PROBE_RECORD_ID,
    });
    layerKeyRef = layer.keyRef;
    state.keyRef = layerKeyRef;
    const protectedHeader = buildLocalSecretEnvelopeProtectedHeaderV1({
      dataType,
      recordId: SECURE_STORAGE_LSE_PROBE_RECORD_ID,
      wrappingLayers: [layer],
    });
    const aad = buildLocalSecretEnvelopeAadV1({
      dataType,
      protectedHeader,
      recordId: SECURE_STORAGE_LSE_PROBE_RECORD_ID,
    });
    const ciphertext = await adapter.encrypt({
      aad,
      dataType,
      layer,
      layerIndex: 0,
      plaintext: SECURE_STORAGE_LSE_PROBE_PLAINTEXT,
      recordId: SECURE_STORAGE_LSE_PROBE_RECORD_ID,
    });
    const plaintext = await adapter.decrypt({
      aad,
      ciphertext,
      dataType,
      layer,
      layerIndex: 0,
      recordId: SECURE_STORAGE_LSE_PROBE_RECORD_ID,
    });
    return plaintext === SECURE_STORAGE_LSE_PROBE_PLAINTEXT;
  } catch {
    return false;
  } finally {
    cleanupSecureStorageProbeKey({ keyRef: layerKeyRef, secureStorage });
  }
}

export async function isSecureStorageLocalSecretEnvelopeLayerAvailable({
  failureCacheTtlMs = SECURE_STORAGE_LSE_FAILURE_CACHE_TTL_MS,
  keyRef = DEFAULT_SECURE_STORAGE_LSE_PROBE_KEY_REF,
  now = () => Date.now(),
  probeTimeoutMs = DEFAULT_SECURE_STORAGE_LSE_PROBE_TIMEOUT_MS,
  randomBytes,
  secureStorage = secureStorageInstance,
}: {
  failureCacheTtlMs?: number;
  keyRef?: string;
  now?: () => number;
  probeTimeoutMs?: number;
  randomBytes?: (length: number) => Uint8Array;
  secureStorage?: ISecureStorageLocalSecretEnvelopeStorage;
} = {}): Promise<boolean> {
  const entry = getSecureStorageProbeCacheEntry({
    cacheKey: keyRef,
    secureStorage,
  });
  const nowMs = now();
  if (entry.value !== undefined && entry.expiresAt > nowMs) {
    return entry.value;
  }
  if (entry.inFlight) {
    return entry.inFlight;
  }

  const state: { keyRef?: string } = {};
  const probePromise = resolveWithTimeout({
    onTimeout: () =>
      cleanupSecureStorageProbeKey({
        keyRef: state.keyRef,
        secureStorage,
      }),
    promise: probeSecureStorageLocalSecretEnvelopeLayer({
      keyRef,
      randomBytes,
      secureStorage,
      state,
    }),
    timeoutMs: probeTimeoutMs,
  })
    .then((available) => {
      entry.value = available;
      entry.expiresAt = available
        ? Number.POSITIVE_INFINITY
        : now() + failureCacheTtlMs;
      return available;
    })
    .finally(() => {
      if (entry.inFlight === probePromise) {
        entry.inFlight = undefined;
      }
    });
  entry.inFlight = probePromise;
  return probePromise;
}
