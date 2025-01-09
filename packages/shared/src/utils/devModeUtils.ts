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
export function isWebInDappMode() {
  if (localStorage.getItem(WEB_DAPP_MODE_STORAGE_KEY) === 'wallet') {
    return false; // wallet mode
  }
  return true; // dapp mode
}
export function switchWebDappMode() {
  localStorage.setItem(
    WEB_DAPP_MODE_STORAGE_KEY,
    isWebInDappMode() ? 'wallet' : 'dapp',
  );
}
