import { useEffect } from 'react';

import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  defaultColorScheme,
  useSystemColorScheme,
} from './useSystemColorScheme';

export const THEME_PRELOAD_STORAGE_KEY = 'ONEKEY_THEME_PRELOAD';
export function useThemeVariant() {
  const [{ theme }] = useSettingsPersistAtom();
  // startup theme on web: apps/ext/src/assets/preload-html-head.js

  const colorScheme = useSystemColorScheme();
  const themeVariant =
    theme === 'system' ? colorScheme ?? defaultColorScheme : theme;
  return themeVariant;
}

// sync theme variant to external storage
export const useSyncThemeVariant = platformEnv.isNative
  ? () => ({})
  : () => {
      const [{ theme }] = useSettingsPersistAtom();
      useEffect(() => {
        setTimeout(() => {
          localStorage.setItem(THEME_PRELOAD_STORAGE_KEY, theme);
          // startup theme on desktop: apps/desktop/src-electron/app.ts 213L
          if (platformEnv.isDesktop) {
            window.desktopApi?.changeTheme(theme);
          }
        });
      }, [theme]);
    };
