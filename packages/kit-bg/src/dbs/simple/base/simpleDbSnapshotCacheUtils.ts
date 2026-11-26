import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  createNamespacedSnapshotCache,
  isValidSnapshotCacheKey,
} from '@onekeyhq/shared/src/storage/SnapshotCache';
import type {
  INamespacedSnapshotCacheConfig,
  ISnapshotCacheNamespace,
  ISnapshotCacheSync,
} from '@onekeyhq/shared/src/storage/SnapshotCache';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

const MAX_ENCODED_SUB_KEY_LENGTH = 460;
const DIGEST_MARKER = '__digest__';

function digestSubKey(value: string): string {
  let low = 0x81_1c_9d_c5;
  let high = 0x01_00_01_93;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    low = Math.imul(low ^ code, 0x01_00_01_93) >>> 0;
    high = Math.imul(high ^ (code + index), 0x85_eb_ca_6b) >>> 0;
  }
  return `${low.toString(36)}${high.toString(36)}`;
}

/**
 * Encodes an arbitrary business key into a reversible `SnapshotCache` key
 * matching `/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/` with length <= 480.
 *
 * `prefix` must start with `[A-Za-z0-9]` and typically ends with `:` (for
 * example `'acct:'`, `'single:'`, `'all:'`, `'list:'`, `'overview:'`).
 */
export function encodeSnapshotSubKey(prefix: string, rawKey: string): string {
  const escaped = rawKey.replace(
    /[^A-Za-z0-9.:/-]/g,
    (ch) => `_x${ch.charCodeAt(0).toString(16)}_`,
  );
  const candidate = `${prefix}${escaped}`;
  if (
    candidate.length <= MAX_ENCODED_SUB_KEY_LENGTH &&
    isValidSnapshotCacheKey(candidate)
  ) {
    return candidate;
  }
  return `${prefix}${DIGEST_MARKER}${digestSubKey(rawKey)}`;
}

/**
 * Decodes a key produced by `encodeSnapshotSubKey` back to the original
 * `rawKey`, or returns `undefined` if the key does not belong to `prefix`
 * (or was truncated into a one-way digest).
 */
export function decodeSnapshotSubKey(
  prefix: string,
  encodedKey: string,
): string | undefined {
  if (!encodedKey.startsWith(prefix)) {
    return undefined;
  }
  const rest = encodedKey.slice(prefix.length);
  if (rest.startsWith(DIGEST_MARKER)) {
    return undefined;
  }
  return rest.replace(/_x([0-9a-fA-F]+)_/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

const webNamespacePrimePromises = new Map<
  ISnapshotCacheNamespace,
  Promise<void>
>();

export function ensureSimpleDbSnapshotNamespaceReady(
  namespace: ISnapshotCacheNamespace,
): Promise<void> {
  if (platformEnv.isNative || typeof indexedDB === 'undefined') {
    return Promise.resolve();
  }
  let promise = webNamespacePrimePromises.get(namespace);
  if (!promise) {
    promise = (async () => {
      try {
        const { primeWebUiSnapshotStore, readWebUiSnapshotEntriesFromIdb } =
          await import('@onekeyhq/shared/src/storage/DisplaySnapshotStorage/webUiSnapshotStore');
        const entries = await readWebUiSnapshotEntriesFromIdb({
          namespaces: [namespace],
        });
        if (entries.size > 0) {
          primeWebUiSnapshotStore(entries);
        }
      } catch {
        // Best effort on non-native runtimes: a failed IDB prime degrades to
        // an ordinary cold cache miss.
      }
    })();
    webNamespacePrimePromises.set(namespace, promise);
  }
  return promise;
}

export async function isSimpleDbSnapshotPersistenceAllowed(): Promise<boolean> {
  const environment = await travelModeManager.getRuntimeEnvironment();
  return (
    environment.persistence.kind === 'real' && !environment.commands.isBlocked
  );
}

export function isEntityMethodMocked(
  entity: object,
  methodName: string,
): boolean {
  const fn: unknown = Reflect.get(entity, methodName);
  return Boolean(
    fn &&
    typeof fn === 'function' &&
    '_isMockFunction' in fn &&
    (fn as { _isMockFunction?: boolean })._isMockFunction,
  );
}

export function createSimpleDbSnapshotCache<T>(
  config: INamespacedSnapshotCacheConfig,
): ISnapshotCacheSync<T> {
  return createNamespacedSnapshotCache<T>(config);
}

export const PERP_SNAPSHOT_NAMESPACE = 'perp-cache' as const;
export const PERP_JOTAI_DISPLAY_SNAPSHOT_KEY = 'jotai-account-display-snapshot';
const PERP_SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PERP_SNAPSHOT_MAX_ENTRIES = 256;
const PERP_SNAPSHOT_MAX_RECORD_BYTES = 4 * 1024 * 1024;

export const perpSnapshotCache = createSimpleDbSnapshotCache<unknown>({
  namespace: PERP_SNAPSHOT_NAMESPACE,
  maxAgeMs: PERP_SNAPSHOT_MAX_AGE_MS,
  maxEntries: PERP_SNAPSHOT_MAX_ENTRIES,
  maxRecordBytes: PERP_SNAPSHOT_MAX_RECORD_BYTES,
});
