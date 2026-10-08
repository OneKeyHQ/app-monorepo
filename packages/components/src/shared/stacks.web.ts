import { View, styled } from '@tamagui/core';
import {
  ThemeableStack as TamaguiThemeableStack,
  XStack as TamaguiXStack,
  YStack as TamaguiYStack,
} from '@tamagui/stacks';

export const Stack = styled(View, {
  name: 'OneKeyStack',
  position: 'relative',
});

export const XStack = styled(TamaguiXStack, {
  name: 'OneKeyXStack',
  position: 'relative',
});

export const YStack = styled(TamaguiYStack, {
  name: 'OneKeyYStack',
  position: 'relative',
});

export const ThemeableStack = styled(TamaguiThemeableStack, {
  name: 'OneKeyThemeableStack',
  position: 'relative',
});
