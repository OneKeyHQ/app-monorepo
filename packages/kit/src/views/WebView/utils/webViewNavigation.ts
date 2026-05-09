import appGlobals from '@onekeyhq/shared/src/appGlobals';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  EWebViewRoutes,
  type IWebViewPageParams,
} from '@onekeyhq/shared/src/routes';

export type IOpenWebViewParams = IWebViewPageParams;

/**
 * Open a URL in the OneKey WebView overlay route.
 *
 * - Native (iOS/Android): full-screen slide-in overlay covering the app.
 * - Desktop (Electron): covers main content area only; sidebar + titlebar visible.
 * - Web / Browser Extension: opens in a new browser tab via `window.open`.
 *
 * Caller MUST invoke from a sync user-gesture handler on web/extension
 * to avoid popup-blocker rejection.
 *
 * Only `http(s)://` URLs are accepted; other schemes are silently rejected.
 */
export function openWebView(params: IOpenWebViewParams) {
  const { url } = params;
  if (!url || !/^https?:\/\//i.test(url)) {
    return;
  }

  if (platformEnv.isWeb || platformEnv.isExtension) {
    globalThis.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  appGlobals.$rootAppNavigation?.navigate(ERootRoutes.WebView, {
    screen: EWebViewRoutes.WebView,
    params,
  });
}
