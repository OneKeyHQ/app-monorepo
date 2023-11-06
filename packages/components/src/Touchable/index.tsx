import { usePropsAndStyle, useStyle } from '@tamagui/core';
import {
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native-gesture-handler';

import type { StackStyleProps } from '@tamagui/web/types/types';
import type { StyleProp, ViewStyle } from 'react-native';

export type TouchableProps = Omit<TouchableOpacityProps, 'containerStyle'> &
  StackStyleProps & {
    containerStyle?: StackStyleProps;
  };

export function Touchable({
  children,
  containerStyle = {},
  ...props
}: TouchableProps) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  const containerStyleSheet = useStyle(containerStyle, {
    resolveValues: 'auto',
  });
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
