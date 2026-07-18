import platformEnv from '@onekeyhq/shared/src/platformEnv';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';

import type { IUpdateRootViewBackgroundColor } from './type';

export const THEME_PRELOAD_STORAGE_KEY = 'ONEKEY_THEME_PRELOAD';

export const updateRootViewBackgroundColor: IUpdateRootViewBackgroundColor = (
  color: string,
  themeVariant: 'light' | 'dark',
) => {
  if (resetUtils.getIsResetting()) {
    return;
  }
  const resetGeneration = resetUtils.getResetGeneration();
  const updateTask = new Promise<void>((resolve) => {
    setTimeout(() => {
      void (async () => {
        if (
          resetUtils.getIsResetting() ||
          resetUtils.getResetGeneration() !== resetGeneration
        ) {
          return;
        }
        localStorage.setItem(THEME_PRELOAD_STORAGE_KEY, themeVariant);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
          meta.setAttribute('content', color);
        }
        if (platformEnv.isExtension) {
          // Keep a copy in extension storage so background/service-worker can read it.
          await globalThis.chrome?.storage?.local?.set({
            [THEME_PRELOAD_STORAGE_KEY]: themeVariant,
          });
        }
        // startup theme on desktop: apps/desktop/app/app.ts 213L
        if (platformEnv.isDesktop) {
          await globalThis.desktopApiProxy.system.changeTheme(themeVariant);
        }
      })().then(
        () => resolve(),
        (error: unknown) => {
          console.error('updateRootViewBackgroundColor error', error);
          resolve();
        },
      );
    });
  });
  void resetUtils.trackResetSensitiveTask(updateTask);
};
