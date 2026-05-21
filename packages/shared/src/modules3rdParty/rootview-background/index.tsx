import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IUpdateRootViewBackgroundColor } from './type';

export const THEME_PRELOAD_STORAGE_KEY = 'ONEKEY_THEME_PRELOAD';

export const updateRootViewBackgroundColor: IUpdateRootViewBackgroundColor = (
  color: string,
  themeVariant: 'light' | 'dark',
) => {
  setTimeout(() => {
    localStorage.setItem(THEME_PRELOAD_STORAGE_KEY, themeVariant);
    // Paint <html> so the browser chrome / scroll-bounce area follows
    // the new theme even before the next paint settles.
    if (document.documentElement) {
      document.documentElement.style.backgroundColor = color;
    }
    // iOS Safari (and some Android browsers) cache the initial
    // <meta name="theme-color"> value and ignore subsequent
    // setAttribute('content', …) updates, so the top status-bar tint stays
    // on the previous theme. Replacing the element forces re-evaluation.
    const existing = document.querySelector('meta[name="theme-color"]');
    const next = document.createElement('meta');
    next.setAttribute('name', 'theme-color');
    next.setAttribute('content', color);
    if (existing?.parentNode) {
      existing.parentNode.replaceChild(next, existing);
    } else if (document.head) {
      document.head.appendChild(next);
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
