import { LinearGradient as NativeLinearGradient } from 'expo-linear-gradient';
import { usePropsAndStyle } from 'tamagui';

import type { IStackProps } from '../../primitives';
import type { LinearGradientProps } from 'expo-linear-gradient';
import type { ViewStyle } from 'react-native';

export type ILinearGradientProps = LinearGradientProps & IStackProps;

export function LinearGradient(props: ILinearGradientProps) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  return (
    <NativeLinearGradient style={style as ViewStyle} {...(restProps as any)} />
  );
}
