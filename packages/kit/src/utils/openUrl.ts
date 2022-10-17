import { TabActions } from '@react-navigation/routers';
import * as Linking from 'expo-linking';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { getAppNavigation } from '../hooks/useAppNavigation';
import { WebviewRoutesModalRoutes } from '../routes/Modal/WebView';
import {
  HomeRoutes,
  ModalRoutes,
  RootRoutes,
  TabRoutes,
} from '../routes/routesEnum';
import { setIncomingUrl } from '../store/reducers/webTabs';

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

export const openDapp = (url: string) => {
  if (platformEnv.isNative || platformEnv.isDesktop) {
    const navigation = getAppNavigation();
    backgroundApiProxy.dispatch(setIncomingUrl(url));

    navigation?.dispatch(TabActions.jumpTo(TabRoutes.Discover, {}));
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
