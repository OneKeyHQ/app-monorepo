import { useCallback, useContext, useMemo } from 'react';

import { ScrollView } from '../ScrollView';

import { BasicPage } from './BasicPage';
import { PageContext } from './PageContext';
import { BasicPageFooter } from './PageFooter';

import type { IPageProps } from './type';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export function PageContainer({ children, skipLoading, fullPage }: IPageProps) {
  const { scrollEnabled, pageRef, pageOffsetRef, scrollProps } =
    useContext(PageContext);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      pageOffsetRef.current = event.nativeEvent.contentOffset;
    },
    [pageOffsetRef],
  );

  return useMemo(
    () => (
      <BasicPage skipLoading={skipLoading} fullPage={fullPage}>
        {scrollEnabled ? (
          <ScrollView
            ref={pageRef}
            scrollEventThrottle={30}
            onScroll={handleScroll as any}
            {...scrollProps}
          >
            {children}
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
      pageRef,
      handleScroll,
      scrollProps,
      children,
    ],
  );
}
