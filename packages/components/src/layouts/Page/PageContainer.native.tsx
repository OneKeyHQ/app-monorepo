import { useCallback, useContext, useMemo, useRef, useState } from 'react';

import {
  KeyboardAwareScrollView,
  useKeyboardState,
} from 'react-native-keyboard-controller';

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

export function PageContainer({
  children,
  testID,
  backgroundColor,
}: IPageProps) {
  const { scrollEnabled, scrollProps } = useContext(PageContext);
  const keyboardHeight = useKeyboardState((state) => state.height);
  const [isFooterLiftedByKeyboard, setIsFooterLiftedByKeyboard] =
    useState(false);
  // Page.Footer lifts itself above the keyboard and shrinks the ScrollView, so
  // the keyboard never covers it. Cancel the library's keyboard inset, or the
  // content can scroll up into blank space.
  const extraKeyboardSpace =
    scrollEnabled && isFooterLiftedByKeyboard ? -keyboardHeight : 0;

  const rawContentContainerStyle = scrollProps?.contentContainerStyle;
  const keyboardShouldPersistTaps = scrollProps?.keyboardShouldPersistTaps;
  const restScrollProps = useMemo(() => {
    if (!scrollProps) {
      return {};
    }
    const {
      contentContainerStyle: _contentContainerStyle,
      keyboardShouldPersistTaps: _keyboardShouldPersistTaps,
      ...rest
    } = scrollProps;
    return rest;
  }, [scrollProps]);

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

  const scrollViewStyle = useMemo(
    () => [{ flex: 1 }, style] as StyleProp<ViewStyle>,
    [style],
  );

  return useMemo(
    () => (
      <BasicPage testID={testID} backgroundColor={backgroundColor}>
        {scrollEnabled ? (
          <KeyboardAwareScrollView
            ref={scrollViewRef as any}
            scrollEventThrottle={30}
            {...(nativeProps as Record<string, unknown>)}
            onScroll={handleScroll}
            style={scrollViewStyle}
            contentContainerStyle={contentContainerStyle}
            bottomOffset={KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET}
            keyboardShouldPersistTaps={keyboardShouldPersistTaps}
            extraKeyboardSpace={extraKeyboardSpace}
          >
            <ScrollViewRefProvider value={contextValue}>
              {children}
            </ScrollViewRefProvider>
          </KeyboardAwareScrollView>
        ) : (
          children
        )}
        <BasicPageFooter onKeyboardLiftChange={setIsFooterLiftedByKeyboard} />
      </BasicPage>
    ),
    [
      testID,
      backgroundColor,
      scrollEnabled,
      nativeProps,
      handleScroll,
      scrollViewStyle,
      contentContainerStyle,
      keyboardShouldPersistTaps,
      extraKeyboardSpace,
      contextValue,
      children,
    ],
  );
}
