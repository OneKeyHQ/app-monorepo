import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { HomeRoutes, HomeRoutesParams } from '../routes/types';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.SettingsWebviewScreen
>;

export default function useOpenBrowser() {
  const navigation = useNavigation<NavigationProps>();

  const open = useCallback(
    (url: string, title?: string) => {
      if (['android', 'ios'].includes(Platform.OS)) {
        navigation.navigate(HomeRoutes.SettingsWebviewScreen, {
          url,
          title,
        });
      } else {
        window.open(url, '_blank');
      }
    },
    [navigation],
  );

  const openUrlExternal = useCallback((url: string) => {
    if (['android', 'ios'].includes(Platform.OS)) {
      Linking.openURL(url);
    } else {
      window.open(url, '_blank');
    }
  }, []);

  return {
    /**
     * Open the URL inside the application.
     */
    openUrl: open,
    /**
     * Open the URL with a third-party browser.
     */
    openUrlExternal,
  };
}
