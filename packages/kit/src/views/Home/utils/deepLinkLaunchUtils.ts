import {
  ANDROID_PACKAGE_NAME,
  APP_STORE_DOWNLOAD_LINK,
  APP_STORE_DOWNLOAD_WEB_LINK,
  DOWNLOAD_URL,
  PLAY_STORE_LINK,
} from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const IOS_STORE_WEB_FALLBACK_DELAY_MS = 300;
const IOS_STORE_ELAPSED_THRESHOLD_MS = 1500;

export const DEEP_LINK_DOWNLOAD_HINT_DELAY_MS = 5000;

export function buildAndroidIntentUrl(deepLinkUrl: string): string {
  const schemeEnd = deepLinkUrl.indexOf('://');
  if (schemeEnd === -1) {
    return deepLinkUrl;
  }
  const scheme = deepLinkUrl.slice(0, schemeEnd);
  const rest = deepLinkUrl.slice(schemeEnd + 3);
  return `intent://${rest}#Intent;scheme=${scheme};package=${ANDROID_PACKAGE_NAME};end`;
}

export function redirectToStore() {
  if (platformEnv.isWebMobileIOS) {
    const storeStartTime = Date.now();
    globalThis.location.href = APP_STORE_DOWNLOAD_LINK;
    globalThis.setTimeout(() => {
      const elapsed = Date.now() - storeStartTime;
      const isVisible = globalThis.document?.visibilityState !== 'hidden';
      if (isVisible && elapsed <= IOS_STORE_ELAPSED_THRESHOLD_MS) {
        globalThis.location.href = APP_STORE_DOWNLOAD_WEB_LINK;
      }
    }, IOS_STORE_WEB_FALLBACK_DELAY_MS);
    return;
  }
  if (platformEnv.isWebMobileAndroid) {
    globalThis.location.href = PLAY_STORE_LINK;
    return;
  }
  globalThis.location.href = DOWNLOAD_URL;
}

export function openAppViaDeepLink(deepLinkUrl: string) {
  if (!deepLinkUrl) return;
  if (platformEnv.isWebMobileAndroid) {
    globalThis.location.href = buildAndroidIntentUrl(deepLinkUrl);
    return;
  }
  globalThis.location.href = deepLinkUrl;
}

export function scheduleDeepLinkFallbackHint({
  onFallback,
  delay = DEEP_LINK_DOWNLOAD_HINT_DELAY_MS,
}: {
  onFallback: () => void;
  delay?: number;
}): () => void {
  if (typeof globalThis.document === 'undefined') {
    return () => undefined;
  }

  let isCleanedUp = false;
  let didLeavePage = globalThis.document.visibilityState === 'hidden';
  let didBlur = false;
  let shouldFallbackOnFocus = false;

  const timerId = setTimeout(() => {
    if (didLeavePage || globalThis.document.visibilityState === 'hidden') {
      cleanup();
      return;
    }

    if (
      didBlur &&
      typeof globalThis.document.hasFocus === 'function' &&
      !globalThis.document.hasFocus()
    ) {
      shouldFallbackOnFocus = true;
      return;
    }

    cleanup();
    onFallback();
  }, delay);

  function cleanup() {
    if (isCleanedUp) return;
    isCleanedUp = true;
    clearTimeout(timerId);
    globalThis.document.removeEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );
    globalThis.removeEventListener('pagehide', handlePageHide);
    globalThis.removeEventListener('blur', handleBlur);
    globalThis.removeEventListener('focus', handleFocus);
  }

  function handleVisibilityChange() {
    if (globalThis.document.visibilityState === 'hidden') {
      didLeavePage = true;
      cleanup();
    }
  }

  function handlePageHide() {
    didLeavePage = true;
    cleanup();
  }

  function handleBlur() {
    didBlur = true;
  }

  function handleFocus() {
    if (!shouldFallbackOnFocus) return;
    cleanup();
    if (globalThis.document.visibilityState !== 'hidden') {
      onFallback();
    }
  }

  globalThis.document.addEventListener(
    'visibilitychange',
    handleVisibilityChange,
  );
  globalThis.addEventListener('pagehide', handlePageHide);
  globalThis.addEventListener('blur', handleBlur);
  globalThis.addEventListener('focus', handleFocus);

  return cleanup;
}
