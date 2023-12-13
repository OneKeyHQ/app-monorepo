import { useEffect } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IUseAppearanceTheme } from './type';

const THEME_PRELOAD_STORAGE_KEY = 'ONEKEY_THEME_PRELOAD';
function setThemePreloadToLocalStorage(value: string, forceUpdate = true) {
  try {
    const key = THEME_PRELOAD_STORAGE_KEY;
    if (platformEnv.isRuntimeBrowser) {
      if (forceUpdate || !localStorage.getItem(key)) {
        localStorage.setItem(key, value);
      }
      if (!platformEnv.isWebEmbed) {
        // same to preload-html-head.js
        if (value === 'dark') {
          document.documentElement.style.backgroundColor = 'rgb(19, 19, 27)';
        }
        if (value === 'light' || value === 'system') {
          document.documentElement.style.backgroundColor = 'white';
        }
      }
    }
  } catch (error) {
    console.error(error);
  }
}

export const useAppearanceTheme: IUseAppearanceTheme = (theme) => {
  useEffect(() => {
    if (['dark', 'light'].includes(theme)) {
      setThemePreloadToLocalStorage(theme, true);
    }
  }, [theme]);
};
