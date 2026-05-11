import { popToMainRoute, rootNavigationRef } from '@onekeyhq/components';
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

  // Three-level nesting required by RootModalNavigator + ModalFlowNavigator:
  //   root stack ─ ERootRoutes.WebView         (RootModalNavigator)
  //     └─ inner stack ─ EWebViewRoutes.WebView (ModalFlowNavigator wrapper)
  //         └─ leaf screen ─ EWebViewRoutes.WebView (WebViewPage)
  // Only the inner-most `params` reach `route.params` inside WebViewPage.
  // Mirror the Onboarding navigate pattern (see useKeylessWallet.tsx).
  const navigateToWebView = () => {
    appGlobals.$rootAppNavigation?.navigate(ERootRoutes.WebView, {
      screen: EWebViewRoutes.WebView,
      params: {
        screen: EWebViewRoutes.WebView,
        params,
      },
    });
  };

  // iOS: a native presentation already on screen (Modal / iOSFullScreen /
  // Onboarding / FullScreenPush) blocks the WebView overlay from layering
  // on top — iOS won't present a second view controller above an active
  // one. Dismiss the stacked overlays first via popToMainRoute(), which
  // atomically resets the root stack to Main and waits 100ms for UIKit's
  // dismiss animation to settle (see NavigationContainer.tsx — same fix
  // pattern as switchTabAsync, avoiding the RNSScreenStack orphan race).
  if (platformEnv.isNativeIOS) {
    const rootState = rootNavigationRef.current?.getRootState();
    const stackedOverlayCount = rootState
      ? Math.max(rootState.routes.length - 1, 0)
      : 0;
    if (stackedOverlayCount > 0) {
      void popToMainRoute().then(navigateToWebView);
      return;
    }
  }

  navigateToWebView();
}
