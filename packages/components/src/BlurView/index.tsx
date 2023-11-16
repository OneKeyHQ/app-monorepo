import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

import { usePropsAndStyle, useStyle } from '@tamagui/core';
import { BlurView as NativeBlurView } from 'expo-blur';
import { type View as IView, type ViewStyle } from 'react-native';

import useTheme from '../Provider/hooks/useTheme';
import { View } from '../View';

import type { StackStyleProps } from '@tamagui/web/types/types';
import type { BlurViewProps } from 'expo-blur';

export type IBlurViewPros = Omit<BlurViewProps, 'style' | 'intensity'> &
  StackStyleProps & {
    /**
     * intensity will be used like `blur(${intensity * 0.2}px)` on Web.
     *
     * @default 50
     */
    intensity?: number;
    contentStyle?: StackStyleProps;
  };

function BasicBlurView(
  { contentStyle, ...props }: IBlurViewPros,
  ref: ForwardedRef<IView>,
) {
  const { themeVariant } = useTheme();
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });

  const resolvedContentStyle = useStyle(contentStyle || {}, {
    resolveValues: 'auto',
  });

  return (
    <View
      style={{
        ...(style as ViewStyle),
        overflow: 'hidden',
      }}
    >
      <NativeBlurView
        style={contentStyle ? (resolvedContentStyle as ViewStyle) : { flex: 1 }}
        tint={themeVariant}
        {...restProps}
        ref={ref}
      />
    </View>
  );
}

export const BlurView = forwardRef<IView, IBlurViewPros>(BasicBlurView);
