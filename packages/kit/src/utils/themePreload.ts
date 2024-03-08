import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const THEME_PRELOAD_STORAGE_KEY = 'ONEKEY_THEME_PRELOAD';
export function setThemePreloadToLocalStorage(
  value: 'dark' | 'light' | 'system',
  forceUpdate = true,
) {
  try {
    const key = THEME_PRELOAD_STORAGE_KEY;
    if (platformEnv.isRuntimeBrowser) {
      if (forceUpdate || !localStorage.getItem(key)) {
        localStorage.setItem(key, value);
      }
    }
  } catch (error) {
    console.error(error);
  }
}
