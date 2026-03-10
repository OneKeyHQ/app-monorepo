import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IUpdateRootViewBackgroundColor } from './type';

export const THEME_PRELOAD_STORAGE_KEY = 'ONEKEY_THEME_PRELOAD';

export const updateRootViewBackgroundColor: IUpdateRootViewBackgroundColor = (
  color: string,
  themeVariant: 'light' | 'dark',
) => {
  setTimeout(() => {
    localStorage.setItem(THEME_PRELOAD_STORAGE_KEY, themeVariant);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', color);
    }
    if (platformEnv.isExtension) {
      // Keep a copy in extension storage so background/service-worker can read it.
      void (async () => {
        try {
          await globalThis.chrome?.storage?.local?.set({
            [THEME_PRELOAD_STORAGE_KEY]: themeVariant,
          });
        } catch {
          // ignore
        }
      })();
    }
    // startup theme on desktop: apps/desktop/app/app.ts 213L
    if (platformEnv.isDesktop) {
      void globalThis.desktopApiProxy.system.changeTheme(themeVariant);
    }
  });
};
