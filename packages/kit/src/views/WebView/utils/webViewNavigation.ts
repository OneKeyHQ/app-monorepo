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
 * Security: only `https://` URLs are accepted. http, javascript, file, data,
 * about, intent, and any other scheme are silently rejected. URLs that embed
 * userinfo (`https://user@host` or `https://user:pass@host`) are rejected
 * because the visible host can mislead users about the real navigation target.
 */
export function openWebView(params: IOpenWebViewParams) {
  const { url } = params;
  if (!url || !/^https:\/\//i.test(url)) {
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (parsed.username || parsed.password) {
    return;
  }

  if (platformEnv.isWeb || platformEnv.isExtension) {
    globalThis.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  // Three-level nesting required by RootModalNavigator + ModalFlowNavigator:
  //   root stack ─ ERootRoutes.WebView         (RootModalNavigator)
  //     └─ inner stack ─ EWebViewRoutes.WebView (ModalFlowNavigator wrapper)
  //         └─ leaf screen ─ EWebViewRoutes.WebView (WebViewPage)
  // Only the inner-most `params` reach `route.params` inside WebViewPage.
  // Mirror the Onboarding navigate pattern (see useKeylessWallet.tsx).
  appGlobals.$rootAppNavigation?.navigate(ERootRoutes.WebView, {
    screen: EWebViewRoutes.WebView,
    params: {
      screen: EWebViewRoutes.WebView,
      params,
    },
  });
}
