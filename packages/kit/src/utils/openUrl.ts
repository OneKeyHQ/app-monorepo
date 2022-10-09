import * as Linking from 'expo-linking';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getAppNavigation } from '../hooks/useAppNavigation';
import { WebviewRoutesModalRoutes } from '../routes/Modal/WebView';
import { HomeRoutes, ModalRoutes, RootRoutes } from '../routes/routesEnum';

export const openUrlByWebview = (
  url: string,
  title?: string,
  options?: {
    modalMode?: boolean;
  },
) => {
  const navigation = getAppNavigation();

  if (options?.modalMode) {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Webview,
      params: {
        screen: WebviewRoutesModalRoutes.WebviewModel,
        params: {
          url,
          title,
        },
      },
    });
  } else {
    navigation.navigate(RootRoutes.Root, {
      screen: HomeRoutes.SettingsWebviewScreen,
      params: {
        url,
        title,
      },
    });
  }
};

export const openUrl = (
  url: string,
  title?: string,
  options?: {
    modalMode?: boolean;
  },
) => {
  if (platformEnv.isNative) {
    openUrlByWebview(url, title, options);
  } else {
    window.open(url, '_blank');
  }
};

export const openUrlExternal = (url: string) => {
  if (platformEnv.isNative) {
    // open by OS default browser
    Linking.openURL(url);
  } else {
    window.open(url, '_blank');
  }
};
