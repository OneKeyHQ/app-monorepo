import { DefaultTheme } from '@react-navigation/native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const hasNativeHeaderView = platformEnv.isNativeIOS;

export const hasStackNavigatorModal =
  platformEnv.isNativeIOS || platformEnv.isNativeAndroid;

export const TransparentModalTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: hasNativeHeaderView
      ? DefaultTheme.colors.background
      : 'transparent',
    card: hasNativeHeaderView ? DefaultTheme.colors.card : 'transparent',
  },
};
