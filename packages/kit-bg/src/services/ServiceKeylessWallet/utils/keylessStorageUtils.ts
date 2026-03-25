import appStorage from '@onekeyhq/shared/src/storage/appStorage';

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

/**
 * Set item to storage, preferring secureStorage if available.
 */
async function storageSetItem(
  key: string,
  encryptedPayloadBase64: string,
): Promise<void> {
  if (await isSecureStorageSupported()) {
    await appStorage.secureStorage.setSecureItem(key, encryptedPayloadBase64);
  } else {
    await appStorage.setItem(key, encryptedPayloadBase64);
  }
}

/**
 * Get item from storage, preferring secureStorage if available.
 */
async function storageGetItem(key: string): Promise<string | null> {
  if (await isSecureStorageSupported()) {
    return appStorage.secureStorage.getSecureItem(key);
  }
  return appStorage.getItem(key);
}

/**
 * Remove item from storage, preferring secureStorage if available.
 */
async function storageRemoveItem(key: string): Promise<void> {
  if (await isSecureStorageSupported()) {
    await appStorage.secureStorage.removeSecureItem(key);
  } else {
    await appStorage.removeItem(key);
  }
}

export default {
  storageSetItem,
  storageGetItem,
  storageRemoveItem,
};
