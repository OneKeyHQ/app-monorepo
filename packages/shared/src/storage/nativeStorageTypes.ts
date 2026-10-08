export type INativeStorageScalar = string | number | boolean;

export type INativeSyncStorageName = 'settings' | 'devSettings';

export type INativeSyncStorageEntry = readonly [string, INativeStorageScalar];

export type INativeSyncStorageLocalMutation =
  | {
      operation: 'set';
      key: string;
      value: INativeStorageScalar;
    }
  | { operation: 'remove'; key: string }
  | { operation: 'clear' };

export type INativeSyncStorageMutation = INativeSyncStorageLocalMutation & {
  sourceMutationId?: number;
  store: INativeSyncStorageName;
};

export type INativeStorageBootstrapSnapshot = {
  settings: INativeSyncStorageEntry[];
  devSettings: INativeSyncStorageEntry[];
};

/** The stores a bootstrap request asks bg to read. Omitted means all of them;
 *  a store left out comes back empty rather than missing, so a caller that
 *  does not mirror it pays nothing for it. */
export const NATIVE_STORAGE_BOOTSTRAP_DEFAULT_STORES: INativeSyncStorageName[] =
  ['settings', 'devSettings'];

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
      operation: 'clear';
      sourceMutationId?: number;
      sourceRuntimeId?: string;
      store: INativeSyncStorageName;
    };

export type INativeStorageRequest =
  | INativeAsyncStorageRequest
  | INativeSyncStorageRequest
  | {
      scope: 'recovery';
      operation: 'resetMigrationTarget';
      target: INativeStorageMigrationRecoveryTarget;
    }
  | { scope: 'bootstrap'; stores?: INativeSyncStorageName[] };

export type INativeStorageCall = (
  request: INativeStorageRequest,
) => Promise<unknown>;

export const NATIVE_SYNC_STORAGE_MUTATION_EVENT =
  'onekey:native-sync-storage-mutation';

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
  if (candidate.store !== 'settings' && candidate.store !== 'devSettings') {
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
