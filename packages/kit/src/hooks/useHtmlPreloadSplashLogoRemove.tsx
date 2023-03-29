import { useEffect } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function useHtmlPreloadSplashLogoRemove(options?: {
  isDelay?: boolean;
}) {
  useEffect(() => {
    if (platformEnv.isRuntimeBrowser) {
      const img = document.querySelector('.onekey-index-html-preload-image');
      if (options?.isDelay) {
        // splash logo is disabled in extension, so we need more delay to wait home ui ready
        const hideLogoDelay = platformEnv.isExtension ? 400 : 50;
        // const hideLogoDelay = 0;
        setTimeout(() => img?.remove(), hideLogoDelay);
      } else {
        img?.remove();
      }
    }
  }, [options?.isDelay]);
}
