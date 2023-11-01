import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

import { usePropsAndStyle, useStyle } from '@tamagui/core';
import { setupReactNative } from '@tamagui/web';
import { ScrollView as ScrollViewNative } from 'react-native';

import type { StackProps } from '@tamagui/web/types';
import type {
  ScrollViewProps as ScrollViewNativeProps,
  StyleProp,
  ViewStyle,
} from 'react-native';

setupReactNative({
  ScrollView: ScrollViewNative,
});

export type ScrollViewProps = Omit<
  ScrollViewNativeProps,
  'contentContainerStyle'
> &
  StackProps & {
    contentContainerStyle: StackProps;
  };

export type ScrollViewRef = ScrollViewNative;

function BaseScrollView(
  { children, contentContainerStyle, ...props }: ScrollViewProps,
  ref: ForwardedRef<ScrollViewRef>,
) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  const contentStyle = useStyle(
    contentContainerStyle as Record<string, unknown>,
    {
      resolveValues: 'auto',
    },
  );
  return (
    <ScrollViewNative
      ref={ref}
      style={style as StyleProp<ViewStyle>}
      contentContainerStyle={contentStyle}
      {...restProps}
    >
      {children}
    </ScrollViewNative>
  );
}

export const ScrollView = forwardRef(BaseScrollView);
