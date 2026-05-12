const SensitiveMessage = '❃❃❃❃ sensitive information ❃❃❃❃';

export function devOnlyData<T>(
  data: T,
  fallback = SensitiveMessage,
): string | unknown {
  if (process.env.NODE_ENV !== 'production') {
    return data as unknown;
  }
  return fallback;
}

export const WEB_DAPP_MODE_STORAGE_KEY = '$onekey_web_dapp_mode';

function getWebLocalStorage(): Storage | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  try {
    const storage = globalThis.localStorage;
    if (
      storage &&
      typeof storage.getItem === 'function' &&
      typeof storage.setItem === 'function'
    ) {
      return storage;
    }
  } catch {
    // Ignore unavailable browser storage.
  }
  return undefined;
}

export function isWebInDappMode() {
  const storage = getWebLocalStorage();
  if (storage?.getItem(WEB_DAPP_MODE_STORAGE_KEY) === 'wallet') {
    return false; // wallet mode
  }
  return true; // dapp mode
}
export function switchWebDappMode() {
  const storage = getWebLocalStorage();
  if (!storage) {
    return;
  }
  storage.setItem(
    WEB_DAPP_MODE_STORAGE_KEY,
    isWebInDappMode() ? 'wallet' : 'dapp',
  );
}
