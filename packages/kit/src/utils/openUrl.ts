import * as Linking from 'expo-linking';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getAppNavigation } from '../hooks/useAppNavigation';
import { HomeRoutes, RootRoutes } from '../routes/types';

export const openUrl = (url: string, title?: string) => {
  const navigation = getAppNavigation();
  if (platformEnv.isNative) {
    navigation.navigate(RootRoutes.Root, {
      screen: HomeRoutes.SettingsWebviewScreen,
      params: {
        url,
        title,
      },
    });
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
