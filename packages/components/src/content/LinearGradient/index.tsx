import { LinearGradient as NativeLinearGradient } from 'expo-linear-gradient';

import { usePropsAndStyle } from '@onekeyhq/components/src/shared/tamagui';

import type { IThemeColorKeys } from '../../hooks';
import type { IStackProps } from '../../primitives';
import type { LinearGradientProps } from 'expo-linear-gradient';
import type { ViewStyle } from 'react-native';

export type ILinearGradientProps = Omit<LinearGradientProps, 'colors'> &
  Omit<IStackProps, 'start' | 'end'> & {
    colors: string[] | IThemeColorKeys[];
  };

export function LinearGradient({ colors, ...props }: ILinearGradientProps) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  return (
    <NativeLinearGradient
      style={style as ViewStyle}
      colors={colors}
      start={props.start}
      end={props.end}
      {...(restProps as any)}
    />
  );
}
