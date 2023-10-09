import { DefaultTheme } from '@react-navigation/native';
import { Platform } from 'react-native';

export const hasNativeHeaderView = Platform.OS === 'ios';

export const hasStackNavigatorModal =
  Platform.OS === 'ios' || Platform.OS === 'android';

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
