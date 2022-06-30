import * as Linking from 'expo-linking';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getAppNavigation } from '../hooks/useAppNavigation';
import { HomeRoutes, RootRoutes } from '../routes/routesEnum';

export const openUrlByWebview = (url: string, title?: string) => {
  const navigation = getAppNavigation();
  navigation.navigate(RootRoutes.Root, {
    screen: HomeRoutes.SettingsWebviewScreen,
    params: {
      url,
      title,
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

export const openUrlExternal = (url: string) => {
  if (platformEnv.isNative) {
    Linking.openURL(url);
  } else {
    window.open(url, '_blank');
  }
};
