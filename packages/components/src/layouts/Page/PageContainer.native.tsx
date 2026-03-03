import { useCallback, useContext, useMemo, useRef } from 'react';

import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import {
  usePropsAndStyle,
  useStyle,
} from '@onekeyhq/components/src/shared/tamagui';

import { KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET } from '../../content/Keyboard';
import { ScrollViewRefProvider } from '../ScrollView';

import { BasicPage } from './BasicPage';
import { PageContext } from './PageContext';
import { BasicPageFooter } from './PageFooter';

import type { IPageProps } from './type';
import type { IScrollViewRef } from '../ScrollView';
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';

export function PageContainer({ children, lazyLoad, fullPage }: IPageProps) {
  const { scrollEnabled, scrollProps } = useContext(PageContext);

  const {
    contentContainerStyle: rawContentContainerStyle,
    ...restScrollProps
  } = scrollProps || {};

  const [nativeProps, style] = usePropsAndStyle(
    restScrollProps as Record<string, unknown>,
    { resolveValues: 'auto' },
  );

  const contentContainerStyle = useStyle(
    (rawContentContainerStyle || {}) as Record<string, unknown>,
    { resolveValues: 'auto' },
  );

  // Maintain ScrollView ref context so useScrollView() consumers still work
  const scrollViewRef = useRef<IScrollViewRef>(null);
  const pageOffsetRef = useRef({ x: 0, y: 0 });
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      pageOffsetRef.current = event.nativeEvent.contentOffset;
      (nativeProps as { onScroll?: typeof handleScroll }).onScroll?.(event);
    },
    [nativeProps],
  );
  const contextValue = useMemo(
    () => ({ scrollViewRef, pageOffsetRef }),
    [scrollViewRef],
  );

  return useMemo(
    () => (
      <BasicPage lazyLoad={lazyLoad} fullPage={fullPage}>
        {scrollEnabled ? (
          <KeyboardAwareScrollView
            ref={scrollViewRef as any}
            scrollEventThrottle={30}
            {...(nativeProps as Record<string, unknown>)}
            onScroll={handleScroll}
            style={[{ flex: 1 }, style] as StyleProp<ViewStyle>}
            contentContainerStyle={contentContainerStyle}
            bottomOffset={KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET}
          >
            <ScrollViewRefProvider value={contextValue}>
              {children}
            </ScrollViewRefProvider>
          </KeyboardAwareScrollView>
        ) : (
          children
        )}
        <BasicPageFooter />
      </BasicPage>
    ),
    [
      lazyLoad,
      fullPage,
      scrollEnabled,
      nativeProps,
      handleScroll,
      style,
      contentContainerStyle,
      contextValue,
      children,
    ],
  );
}
