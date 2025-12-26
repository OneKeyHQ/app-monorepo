import { useMemo } from 'react';

import { LinearGradient as NativeLinearGradient } from 'expo-linear-gradient';

import {
  usePropsAndStyle,
  useTheme,
} from '@onekeyhq/components/src/shared/tamagui';

import type { IThemeColorKeys } from '../../hooks';
import type { IStackProps } from '../../primitives';
import type { LinearGradientProps } from 'expo-linear-gradient';
import type { ViewStyle } from 'react-native';

export type ILinearGradientProps = Omit<LinearGradientProps, 'colors'> &
  Omit<IStackProps, 'start' | 'end'> & {
    colors: string[] | IThemeColorKeys[];
  };

export function LinearGradient({ colors, ...props }: ILinearGradientProps) {
  const theme = useTheme();
  const resolvedColors = useMemo(() => {
    return colors.map(
      (color) => theme[color as IThemeColorKeys]?.val as string,
    );
  }, [colors, theme]);
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
