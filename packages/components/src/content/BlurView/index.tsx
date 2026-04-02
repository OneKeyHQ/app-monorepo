import type { ForwardedRef } from 'react';
import { forwardRef, useMemo } from 'react';

import { BlurView as NativeBlurView } from 'expo-blur';
import { type View as IView, type ViewStyle } from 'react-native';

import {
  usePropsAndStyle,
  useStyle,
} from '@onekeyhq/components/src/shared/tamagui';
import type { StackStyle } from '@onekeyhq/components/src/shared/tamagui';

import { useThemeName } from '../../hooks/useStyle';
import { OptimizationView } from '../../optimization';

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

  const optimizationViewStyle = useMemo(
    () => ({
      ...(style as ViewStyle),
      overflow: 'hidden' as const,
    }),
    [style],
  );

  const fallbackContentStyle = useMemo(() => ({ flex: 1 as const }), []);

  return (
    <OptimizationView style={optimizationViewStyle}>
      <NativeBlurView
        style={
          contentStyle
            ? (resolvedContentStyle as ViewStyle)
            : fallbackContentStyle
        }
        tint={themeName}
        experimentalBlurMethod={experimentalBlurMethod || 'dimezisBlurView'}
        {...restProps}
        ref={ref}
      />
    </OptimizationView>
  );
}

export const BlurView = forwardRef<IView, IBlurViewPros>(BasicBlurView);
