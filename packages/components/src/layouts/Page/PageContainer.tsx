import { useContext, useMemo } from 'react';

import { ScrollView } from '../ScrollView';

import { BasicPage } from './BasicPage';
import { PageContext } from './PageContext';
import { BasicPageFooter } from './PageFooter';

import type { IPageProps } from './type';

export function PageContainer({
  children,
  lazyLoad,
  fullPage,
  testID,
}: IPageProps) {
  const { scrollEnabled, scrollProps } = useContext(PageContext);

  return useMemo(
    () => (
      <BasicPage lazyLoad={lazyLoad} fullPage={fullPage} testID={testID}>
        {scrollEnabled ? (
          <ScrollView {...scrollProps}>{children}</ScrollView>
        ) : (
          children
        )}
        <BasicPageFooter />
      </BasicPage>
    ),
    [lazyLoad, fullPage, testID, scrollEnabled, scrollProps, children],
  );
}
