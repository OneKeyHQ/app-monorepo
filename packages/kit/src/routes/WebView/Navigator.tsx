import { EPageType, Stack } from '@onekeyhq/components';
import { RootModalNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { MIN_SIDEBAR_WIDTH } from '@onekeyhq/components/src/utils/sidebar';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EWebViewRoutes } from '@onekeyhq/shared/src/routes';

import { webViewRouter } from './router';

export function WebViewNavigator() {
  const navigator = (
    <RootModalNavigator<EWebViewRoutes>
      config={webViewRouter}
      pageType={EPageType.webView}
    />
  );
  if (platformEnv.isDesktop) {
    // Inset by sidebar width on desktop. The WebView root screen still sits
    // on top of the rest of the app — sidebar shows through the transparent
    // backdrop visually but is not interactive while the overlay is open
    // (close via the WebView's own close button).
    return (
      <Stack flex={1} pl={MIN_SIDEBAR_WIDTH}>
        {navigator}
      </Stack>
    );
  }
  return navigator;
}
