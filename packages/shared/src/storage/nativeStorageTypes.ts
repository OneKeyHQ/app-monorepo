export type INativeStorageScalar = string | number | boolean;

export type INativeSyncStorageName = 'settings' | 'coldStart' | 'devSettings';

export type INativeSyncStorageEntry = readonly [string, INativeStorageScalar];

export type INativeSWRCachePatchIntent = {
  clearBefore?: number;
  removePrefixes: Array<{ at: number; prefix: string }>;
  removals: Array<readonly [key: string, removedAt: number]>;
  updates: Array<readonly [key: string, serializedEntry: string]>;
};

export type INativeSWRCacheCanonicalEntry = readonly [
  key: string,
  serializedEntry: string | null,
];

export type INativeSyncStorageLocalMutation =
  | {
      operation: 'set';
      key: string;
      value: INativeStorageScalar;
    }
  | {
      operation: 'patchSWR';
      entries: INativeSWRCacheCanonicalEntry[];
    }
  | { operation: 'remove'; key: string }
  | { operation: 'clear' };

export type INativeSyncStorageMutation = INativeSyncStorageLocalMutation & {
  sourceMutationId?: number;
  store: INativeSyncStorageName;
};

export type INativeStorageBootstrapSnapshot = {
  settings: INativeSyncStorageEntry[];
  coldStart: INativeSyncStorageEntry[];
  devSettings: INativeSyncStorageEntry[];
};

export type INativeStorageMigrationRecoveryTarget = 'appStorage' | 'jotai';

const NATIVE_STORAGE_MIGRATION_INCONSISTENT_ERROR_PREFIX =
  'Native storage migration target is inconsistent:';

export function createNativeStorageMigrationInconsistentErrorMessage(
  target: INativeStorageMigrationRecoveryTarget,
) {
  const detail =
    target === 'appStorage'
      ? 'App-storage MMKV migration marker is missing after migration completed'
      : 'Jotai MMKV migration marker is missing after migration completed';
  return `${NATIVE_STORAGE_MIGRATION_INCONSISTENT_ERROR_PREFIX}${target}; ${detail}`;
}

export function getNativeStorageMigrationRecoveryTarget(
  error: unknown,
): INativeStorageMigrationRecoveryTarget | undefined {
  let message = '';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    const candidate = (error as { message?: unknown }).message;
    message = typeof candidate === 'string' ? candidate : '';
  }
  const markerIndex = message.indexOf(
    NATIVE_STORAGE_MIGRATION_INCONSISTENT_ERROR_PREFIX,
  );
  if (markerIndex < 0) {
    return undefined;
  }
  const target = message.slice(
    markerIndex + NATIVE_STORAGE_MIGRATION_INCONSISTENT_ERROR_PREFIX.length,
  );
  if (target.startsWith('appStorage')) {
    return 'appStorage';
  }
  if (target.startsWith('jotai')) {
    return 'jotai';
  }
  return undefined;
}

export type INativeStorageContractViolation = {
  apiName: string;
  id: string;
  message: string;
  runtime: 'main' | 'background';
  stack?: string;
};

export function parseNativeStorageContractViolation(
  value: unknown,
): INativeStorageContractViolation | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as Partial<INativeStorageContractViolation>;
  if (
    typeof candidate.apiName !== 'string' ||
    typeof candidate.id !== 'string' ||
    typeof candidate.message !== 'string' ||
    (candidate.runtime !== 'main' && candidate.runtime !== 'background') ||
    (candidate.stack !== undefined && typeof candidate.stack !== 'string')
  ) {
    return undefined;
  }
  return candidate as INativeStorageContractViolation;
}

export type INativeAsyncStorageRequest =
  | { scope: 'asyncStorage'; operation: 'getItem'; key: string }
  | {
      scope: 'asyncStorage';
      operation: 'setItem' | 'mergeItem';
      key: string;
      value: string;
    }
  | { scope: 'asyncStorage'; operation: 'removeItem'; key: string }
  | { scope: 'asyncStorage'; operation: 'clear' | 'getAllKeys' }
  | {
      scope: 'asyncStorage';
      operation: 'multiGet' | 'multiRemove';
      keys: string[];
    }
  | {
      scope: 'asyncStorage';
      operation: 'multiSet' | 'multiMerge';
      entries: Array<[string, string]>;
    };

export type INativeSyncStorageRequest =
  | {
      scope: 'syncStorage';
      operation: 'set';
      store: INativeSyncStorageName;
      key: string;
      sourceMutationId?: number;
      sourceRuntimeId?: string;
      value: INativeStorageScalar;
      previousValue?: INativeStorageScalar;
    }
  | {
      scope: 'syncStorage';
      operation: 'remove';
      store: INativeSyncStorageName;
      key: string;
      sourceMutationId?: number;
      sourceRuntimeId?: string;
    }
  | {
      scope: 'syncStorage';
      operation: 'clear';
      sourceMutationId?: number;
      sourceRuntimeId?: string;
      store: INativeSyncStorageName;
    }
  | {
      scope: 'syncStorage';
      operation: 'patchSWR';
      patch: INativeSWRCachePatchIntent;
      sourceMutationId?: number;
      sourceRuntimeId?: string;
      store: 'coldStart';
    };

export type INativeStorageRequest =
  | INativeAsyncStorageRequest
  | INativeSyncStorageRequest
  | {
      scope: 'recovery';
      operation: 'resetMigrationTarget';
      target: INativeStorageMigrationRecoveryTarget;
    }
  | { scope: 'bootstrap' };

export type INativeStorageCall = (
  request: INativeStorageRequest,
) => Promise<unknown>;

export const NATIVE_SYNC_STORAGE_MUTATION_EVENT =
  'onekey:native-sync-storage-mutation';

const NATIVE_SWR_PATCH_MAX_ITEMS = 600;
const NATIVE_SWR_PATCH_MAX_KEY_CHARS = 20_000;
const NATIVE_SWR_PATCH_MAX_KEY_BYTES = 59_000;
const NATIVE_SWR_PATCH_MAX_ENTRY_CHARS = 1024 * 1024;
const NATIVE_SWR_PATCH_MAX_TOTAL_CHARS = 8 * 1024 * 1024;

function getUtf8ByteLength(value: string) {
  let byteLength = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) {
      byteLength += 1;
    } else if (codePoint <= 0x7_ff) {
      byteLength += 2;
    } else if (codePoint <= 0xff_ff) {
      byteLength += 3;
    } else {
      byteLength += 4;
    }
  }
  return byteLength;
}

function isValidSWRKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= NATIVE_SWR_PATCH_MAX_KEY_CHARS &&
    getUtf8ByteLength(value) <= NATIVE_SWR_PATCH_MAX_KEY_BYTES
  );
}

function isValidSWRTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function parseNativeSWRCachePatchIntent(
  value: unknown,
): INativeSWRCachePatchIntent | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const patch = value as Partial<INativeSWRCachePatchIntent>;
  if (
    (patch.clearBefore !== undefined &&
      !isValidSWRTimestamp(patch.clearBefore)) ||
    !Array.isArray(patch.removePrefixes) ||
    !Array.isArray(patch.removals) ||
    !Array.isArray(patch.updates) ||
    patch.removePrefixes.length + patch.removals.length + patch.updates.length >
      NATIVE_SWR_PATCH_MAX_ITEMS
  ) {
    return undefined;
  }
  const totalChars =
    patch.removePrefixes.reduce(
      (total, item) => total + (item?.prefix?.length ?? 0),
      0,
    ) +
    patch.removals.reduce(
      (total, item) => total + (item?.[0]?.length ?? 0),
      0,
    ) +
    patch.updates.reduce(
      (total, item) =>
        total + (item?.[0]?.length ?? 0) + (item?.[1]?.length ?? 0),
      0,
    );
  if (totalChars > NATIVE_SWR_PATCH_MAX_TOTAL_CHARS) {
    return undefined;
  }
  if (
    !patch.removePrefixes.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        isValidSWRKey(item.prefix) &&
        item.prefix.length > 0 &&
        isValidSWRTimestamp(item.at),
    ) ||
    !patch.removals.every(
      (item) =>
        Array.isArray(item) &&
        item.length === 2 &&
        isValidSWRKey(item[0]) &&
        isValidSWRTimestamp(item[1]),
    ) ||
    !patch.updates.every(
      (item) =>
        Array.isArray(item) &&
        item.length === 2 &&
        isValidSWRKey(item[0]) &&
        typeof item[1] === 'string' &&
        item[1].length <= NATIVE_SWR_PATCH_MAX_ENTRY_CHARS,
    )
  ) {
    return undefined;
  }
  return patch as INativeSWRCachePatchIntent;
}

export function parseNativeSyncStorageMutation(
  value: unknown,
): INativeSyncStorageMutation | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as {
    key?: unknown;
    operation?: unknown;
    entries?: unknown;
    sourceMutationId?: unknown;
    store?: unknown;
    value?: unknown;
  };
  if (
    candidate.store !== 'settings' &&
    candidate.store !== 'coldStart' &&
    candidate.store !== 'devSettings'
  ) {
    return undefined;
  }
  if (
    candidate.sourceMutationId !== undefined &&
    (!Number.isSafeInteger(candidate.sourceMutationId) ||
      (candidate.sourceMutationId as number) <= 0)
  ) {
    return undefined;
  }
  const source =
    candidate.sourceMutationId === undefined
      ? {}
      : { sourceMutationId: candidate.sourceMutationId as number };
  if (candidate.operation === 'clear') {
    return { store: candidate.store, operation: 'clear', ...source };
  }
  if (
    candidate.operation === 'patchSWR' &&
    candidate.store === 'coldStart' &&
    Array.isArray(candidate.entries) &&
    candidate.entries.length <= NATIVE_SWR_PATCH_MAX_ITEMS &&
    candidate.entries.reduce<number>(
      (total: number, item: unknown) =>
        total +
        (Array.isArray(item) && typeof item[0] === 'string'
          ? item[0].length
          : 0) +
        (Array.isArray(item) && typeof item[1] === 'string'
          ? item[1].length
          : 0),
      0,
    ) <= NATIVE_SWR_PATCH_MAX_TOTAL_CHARS &&
    candidate.entries.every(
      (item) =>
        Array.isArray(item) &&
        item.length === 2 &&
        isValidSWRKey(item[0]) &&
        (item[1] === null ||
          (typeof item[1] === 'string' &&
            item[1].length <= NATIVE_SWR_PATCH_MAX_ENTRY_CHARS)),
    )
  ) {
    return {
      store: 'coldStart',
      operation: 'patchSWR',
      entries: candidate.entries as INativeSWRCacheCanonicalEntry[],
      ...source,
    };
  }
  if (
    (candidate.operation === 'remove' || candidate.operation === 'set') &&
    typeof candidate.key === 'string'
  ) {
    if (candidate.operation === 'remove') {
      return {
        store: candidate.store,
        operation: 'remove',
        key: candidate.key,
        ...source,
      };
    }
    if (
      typeof candidate.value === 'string' ||
      typeof candidate.value === 'number' ||
      typeof candidate.value === 'boolean'
    ) {
      return {
        store: candidate.store,
        operation: 'set',
        key: candidate.key,
        value: candidate.value,
        ...source,
      };
    }
  }
  return undefined;
}

export type INativeStorageGlobal = typeof globalThis & {
  __onekeyNativeStorageCall?: INativeStorageCall;
  __onekeyNativeStorageIsTransportReady?: () => boolean;
  __onekeyNativeStorageContractViolationBroadcast?: (
    violation: INativeStorageContractViolation,
  ) => boolean;
  __onekeyNativeStorageContractViolationQueue?: INativeStorageContractViolation[];
  __onekeyNativeSyncStorageBroadcast?: (
    mutation: INativeSyncStorageMutation,
  ) => boolean;
  __onekeyNativeSyncStorageApplyMutation?: (
    mutation: INativeSyncStorageMutation,
  ) => void;
  __onekeyNativeSyncStorageTransportReady?: () => void;
};
