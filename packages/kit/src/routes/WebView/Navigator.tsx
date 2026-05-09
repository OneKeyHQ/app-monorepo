import { useMemo } from 'react';

import { useRoute } from '@react-navigation/core';

import { EPageType, Portal } from '@onekeyhq/components';
import type { EPortalContainerConstantName } from '@onekeyhq/components';
import { RootModalNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EWebViewRoutes,
  IWebViewPageParams,
} from '@onekeyhq/shared/src/routes';

import { WEB_VIEW_DESKTOP_SLOT_ID } from './desktopSlotConsts';
import { webViewRouter } from './router';

// `Portal.Body`'s `container` prop is typed as `EPortalContainerConstantName`,
// but the slot id lives in `@onekeyhq/kit` and cannot be added to the enum
// (per CLAUDE.md import hierarchy: components cannot import from kit).
// Cast to the enum type — the Portal manager keys on string at runtime.
const WEB_VIEW_DESKTOP_SLOT_CONTAINER =
  WEB_VIEW_DESKTOP_SLOT_ID as unknown as EPortalContainerConstantName;

const WebViewPage = LazyLoad(
  () => import('@onekeyhq/kit/src/views/WebView/pages/WebViewPage'),
);

/**
 * Desktop renders the WebView page DIRECTLY (no inner Stack.Navigator) into
 * the main-content portal slot. Mounting another `RootModalNavigator` inside
 * the slot conflicts with the parent SceneView's existing navigator
 * (`EnsureSingleNavigator` rejects the second registration).
 *
 * Route params are read here at the source — i.e. inside the React Navigation
 * root stack's WebView screen — and passed as a prop. The portal teleports
 * the rendered JSX into the slot; it does NOT re-evaluate `useRoute()` at
 * the destination (which would yield the tab's own route, not the WebView
 * route's params).
 */
function WebViewDesktopPortal() {
  const route = useRoute();
  const rawParams = route.params;
  // Stabilize the params reference on identity. React Navigation may pass a
  // fresh object reference each render even when the actual values are
  // unchanged; without memoization here Portal.Body would re-create the
  // child tree (the WebView reload) on every render.
  const params = useMemo(
    () => (rawParams ?? {}) as IWebViewPageParams,
    [rawParams],
  );
  const child = useMemo(() => <WebViewPage params={params} />, [params]);
  return (
    <Portal.Body container={WEB_VIEW_DESKTOP_SLOT_CONTAINER}>
      {child}
    </Portal.Body>
  );
}

export function WebViewNavigator() {
  if (platformEnv.isDesktop) {
    return <WebViewDesktopPortal />;
  }
  return (
    <RootModalNavigator<EWebViewRoutes>
      config={webViewRouter}
      pageType={EPageType.webView}
    />
  );
}
