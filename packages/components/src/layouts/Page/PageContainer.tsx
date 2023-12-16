import { useCallback, useContext, useMemo } from 'react';

import { View } from '../../optimization';
import { ScrollView } from '../ScrollView';

import { BasicPage } from './BasicPage';
import { PageContext } from './PageContext';
import { BasicPageFooter } from './PageFooter';

import type { IPageProps } from './type';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export function PageContainer({ children, skipLoading }: IPageProps) {
  const { options } = useContext(PageContext);
  const { scrollEnabled, pageRef, pageOffsetRef } = options;

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      pageOffsetRef.current = event.nativeEvent.contentOffset;
    },
    [pageOffsetRef],
  );

  return useMemo(
    () => (
      <BasicPage skipLoading={skipLoading}>
        {scrollEnabled ? (
          <View style={{ flex: 1 }}>
            <ScrollView
              flex={1}
              height="100%"
              ref={pageRef}
              scrollEventThrottle={30}
              onScroll={handleScroll as any}
            >
              {children}
            </ScrollView>
          </View>
        ) : (
          children
        )}

        <BasicPageFooter />
      </BasicPage>
    ),
    [skipLoading, scrollEnabled, pageRef, handleScroll, children],
  );
}
