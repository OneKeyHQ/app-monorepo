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
    // Outer wrapper covers the full screen with pe=box-none so empty area
    // (left of sidebar inset) lets clicks reach the underlying Main route.
    // Inner wrapper is absolute-positioned starting at sidebar width so the
    // WebView content explicitly occupies only the main-content area —
    // padding shorthand on Tamagui Stack didn't reliably constrain inner
    // descendants on web (pl was dropped in CSS class translation).
    return (
      <Stack flex={1} pointerEvents="box-none">
        <Stack
          position="absolute"
          top={0}
          bottom={0}
          left={MIN_SIDEBAR_WIDTH}
          right={0}
        >
          {navigator}
        </Stack>
      </Stack>
    );
  }
  return navigator;
}
