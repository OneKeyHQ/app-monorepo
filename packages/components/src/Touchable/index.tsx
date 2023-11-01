import { forwardRef } from 'react';

import { usePropsAndStyle } from '@tamagui/core';
import { TouchableOpacity } from 'react-native';

import type { StyleProp, TouchableOpacityProps, ViewStyle } from 'react-native';
import type { StackProps } from 'tamagui';

export type TouchableProps = TouchableOpacityProps & StackProps;

export function BaseTouchable({ children, ...props }: TouchableProps) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  return (
    <TouchableOpacity style={style as StyleProp<ViewStyle>} {...restProps}>
      {children}
    </TouchableOpacity>
  );
}

export const Touchable = forwardRef(BaseTouchable);
