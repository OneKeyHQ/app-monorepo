import { useContext, useMemo } from 'react';

import { View } from '../../optimization';

import { BasicPage } from './BasicPage';
import { BasicPageFooter } from './BasicPageFooter';
import { PageContext } from './PageContext';

import type { IPageProps } from './type';

export function PageContainer({
  children,
  skipLoading,
  safeAreaEnabled,
}: IPageProps) {
  const { options = {} } = useContext(PageContext);
  const { scrollEnabled } = options;
  const memoPageContainer = useMemo(
    () => (
      <BasicPage skipLoading={skipLoading} safeAreaEnabled={safeAreaEnabled}>
        <View
          style={
            {
              flex: 1,
              // fix scroll padding in page body
              overflowY: scrollEnabled ? 'scroll' : 'hidden',
            } as any
          }
        >
          {children}
        </View>
        <BasicPageFooter />
      </BasicPage>
    ),
    [skipLoading, safeAreaEnabled, scrollEnabled, children],
  );
  return memoPageContainer;
}
