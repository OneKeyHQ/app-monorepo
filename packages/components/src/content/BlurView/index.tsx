import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

import { usePropsAndStyle, useStyle } from '@tamagui/core';
import { BlurView as NativeBlurView } from 'expo-blur';
import { type View as IView, type ViewStyle } from 'react-native';

import { useThemeName } from '../../hooks';
import { OptimizationView } from '../../optimization';

import type { StackStyle } from '@tamagui/web/types/types';
import type { BlurViewProps } from 'expo-blur';

export type IBlurViewPros = Omit<BlurViewProps, 'style' | 'intensity'> &
  StackStyle & {
    /**
     * intensity will be used like `blur(${intensity * 0.2}px)` on Web.
     *
     * @default 50
     */
    intensity?: number;
    contentStyle?: StackStyle;
  };

function BasicBlurView(
  { contentStyle, experimentalBlurMethod, ...props }: IBlurViewPros,
  ref: ForwardedRef<any>,
) {
  const themeName = useThemeName();
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });

  const resolvedContentStyle = useStyle(contentStyle || {}, {
    resolveValues: 'auto',
  });

  return (
    <OptimizationView
      style={{
        ...(style as ViewStyle),
        overflow: 'hidden',
      }}
    >
      <NativeBlurView
        style={contentStyle ? (resolvedContentStyle as ViewStyle) : { flex: 1 }}
        tint={themeName}
        experimentalBlurMethod={experimentalBlurMethod || 'dimezisBlurView'}
        {...restProps}
        ref={ref}
      />
    </OptimizationView>
  );
}

export const BlurView = forwardRef<IView, IBlurViewPros>(BasicBlurView);
