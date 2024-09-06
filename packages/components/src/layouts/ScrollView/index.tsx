import type { ForwardedRef, MutableRefObject, RefObject } from 'react';
import {
  createContext,
  forwardRef,
  memo,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';

import { usePropsAndStyle, useStyle } from '@tamagui/core';
import { ScrollView as ScrollViewNative } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { StackProps } from '@tamagui/web/types';
import type {
  NativeScrollEvent,
  NativeScrollPoint,
  NativeSyntheticEvent,
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

const scrollViewRefContext = createContext<{
  scrollViewRef: MutableRefObject<IScrollViewRef | null>;
  pageOffsetRef: MutableRefObject<NativeScrollPoint>;
}>({
  scrollViewRef: {
    current: {} as IScrollViewRef,
  },
  pageOffsetRef: {
    current: {
      x: 0,
      y: 0,
    },
  },
});
const ScrollViewRefProvider = memo(scrollViewRefContext.Provider);
export const useScrollView = () => useContext(scrollViewRefContext);

const useSafeRef = (ref: ForwardedRef<IScrollViewRef>) => {
  const safeRef = useRef<ForwardedRef<IScrollViewRef>>();
  return ref || (safeRef as unknown as typeof ref);
};

function BaseScrollView(
  {
    children,
    onScroll,
    contentContainerStyle = {},
    ...props
  }: IScrollViewProps,
  ref: ForwardedRef<IScrollViewRef>,
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
  const safeRef = useSafeRef(ref);
  const pageOffsetRef = useRef({ x: 0, y: 0 });
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      pageOffsetRef.current = event.nativeEvent.contentOffset;
      onScroll?.(event);
    },
    [onScroll],
  );
  const value = useMemo(
    () => ({
      scrollViewRef: safeRef as any,
      pageOffsetRef,
    }),
    [safeRef],
  );
  return (
    <ScrollViewNative
      ref={safeRef}
      style={style as StyleProp<ViewStyle>}
      contentContainerStyle={contentStyle}
      scrollEventThrottle={30}
      onScroll={handleScroll}
      {...restProps}
      refreshControl={platformEnv.isNative ? props.refreshControl : undefined}
    >
      <ScrollViewRefProvider value={value}>{children}</ScrollViewRefProvider>
    </ScrollViewNative>
  );
}

export const ScrollView = forwardRef(BaseScrollView);
