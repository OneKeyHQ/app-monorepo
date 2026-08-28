import { useLayoutEffect } from 'react';

import { setStyle } from 'expo-navigation-bar';
import { StatusBar } from 'react-native';

import { getTokenValue } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IUseAppearanceTheme } from './type';

const setDarkContent = (isAnimated = true) => {
  StatusBar.setBarStyle('light-content', isAnimated);
  if (platformEnv.isNativeAndroid) {
    const color = getTokenValue('$bgAppDark', 'color');
    StatusBar.setBackgroundColor(color, isAnimated);
    setStyle('light');
  }
};

const setLightContent = (isAnimated = true) => {
  StatusBar.setBarStyle('dark-content', isAnimated);
  if (platformEnv.isNativeAndroid) {
    const color = getTokenValue('$bgAppLight', 'color');
    StatusBar.setBackgroundColor(color, isAnimated);
    setStyle('dark');
  }
};

export const useAppearanceTheme: IUseAppearanceTheme = (themeVariant) => {
  useLayoutEffect(() => {
    if (themeVariant === 'light') {
      setLightContent();
    } else if (themeVariant === 'dark') {
      setDarkContent();
    }
  }, [themeVariant]);
};
