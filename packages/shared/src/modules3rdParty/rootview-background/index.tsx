import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IUpdateRootViewBackgroundColor } from './type';

export const THEME_PRELOAD_STORAGE_KEY = 'ONEKEY_THEME_PRELOAD';

export const updateRootViewBackgroundColor: IUpdateRootViewBackgroundColor = (
  color: string,
  theme: 'light' | 'dark',
) => {
  setTimeout(() => {
    localStorage.setItem(THEME_PRELOAD_STORAGE_KEY, theme);
    if (platformEnv.isExtension) {
      // Keep a copy in extension storage so background/service-worker can read it.
      void (async () => {
        try {
          await globalThis.chrome?.storage?.local?.set({
            [THEME_PRELOAD_STORAGE_KEY]: theme,
          });
        } catch {
          // ignore
        }
      })();
    }
    // startup theme on desktop: apps/desktop/app/app.ts 213L
    if (platformEnv.isDesktop) {
      globalThis.desktopApi?.changeTheme(theme);
    }
  });
};
