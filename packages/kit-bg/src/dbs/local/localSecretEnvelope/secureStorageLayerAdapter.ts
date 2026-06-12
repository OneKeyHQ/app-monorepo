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

const DEFAULT_SECURE_STORAGE_LSE_KEY_REF_PREFIX =
  'onekey:lse:secure-storage:v1';
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
  keyRefPrefix?: string;
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
  keyRefPrefix = DEFAULT_SECURE_STORAGE_LSE_KEY_REF_PREFIX,
  randomBytes,
  secureStorage = secureStorageInstance,
}: IBuildSecureStorageLocalSecretEnvelopeLayerAdapterParams = {}): ILocalSecretEnvelopeLayerAdapter {
  return buildLocalSecretEnvelopeAesGcmLayerAdapter({
    capabilities,
    keyRefPrefix,
    kind: 'secure-storage',
    randomBytes,
    keyStorage: {
      getItem: (keyRef) => secureStorage.getSecureItem(keyRef),
      removeItem: (keyRef) => secureStorage.removeSecureItem(keyRef),
      setItem: (keyRef, keyHex) => secureStorage.setSecureItem(keyRef, keyHex),
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
  keyRefPrefix = `${DEFAULT_SECURE_STORAGE_LSE_KEY_REF_PREFIX}:probe`,
  randomBytes,
  secureStorage = secureStorageInstance,
  state,
}: {
  keyRefPrefix?: string;
  randomBytes?: (length: number) => Uint8Array;
  secureStorage?: ISecureStorageLocalSecretEnvelopeStorage;
  state: {
    keyRef?: string;
  };
}): Promise<boolean> {
  let keyRef: string | undefined;
  try {
    const adapter = buildSecureStorageLocalSecretEnvelopeLayerAdapter({
      keyRefPrefix,
      randomBytes,
      secureStorage,
    });
    const dataType = 'verify-string';
    const layer = await adapter.prepareLayer({
      dataType,
      layerIndex: 0,
      recordId: SECURE_STORAGE_LSE_PROBE_RECORD_ID,
    });
    keyRef = layer.keyRef;
    state.keyRef = keyRef;
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
    cleanupSecureStorageProbeKey({ keyRef, secureStorage });
  }
}

export async function isSecureStorageLocalSecretEnvelopeLayerAvailable({
  failureCacheTtlMs = SECURE_STORAGE_LSE_FAILURE_CACHE_TTL_MS,
  keyRefPrefix = `${DEFAULT_SECURE_STORAGE_LSE_KEY_REF_PREFIX}:probe`,
  now = () => Date.now(),
  probeTimeoutMs = DEFAULT_SECURE_STORAGE_LSE_PROBE_TIMEOUT_MS,
  randomBytes,
  secureStorage = secureStorageInstance,
}: {
  failureCacheTtlMs?: number;
  keyRefPrefix?: string;
  now?: () => number;
  probeTimeoutMs?: number;
  randomBytes?: (length: number) => Uint8Array;
  secureStorage?: ISecureStorageLocalSecretEnvelopeStorage;
} = {}): Promise<boolean> {
  const entry = getSecureStorageProbeCacheEntry({
    cacheKey: keyRefPrefix,
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
      keyRefPrefix,
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
