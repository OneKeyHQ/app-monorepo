import { useContext, useMemo } from 'react';

import { ScrollView } from '../ScrollView';

import { BasicPage } from './BasicPage';
import { PageContext } from './PageContext';
import { BasicPageFooter } from './PageFooter';

import type { IPageProps } from './type';

export function PageContainer({
  children,
  testID,
  backgroundColor,
}: IPageProps) {
  const { scrollEnabled, scrollProps } = useContext(PageContext);

  return useMemo(
    () => (
      <BasicPage testID={testID} backgroundColor={backgroundColor}>
        {scrollEnabled ? (
          <ScrollView {...scrollProps}>{children}</ScrollView>
        ) : (
          children
        )}
        <BasicPageFooter />
      </BasicPage>
    ),
    [testID, backgroundColor, scrollEnabled, scrollProps, children],
  );
}
