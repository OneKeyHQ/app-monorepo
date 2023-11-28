import { type PropsWithChildren, useMemo, useState } from 'react';

import { withStaticProperties } from 'tamagui';

import { View } from '../../optimization';

import { BasicPage } from './BasicPage';
import { BasicPageFooter, PageContextFooter } from './BasicPageFooter';
import { PageBody } from './PageBody';
import { PageContext } from './PageContext';
import { PageHeader } from './PageHeader';

import type { IPageButtonGroupProps } from './PageButtonGroup';

function PageContainer({
  children,
  skipLoading,
}: PropsWithChildren<{ skipLoading: boolean }>) {
  const memoPageContainer = useMemo(
    () => (
      <BasicPage skipLoading={skipLoading}>
        <View style={{ flex: 1, height: '100%' }}>{children}</View>
        <BasicPageFooter />
      </BasicPage>
    ),
    [skipLoading, children],
  );
  return memoPageContainer;
}

function PageProvider({
  children,
  skipLoading = false,
}: PropsWithChildren<{ skipLoading?: boolean }>) {
  const [options, setOptions] = useState<{
    footerOptions: IPageButtonGroupProps;
  }>();
  const value = useMemo(
    () => ({
      options,
      setOptions,
    }),
    [options],
  );
  return (
    <PageContext.Provider value={value}>
      <PageContainer skipLoading={skipLoading}>{children}</PageContainer>
    </PageContext.Provider>
  );
}

export const Page = withStaticProperties(PageProvider, {
  Header: PageHeader,
  Body: PageBody,
  Footer: PageContextFooter,
});
