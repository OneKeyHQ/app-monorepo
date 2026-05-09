import appGlobals from '@onekeyhq/shared/src/appGlobals';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  EWebViewRoutes,
  type IWebViewPageParams,
} from '@onekeyhq/shared/src/routes';

import { isAllowedWebViewUrl } from './urlSafety';

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
 * Security: see `isAllowedWebViewUrl` for the full policy. Disallowed URLs
 * are silently rejected — the caller gets no signal, by design.
 */
export function openWebView(params: IOpenWebViewParams) {
  const { url } = params;
  if (!isAllowedWebViewUrl(url)) {
    return;
  }

  if (platformEnv.isWeb || platformEnv.isExtension) {
    globalThis.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  if (platformEnv.isDesktop) {
    // Desktop renders WebViewPage directly into a portal slot (see
    // Navigator.desktop) — no inner navigator. Single-level params; read at
    // the WebView root screen via `useRoute()` and passed as a prop.
    appGlobals.$rootAppNavigation?.navigate(ERootRoutes.WebView, params);
    return;
  }

  // Native: three-level nesting required by RootModalNavigator +
  // ModalFlowNavigator:
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
