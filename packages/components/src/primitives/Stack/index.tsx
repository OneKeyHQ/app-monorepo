import {
  Stack as TMStack,
  XStack as TMXStack,
  YStack as TMYStack,
  ZStack as TMZStack,
  styled,
} from 'tamagui';

import type {
  StackProps,
  XStackProps,
  YStackProps,
  ZStackProps,
} from 'tamagui';

export const Stack = styled(TMStack, {
  backgroundColor: '$transparent',
});

export type IStackProps = StackProps;

export const XStack = styled(TMXStack, {
  backgroundColor: '$transparent',
});

export type IXStackProps = XStackProps;

export const YStack = styled(TMYStack, {
  backgroundColor: '$transparent',
});

export type IYStackProps = YStackProps;

export const ZStack = styled(TMZStack, {
  backgroundColor: '$transparent',
});

export type IZStackProps = ZStackProps;
