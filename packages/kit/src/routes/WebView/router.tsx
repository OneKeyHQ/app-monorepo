import type {
  IModalFlowNavigatorConfig,
  IModalRootNavigatorConfig,
} from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import {
  EWebViewRoutes,
  type IWebViewParamList,
} from '@onekeyhq/shared/src/routes';
import {
  bindRouteManifest,
  webViewRouteManifest,
  webViewScreenRouteManifest,
} from '@onekeyhq/shared/src/routes/routeManifest';

const WebViewPage = LazyLoad(
  () => import('@onekeyhq/kit/src/views/WebView/pages/WebViewPage'),
);

// Inner stack (each entry has `component`).
const webViewScreenBindings: IModalFlowNavigatorConfig<
  EWebViewRoutes,
  IWebViewParamList
>[] = [
  {
    name: EWebViewRoutes.WebView,
    component: WebViewPage,
  },
];
const webViewStack = bindRouteManifest(
  webViewScreenRouteManifest,
  webViewScreenBindings,
);

// Outer wrapper consumed by RootModalNavigator + useRootRouter (each entry
// has `children`). Mirrors `onboardingRouterV2Config`.
export const webViewRouter: IModalRootNavigatorConfig<EWebViewRoutes>[] =
  bindRouteManifest(webViewRouteManifest, [
    {
      name: EWebViewRoutes.WebView,
      children: webViewStack,
    },
  ]);
