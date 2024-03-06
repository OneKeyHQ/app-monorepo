import { useLayoutEffect } from 'react';

import { StatusBar } from 'react-native';
import { getTokenValue } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IUseAppearanceTheme } from './type';

const setLightContent = (isAnimated = true) => {
  StatusBar.setBarStyle('light-content', isAnimated);

  if (platformEnv.isNativeAndroid) {
    StatusBar.setBackgroundColor(
      getTokenValue('$bgAppLight', 'color'),
      isAnimated,
    );
  }
};

const setDarkContent = (isAnimated = true) => {
  StatusBar.setBarStyle('dark-content', isAnimated);
  if (platformEnv.isNativeAndroid) {
    StatusBar.setBackgroundColor(
      getTokenValue('$bgAppDark', 'color'),
      isAnimated,
    );
  }
};

export const useAppearanceTheme: IUseAppearanceTheme = (themeVariant) => {
  console.log(
    'useAppearanceTheme---',
    getTokenValue('$bgAppLight', 'color'),
    getTokenValue('$bgAppDark', 'color'),
  );
  useLayoutEffect(() => {
    if (themeVariant === 'light') {
      setDarkContent();
    } else if (themeVariant === 'dark') {
      setLightContent();
    }
  }, [themeVariant]);
};
