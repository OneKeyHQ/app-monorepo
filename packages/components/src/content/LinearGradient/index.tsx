import { LinearGradient as NativeLinearGradient } from 'expo-linear-gradient';
import { usePropsAndStyle } from 'tamagui';

import { type IThemeColorKeys, useThemeValue } from '../../hooks';

import type { IStackProps } from '../../primitives';
import type { LinearGradientProps } from 'expo-linear-gradient';
import type { ViewStyle } from 'react-native';

export type ILinearGradientProps = Omit<LinearGradientProps, 'colors'> &
  IStackProps & {
    colors: string[] | IThemeColorKeys[];
  };

export function LinearGradient({ colors, ...props }: ILinearGradientProps) {
  const resolvedColors = useThemeValue(colors as IThemeColorKeys[]);
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  return (
    <NativeLinearGradient
      style={style as ViewStyle}
      colors={resolvedColors}
      {...(restProps as any)}
    />
  );
}
