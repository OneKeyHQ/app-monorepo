import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

import { usePropsAndStyle, useStyle } from '@tamagui/core';
import { ScrollView as ScrollViewNative } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ScrollViewRefProvider, useForwardedScrollViewRef } from '../../hocs';

import type { StackProps } from '@tamagui/web/types';
import type {
  ScrollViewProps as ScrollViewNativeProps,
  StyleProp,
  ViewStyle,
} from 'react-native';

export type IScrollViewProps = Omit<
  ScrollViewNativeProps,
  'contentContainerStyle'
> &
  StackProps & {
    contentContainerStyle?: StackProps;
  };

export type IScrollViewRef = ScrollViewNative;

function BaseScrollView(
  { children, contentContainerStyle = {}, ...props }: IScrollViewProps,
  forwardedRef: ForwardedRef<IScrollViewRef>,
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
  const ref = useForwardedScrollViewRef(forwardedRef);
  return (
    <ScrollViewRefProvider value={ref}>
      <ScrollViewNative
        ref={ref}
        style={style as StyleProp<ViewStyle>}
        contentContainerStyle={contentStyle}
        {...restProps}
        refreshControl={platformEnv.isNative ? props.refreshControl : undefined}
      >
        {children}
      </ScrollViewNative>
    </ScrollViewRefProvider>
  );
}

export const ScrollView = forwardRef(BaseScrollView);
