import { useMemo, useState } from 'react';

import { withStaticProperties } from 'tamagui';

import { View } from '../../optimization';

import { BasicPage } from './BasicPage';
import { BasicPageFooter, PageContextFooter } from './BasicPageFooter';
import { PageBody } from './PageBody';
import { PageClose } from './PageClose';
import { PageContext } from './PageContext';
import { PageHeader } from './PageHeader';

import type { IPageButtonGroupProps } from './PageButtonGroup';
import type { IPageProps } from './type';

export type { IPageProps } from './type';

function PageContainer({ children, skipLoading, enableSafeArea }: IPageProps) {
  const memoPageContainer = useMemo(
    () => (
      <BasicPage skipLoading={skipLoading} enableSafeArea={enableSafeArea}>
        <View style={{ flex: 1, overflow: 'scroll' }}>{children}</View>
        <BasicPageFooter />
      </BasicPage>
    ),
    [skipLoading, enableSafeArea, children],
  );
  return memoPageContainer;
}

function PageProvider({
  children,
  skipLoading = false,
  enableSafeArea = false,
}: IPageProps) {
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
      <PageContainer skipLoading={skipLoading} enableSafeArea={enableSafeArea}>
        {children}
      </PageContainer>
    </PageContext.Provider>
  );
}

export const Page = withStaticProperties(PageProvider, {
  Header: PageHeader,
  Body: PageBody,
  Footer: PageContextFooter,
  Close: PageClose,
});
