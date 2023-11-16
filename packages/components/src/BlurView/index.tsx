import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

import { usePropsAndStyle } from '@tamagui/core';
import { BlurView as NativeBlurView } from 'expo-blur';

import useTheme from '../Provider/hooks/useTheme';

import type { StackStyleProps } from '@tamagui/web/types/types';
import type { BlurViewProps } from 'expo-blur';
import type { StyleProp, View, ViewStyle } from 'react-native';

export type IBlurViewPros = Omit<BlurViewProps, 'style'> & StackStyleProps;

function BasicBlurView(props: IBlurViewPros, ref: ForwardedRef<View>) {
  const { themeVariant } = useTheme();
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  return (
    <NativeBlurView
      style={style as StyleProp<ViewStyle>}
      {...restProps}
      tint={themeVariant}
      ref={ref}
    />
  );
}

export const BlurView = forwardRef<View, IBlurViewPros>(BasicBlurView);
