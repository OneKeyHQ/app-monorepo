import { DefaultTheme } from '@react-navigation/native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const hasNativeModal = platformEnv.isNativeIOS;

export const TransparentModalTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: hasNativeModal ? DefaultTheme.colors.background : 'transparent',
    card: hasNativeModal ? DefaultTheme.colors.card : 'transparent',
  },
};
