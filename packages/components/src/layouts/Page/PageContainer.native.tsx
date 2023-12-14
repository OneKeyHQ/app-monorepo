import { useContext, useMemo } from 'react';

import { ScrollView } from '../ScrollView';

import { BasicPage } from './BasicPage';
import { BasicPageFooter } from './BasicPageFooter';
import { PageContext } from './PageContext';

import type { IPageProps } from './type';

export function PageContainer({ children, skipLoading }: IPageProps) {
  const { options = {} } = useContext(PageContext);
  const { scrollEnabled } = options;

  const memoPageContainer = useMemo(
    () => (
      <BasicPage skipLoading={skipLoading}>
        {scrollEnabled ? (
          <ScrollView
            contentContainerStyle={scrollEnabled ? { flex: 1 } : undefined}
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}

        <BasicPageFooter />
      </BasicPage>
    ),
    [skipLoading, scrollEnabled, children],
  );
  return memoPageContainer;
}
