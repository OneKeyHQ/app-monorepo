import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { THEME_PRELOAD_STORAGE_KEY } from '../store/reducers/settings';

function themePreload() {
  if (platformEnv.isBrowser) {
    const theme = localStorage.getItem(THEME_PRELOAD_STORAGE_KEY);
    if (theme === 'dark') {
      document.documentElement.style.backgroundColor = 'black';
    }
    if (theme === 'light' || theme === 'system') {
      document.documentElement.style.backgroundColor = 'white';
    }
  }
}
export { themePreload };
