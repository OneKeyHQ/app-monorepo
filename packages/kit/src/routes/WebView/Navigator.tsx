import { EPageType, Portal } from '@onekeyhq/components';
import type { EPortalContainerConstantName } from '@onekeyhq/components';
import { RootModalNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EWebViewRoutes } from '@onekeyhq/shared/src/routes';

import { WEB_VIEW_DESKTOP_SLOT_ID } from './desktopSlotConsts';
import { webViewRouter } from './router';

// `Portal.Body`'s `container` prop is typed as `EPortalContainerConstantName`,
// but the slot id lives in `@onekeyhq/kit` and cannot be added to the enum
// (per CLAUDE.md import hierarchy: components cannot import from kit).
// Cast to the enum type — the Portal manager keys on string at runtime.
const WEB_VIEW_DESKTOP_SLOT_CONTAINER =
  WEB_VIEW_DESKTOP_SLOT_ID as unknown as EPortalContainerConstantName;

export function WebViewNavigator() {
  const navigator = (
    <RootModalNavigator<EWebViewRoutes>
      config={webViewRouter}
      pageType={EPageType.webView}
    />
  );
  // Desktop: render into the main-content portal slot so sidebar + titlebar
  // stay visible. Other platforms (native, web, ext) render at the React
  // Navigation root.
  if (platformEnv.isDesktop) {
    return (
      <Portal.Body container={WEB_VIEW_DESKTOP_SLOT_CONTAINER}>
        {navigator}
      </Portal.Body>
    );
  }
  return navigator;
}
