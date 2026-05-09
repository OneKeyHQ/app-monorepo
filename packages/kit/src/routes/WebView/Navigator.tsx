import { EPageType } from '@onekeyhq/components';
import { RootModalNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import type { EWebViewRoutes } from '@onekeyhq/shared/src/routes';

import { webViewRouter } from './router';

export function WebViewNavigator() {
  return (
    <RootModalNavigator<EWebViewRoutes>
      config={webViewRouter}
      pageType={EPageType.webView}
    />
  );
}
