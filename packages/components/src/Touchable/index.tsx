import { usePropsAndStyle, useStyle } from '@tamagui/core';
import {
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native-gesture-handler';

import type { StyleProp, ViewStyle } from 'react-native';
import type { StackProps } from 'tamagui';

export type TouchableProps = Omit<
  TouchableOpacityProps,
  'style' | 'containerStyle'
> &
  StackProps & {
    containerStyle: StackProps;
  };

export function Touchable({
  children,
  containerStyle,
  ...props
}: TouchableProps) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  const containerStyleSheet = useStyle(containerStyle);
  return (
    <TouchableOpacity
      style={style as StyleProp<ViewStyle>}
      containerStyle={containerStyleSheet as StyleProp<ViewStyle>}
      {...(restProps as TouchableOpacityProps)}
    >
      {children}
    </TouchableOpacity>
  );
}
