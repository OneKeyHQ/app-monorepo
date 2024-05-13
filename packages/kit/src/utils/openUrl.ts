import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalWebViewRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';

export const openUrlByWebview = (url: string, title?: string) => {
  global.$navigationRef.current?.navigate(ERootRoutes.Modal, {
    screen: EModalRoutes.WebViewModal,
    params: {
      screen: EModalWebViewRoutes.WebView,
      params: {
        url,
        title,
      },
    },
  });
};

export const openUrl = (url: string, title?: string) => {
  if (platformEnv.isNative) {
    openUrlByWebview(url, title);
  } else {
    window.open(url, '_blank');
  }
};
