import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';

/**
 * Cache for secure storage support check.
 * This capability typically doesn't change during app runtime,
 * so we cache the result to avoid repeated async checks.
 */
let _secureStorageSupported: boolean | null = null;

/**
 * Check if secure storage is supported, with caching.
 */
async function isSecureStorageSupported(): Promise<boolean> {
  if (_secureStorageSupported === null) {
    _secureStorageSupported =
      await appStorage.secureStorage.supportSecureStorageWithoutInteraction();
  }
  return _secureStorageSupported;
}

const pendingMutations = new Set<Promise<void>>();

async function runMutation(
  operation: (useSecureStorage: boolean) => Promise<void>,
) {
  resetUtils.checkNotInResetting();
  const useSecureStorage = await isSecureStorageSupported();
  resetUtils.checkNotInResetting();
  const pending = operation(useSecureStorage);
  pendingMutations.add(pending);
  try {
    await pending;
  } finally {
    pendingMutations.delete(pending);
  }
}

async function eraseItemsForAppReset(keys: string[]) {
  await Promise.allSettled(pendingMutations);
  const useSecureStorage = await isSecureStorageSupported();
  const outcomes = await Promise.allSettled(
    keys.map((key) =>
      useSecureStorage
        ? appStorage.secureStorage.removeSecureItem(key)
        : appStorage.removeItem(key),
    ),
  );
  const failed = outcomes.find((outcome) => outcome.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}

/**
 * Set item to storage, preferring secureStorage if available.
 */
async function storageSetItem(
  key: string,
  encryptedPayloadBase64: string,
): Promise<void> {
  await runMutation((secure) =>
    secure
      ? appStorage.secureStorage.setSecureItem(key, encryptedPayloadBase64)
      : appStorage.setItem(key, encryptedPayloadBase64),
  );
}

/**
 * Get item from storage, preferring secureStorage if available.
 */
async function storageGetItem(key: string): Promise<string | null> {
  if (resetUtils.getIsResetting()) return null;
  const value = (await isSecureStorageSupported())
    ? await appStorage.secureStorage.getSecureItem(key)
    : await appStorage.getItem(key);
  return resetUtils.getIsResetting() ? null : value;
}

/**
 * Remove item from storage, preferring secureStorage if available.
 */
async function storageRemoveItem(key: string): Promise<void> {
  await runMutation((secure) =>
    secure
      ? appStorage.secureStorage.removeSecureItem(key)
      : appStorage.removeItem(key),
  );
}

export default {
  storageSetItem,
  storageGetItem,
  storageRemoveItem,
  eraseItemsForAppReset,
};
