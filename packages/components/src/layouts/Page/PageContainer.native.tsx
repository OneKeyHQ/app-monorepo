import { useContext, useMemo } from 'react';

import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import {
  usePropsAndStyle,
  useStyle,
} from '@onekeyhq/components/src/shared/tamagui';

import { BasicPage } from './BasicPage';
import { PageContext } from './PageContext';
import { BasicPageFooter } from './PageFooter';

import type { IPageProps } from './type';
import type { StyleProp, ViewStyle } from 'react-native';

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

  return useMemo(
    () => (
      <BasicPage lazyLoad={lazyLoad} fullPage={fullPage}>
        {scrollEnabled ? (
          <KeyboardAwareScrollView
            scrollEventThrottle={30}
            {...(nativeProps as Record<string, unknown>)}
            style={[{ flex: 1 }, style] as StyleProp<ViewStyle>}
            contentContainerStyle={contentContainerStyle}
            bottomOffset={16}
          >
            {children}
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
      style,
      contentContainerStyle,
      children,
    ],
  );
}
