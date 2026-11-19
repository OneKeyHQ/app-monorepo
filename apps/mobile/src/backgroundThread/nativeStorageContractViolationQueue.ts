import {
  type INativeStorageContractViolation,
  parseNativeStorageContractViolation,
} from '@onekeyhq/shared/src/storage/nativeStorageTypes';

const MAX_PERSISTED_VIOLATIONS = 20;

export const NATIVE_STORAGE_CONTRACT_VIOLATION_KEY_PREFIX =
  'onekey:bg:native-storage-violation:';

type INativeStorageViolationStore = {
  delete: (key: string) => boolean;
  get: (key: string) => string | number | boolean | undefined;
  keys: () => string[];
  set: (key: string, value: string | number | boolean) => void;
};

type IPersistedNativeStorageContractViolation = {
  key: string;
  violation: INativeStorageContractViolation;
};

function buildViolationKey(id: string) {
  return `${NATIVE_STORAGE_CONTRACT_VIOLATION_KEY_PREFIX}${encodeURIComponent(id)}`;
}

function getViolationKeys(store: INativeStorageViolationStore) {
  return store
    .keys()
    .filter((key) =>
      key.startsWith(NATIVE_STORAGE_CONTRACT_VIOLATION_KEY_PREFIX),
    )
    .toSorted();
}

export function readPersistedNativeStorageContractViolations(
  store: INativeStorageViolationStore,
) {
  const entries: IPersistedNativeStorageContractViolation[] = [];
  const invalidKeys: string[] = [];

  for (const key of getViolationKeys(store)) {
    const rawValue = store.get(key);
    if (typeof rawValue === 'string') {
      try {
        const violation = parseNativeStorageContractViolation(
          JSON.parse(rawValue),
        );
        if (violation) {
          entries.push({ key, violation });
        } else {
          invalidKeys.push(key);
        }
      } catch {
        invalidKeys.push(key);
      }
    } else {
      invalidKeys.push(key);
    }
  }

  return { entries, invalidKeys };
}

export function persistNativeStorageContractViolation(
  store: INativeStorageViolationStore,
  violation: INativeStorageContractViolation,
) {
  try {
    const key = buildViolationKey(violation.id);
    const { entries, invalidKeys } =
      readPersistedNativeStorageContractViolations(store);
    invalidKeys.forEach((invalidKey) => store.delete(invalidKey));

    const existingKeys = entries
      .map((entry) => entry.key)
      .filter((entryKey) => entryKey !== key);
    while (existingKeys.length >= MAX_PERSISTED_VIOLATIONS) {
      const oldestKey = existingKeys.shift();
      if (oldestKey) {
        store.delete(oldestKey);
      }
    }

    store.set(key, JSON.stringify(violation));
    return true;
  } catch {
    return false;
  }
}

export function deletePersistedNativeStorageContractViolation(
  store: INativeStorageViolationStore,
  violationId: string,
) {
  return store.delete(buildViolationKey(violationId));
}

export function drainPersistedNativeStorageContractViolations(
  store: INativeStorageViolationStore,
  handleViolation: (violation: INativeStorageContractViolation) => void,
) {
  const { entries, invalidKeys } =
    readPersistedNativeStorageContractViolations(store);
  invalidKeys.forEach((key) => store.delete(key));

  let deliveredCount = 0;
  for (const entry of entries) {
    try {
      handleViolation(entry.violation);
      store.delete(entry.key);
      deliveredCount += 1;
    } catch {
      // Keep the entry for the next main-runtime drain attempt.
    }
  }
  return deliveredCount;
}
