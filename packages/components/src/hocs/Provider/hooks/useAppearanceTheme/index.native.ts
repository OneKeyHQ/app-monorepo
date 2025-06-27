import { useLayoutEffect } from 'react';

import {
  setBackgroundColorAsync,
  setButtonStyleAsync,
} from 'expo-navigation-bar';
import { StatusBar } from 'react-native';
import { getTokenValue } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IUseAppearanceTheme } from './type';

const setDarkContent = (isAnimated = true) => {
  StatusBar.setBarStyle('light-content', isAnimated);
  if (platformEnv.isNativeAndroid) {
    const color = getTokenValue('$bgAppDark', 'color');
    StatusBar.setBackgroundColor(color, isAnimated);
    void setBackgroundColorAsync(color);
    void setButtonStyleAsync('light');
  }
};

const setLightContent = (isAnimated = true) => {
  StatusBar.setBarStyle('dark-content', isAnimated);
  if (platformEnv.isNativeAndroid) {
    const color = getTokenValue('$bgAppLight', 'color');
    StatusBar.setBackgroundColor(color, isAnimated);
    void setBackgroundColorAsync(color);
    void setButtonStyleAsync('dark');
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
