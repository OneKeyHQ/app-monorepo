import { EPageType, Stack } from '@onekeyhq/components';
import { RootModalNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { MIN_SIDEBAR_WIDTH } from '@onekeyhq/components/src/utils/sidebar';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EWebViewRoutes } from '@onekeyhq/shared/src/routes';

import { webViewRouter } from './router';

// macOS hidden-titleBar window still leaves a ~28-32px region at the top for
// the traffic-light buttons. Match Onboarding's $10 (~40px) so we sit cleanly
// below them with a little breathing room.
const DESKTOP_TITLE_BAR_OFFSET = 36;

export function WebViewNavigator() {
  const navigator = (
    <RootModalNavigator<EWebViewRoutes>
      config={webViewRouter}
      pageType={EPageType.webView}
    />
  );
  if (platformEnv.isDesktop) {
    // Inset by sidebar width on the left and titlebar height on the top.
    // `pointerEvents="box-none"` lets the empty (transparent) area pass
    // pointer events through to the underlying Main route — so the sidebar
    // and the macOS traffic-light buttons stay interactive.
    return (
      <Stack
        flex={1}
        pl={MIN_SIDEBAR_WIDTH}
        pt={DESKTOP_TITLE_BAR_OFFSET}
        pointerEvents="box-none"
      >
        {navigator}
      </Stack>
    );
  }
  return navigator;
}
