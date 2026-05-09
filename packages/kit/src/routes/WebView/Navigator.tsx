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
    // Inset by sidebar width only — the header covers the macOS hidden
    // titlebar area on purpose so the close button reaches the top-left.
    // `pointerEvents="box-none"` lets the empty padding-left pass through
    // to the underlying Main route so the sidebar stays interactive while
    // the WebView is open.
    return (
      <Stack flex={1} pl={MIN_SIDEBAR_WIDTH} pointerEvents="box-none">
        {navigator}
      </Stack>
    );
  }
  return navigator;
}
