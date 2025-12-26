import { LinearGradient as NativeLinearGradient } from 'expo-linear-gradient';

import { usePropsAndStyle } from '@onekeyhq/components/src/shared/tamagui';

import { type IThemeColorKeys, useThemeValue } from '../../hooks';

import type { IStackProps } from '../../primitives';
import type { LinearGradientProps } from 'expo-linear-gradient';
import type { ViewStyle } from 'react-native';

export type ILinearGradientProps = Omit<LinearGradientProps, 'colors'> &
  Omit<IStackProps, 'start' | 'end'> & {
    colors: string[] | IThemeColorKeys[];
  };

/**
 * @deprecated Use useTheme hook instead for better performance and type safety
 * @example
 * const theme = useTheme();
 * <NativeLinearGradient colors={[theme.bg1.val, theme.bg2.val]} />
 */
export function LinearGradient({ colors, ...props }: ILinearGradientProps) {
  const resolvedColors = useThemeValue(colors as IThemeColorKeys[]);
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  return (
    <NativeLinearGradient
      style={style as ViewStyle}
      colors={resolvedColors}
      start={props.start}
      end={props.end}
      {...(restProps as any)}
    />
  );
}
