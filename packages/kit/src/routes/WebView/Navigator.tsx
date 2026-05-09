import { EPageType, Stack } from '@onekeyhq/components';
import { RootModalNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { MIN_SIDEBAR_WIDTH } from '@onekeyhq/components/src/utils/sidebar';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EWebViewRoutes } from '@onekeyhq/shared/src/routes';

import { webViewRouter } from './router';

// react-navigation's CardContainer renders two intermediate `<View>` layers
// between its pointerEvents=none wrapper and our overlay outer. Those two
// layers default to pointerEvents=auto and capture clicks in the sidebar
// passthrough column. RN-Web ignores `pointerEvents` set via the cardStyle
// style object (it only translates the `pointerEvents` prop to a class), so
// we override them via CSS `:has()` — supported in Chromium/Electron 105+.
// The selectors target ONLY the two direct ancestors of `webview-overlay-outer`
// so the rule doesn't leak to other navigators.
const DESKTOP_CARD_PASSTHROUGH_CSS = `
:has(> [data-testid="webview-overlay-outer"]),
:has(> * > [data-testid="webview-overlay-outer"]) {
  pointer-events: none !important;
}
`;

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
    // WebView content explicitly occupies only the main-content area.
    // The injected <style> turns the two react-navigation Card layers above
    // us click-through (see DESKTOP_CARD_PASSTHROUGH_CSS comment).
    // testIDs translate to data-testid so the CSS selector + DOM diagnostics
    // can target the right layers.
    return (
      <>
        <style
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: DESKTOP_CARD_PASSTHROUGH_CSS }}
        />
        <Stack
          flex={1}
          pointerEvents="box-none"
          testID="webview-overlay-outer"
        >
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            left={MIN_SIDEBAR_WIDTH}
            right={0}
            testID="webview-overlay-inset"
          >
            {navigator}
          </Stack>
        </Stack>
      </>
    );
  }
  return navigator;
}
