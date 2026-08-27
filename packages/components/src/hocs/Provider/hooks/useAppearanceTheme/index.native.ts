import { useLayoutEffect } from 'react';

import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'react-native';

import { getTokenValue } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IUseAppearanceTheme } from './type';

// expo-navigation-bar 56 dropped setBackgroundColorAsync entirely - Android 15
// enforces an edge-to-edge, system-drawn navigation bar - and replaced
// setButtonStyleAsync with NavigationBar.setStyle. The argument is passed
// through unchanged: NavigationBarProps.style documents itself as the button
// color that resolves to 'light' for a dark app, which is what the old call
// meant. (The NavigationBarStyle type comment reads the other way round; worth
// confirming on a physical Android device, since the emulator ignores it.)
const setDarkContent = (isAnimated = true) => {
  StatusBar.setBarStyle('light-content', isAnimated);
  if (platformEnv.isNativeAndroid) {
    const color = getTokenValue('$bgAppDark', 'color');
    StatusBar.setBackgroundColor(color, isAnimated);
    NavigationBar.setStyle('light');
  }
};

const setLightContent = (isAnimated = true) => {
  StatusBar.setBarStyle('dark-content', isAnimated);
  if (platformEnv.isNativeAndroid) {
    const color = getTokenValue('$bgAppLight', 'color');
    StatusBar.setBackgroundColor(color, isAnimated);
    NavigationBar.setStyle('dark');
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
