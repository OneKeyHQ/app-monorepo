import { useContext, useMemo } from 'react';

import Animated from 'react-native-reanimated';

import { ScrollView } from '../ScrollView';

import { BasicPage } from './BasicPage';
import { useSafeKeyboardAnimationStyle } from './hooks';
import { PageContext } from './PageContext';
import { BasicPageFooter } from './PageFooter';

import type { IPageProps } from './type';

export function PageContainer({ children, skipLoading, fullPage }: IPageProps) {
  const { scrollEnabled, scrollProps } = useContext(PageContext);

  const safeKeyboardAnimationStyle = useSafeKeyboardAnimationStyle();

  return useMemo(
    () => (
      <BasicPage skipLoading={skipLoading} fullPage={fullPage}>
        {scrollEnabled ? (
          <ScrollView {...scrollProps}>
            <Animated.View style={safeKeyboardAnimationStyle}>
              {children}
            </Animated.View>
          </ScrollView>
        ) : (
          children
        )}
        <BasicPageFooter />
      </BasicPage>
    ),
    [
      skipLoading,
      fullPage,
      scrollEnabled,
      scrollProps,
      safeKeyboardAnimationStyle,
      children,
    ],
  );
}
