import type {
  IModalFlowNavigatorConfig,
  IModalRootNavigatorConfig,
} from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import {
  EWebViewRoutes,
  type IWebViewParamList,
} from '@onekeyhq/shared/src/routes';

const WebViewPage = LazyLoad(
  () => import('@onekeyhq/kit/src/views/WebView/pages/WebViewPage'),
);

// Inner stack (each entry has `component`).
const webViewStack: IModalFlowNavigatorConfig<
  EWebViewRoutes,
  IWebViewParamList
>[] = [
  {
    name: EWebViewRoutes.WebView,
    component: WebViewPage,
  },
];

// Outer wrapper consumed by RootModalNavigator + useRootRouter (each entry
// has `children`). Mirrors `onboardingRouterV2Config`.
export const webViewRouter: IModalRootNavigatorConfig<EWebViewRoutes>[] = [
  {
    name: EWebViewRoutes.WebView,
    children: webViewStack,
  },
];
