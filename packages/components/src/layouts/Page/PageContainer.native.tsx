import { useCallback, useContext, useMemo, useRef, useState } from 'react';

import { View } from '../../optimization';
import { Stack } from '../../primitives';
import { ScrollView } from '../ScrollView';

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
        <ScrollView
          contentContainerStyle={scrollEnabled ? { flex: 1 } : undefined}
          scrollEnabled={scrollEnabled}
        >
          {children}
        </ScrollView>
        <BasicPageFooter />
      </BasicPage>
    ),
    [skipLoading, safeAreaEnabled, scrollEnabled, children],
  );
  return memoPageContainer;
}
