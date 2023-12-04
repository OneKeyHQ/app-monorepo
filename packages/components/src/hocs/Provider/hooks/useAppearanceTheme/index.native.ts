import { useLayoutEffect } from 'react';

import { StatusBar } from 'react-native';

import type { IUseAppearanceTheme } from './type';

const setLightContent = (isAnimated = true) => {
  StatusBar.pushStackEntry({
    animated: isAnimated,
    barStyle: 'light-content',
  });
};

const setDarkContent = (isAnimated = true) => {
  StatusBar.pushStackEntry({
    animated: isAnimated,
    barStyle: 'dark-content',
  });
};

export const useAppearanceTheme: IUseAppearanceTheme = (themeVariant) => {
  useLayoutEffect(() => {
    if (themeVariant === 'light') {
      setDarkContent();
    } else if (themeVariant === 'dark') {
      setLightContent();
    }
  }, [themeVariant]);
};
